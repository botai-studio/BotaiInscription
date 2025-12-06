import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, N8AO } from '@react-three/postprocessing';
import ModelViewer from './components/ModelViewer/ModelViewer';
import CatmullClarkCube from './components/Procedural/CatmullClarkCube';
import RandomGraphMesh from './components/Procedural/RandomGraphMesh';
import SurfaceInscription from './components/SurfaceInscription';
import ControlPanel from './components/UI/ControlPanel';
import CameraController from './components/Scene/CameraController';
import ClipMesh from './components/Scene/ClipMesh';
import { generateGUID, calculatePrice } from './utils/math';
import { exportAndUploadGeometry, uploadToGoogleDrive } from './utils/objExporter';
import './App.css';

// Shared scale constant for Morpheus model and its accessories (clip)
const MORPHEUS_SCALE = 0.018;

function App() {
  // Check for debug parameter in URL
  const [debugMode, setDebugMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('debug') === 'true';
  });
  
  const [webglSupported, setWebglSupported] = useState(true);
  const [scaleX, setScaleX] = useState(1.0); // X scale
  const [scaleY, setScaleY] = useState(1.0); // Y scale
  const [scaleZ, setScaleZ] = useState(1.0); // Z scale
  const [twist, setTwist] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('test') === 'true' ? 90 : 0; // Default to Botai style in test mode
  }); // 扭曲角度 (degrees)
  const [booleanSubtract, setBooleanSubtract] = useState(false); // Inscription toggle
  const [subtractText, setSubtractText] = useState('Botai.'); // Inscription text
  const [localSubtractText, setLocalSubtractText] = useState('Botai.'); // Local input state
  const [textFont, setTextFont] = useState('helvetiker'); // Font selection
  const [textScale, setTextScale] = useState(0.10); // Text scale: 0.05 (Small), 0.10 (Medium), 0.15 (Large)
  const [textSpacing, setTextSpacing] = useState(0.3); // Text spacing (unused now)
  const [textOffsetX, setTextOffsetX] = useState(-0.35); // Text X offset (-1.0 to 1.0)
  const [textOffsetY, setTextOffsetY] = useState(-0.38); // Text Y offset (-1.0 to 1.0)
  const [textDepth, setTextDepth] = useState(-0.05); // Text depth: -0.05 (Deep), 0.25 (Shallow)
  const [textRotation, setTextRotation] = useState(24); // Text rotation in degrees (0 to 360)
  const [showText, setShowText] = useState(false); // Toggle inscription preview (off by default)
  const [showClip, setShowClip] = useState(false); // Show clip for Botai style
  const [isOrdering, setIsOrdering] = useState(false);
  const [objFile, setObjFile] = useState('./Morpheus.obj');
  const [email, setEmail] = useState(''); // 用户邮箱
  const [mode, setMode] = useState('original'); // 'original', 'manifold', 'graph', or 'test'
  
  // Check for test parameter in URL
  const [testMode, setTestMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('test') === 'true';
  });
  const [subdivisionLevel, setSubdivisionLevel] = useState(0);
  const [subdivisionType, setSubdivisionType] = useState('loop'); // 'loop' or 'catmull'
  const [currentGeometry, setCurrentGeometry] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [useAdvancedRendering, setUseAdvancedRendering] = useState(true); // Advanced rendering toggle
  const [useN8AO, setUseN8AO] = useState(true); // Enable N8AO ambient occlusion
  const [useToneMapping, setUseToneMapping] = useState(true); // Enable tone mapping

  // Test mode: Multiple inscriptions state
  const [inscriptions, setInscriptions] = useState([
    {
      id: 1,
      text: 'Botai',
      scale: 0.08,
      rotation: 0,
      depth: 0.02,
      font: 'helvetiker',
      clickData: null
    }
  ]);
  const [selectedInscriptionId, setSelectedInscriptionId] = useState(1);
  const [nextInscriptionId, setNextInscriptionId] = useState(2);
  
  // Global settings for all inscriptions
  const [showMarker, setShowMarker] = useState(true);
  const [showTestText, setShowTestText] = useState(true);
  const [showTextMesh, setShowTextMesh] = useState(false);
  const [conformToSurface, setConformToSurface] = useState(true);
  const [showUVMap, setShowUVMap] = useState(false);
  const modelMeshRef = useRef(null);
  
  // Text mesh geometries for CSG subtraction (stored per inscription id)
  const [textMeshGeometries, setTextMeshGeometries] = useState({});
  const [triggerApplyInscriptions, setTriggerApplyInscriptions] = useState(false);
  
  // Handler to store text mesh geometry when SurfaceTextMesh generates it
  const handleTextMeshGeometryReady = (inscriptionId, geometry) => {
    console.log(`📦 Text mesh geometry ready for inscription #${inscriptionId}`);
    setTextMeshGeometries(prev => ({
      ...prev,
      [inscriptionId]: geometry
    }));
  };
  
  // Handler for Apply Inscriptions button
  const handleApplyInscriptions = () => {
    console.log('🔪 Apply Inscriptions clicked');
    setTriggerApplyInscriptions(true);
  };
  
  const handleInscriptionsApplied = () => {
    console.log('✅ Inscriptions applied');
    setTriggerApplyInscriptions(false);
  };

  // Helper functions for inscription management
  const getSelectedInscription = () => inscriptions.find(i => i.id === selectedInscriptionId);
  
  const updateInscription = (id, updates) => {
    setInscriptions(prev => prev.map(i => 
      i.id === id ? { ...i, ...updates } : i
    ));
  };
  
  // Deep clone clickData to prevent shared THREE.Vector3 references
  const cloneClickData = (data) => {
    if (!data) return null;
    return {
      point: data.point.clone(),
      normal: data.normal.clone(),
      tangent: data.tangent.clone(),
      bitangent: data.bitangent.clone(),
      face: data.face,
      uv: data.uv,
      object: data.object,
      distance: data.distance
    };
  };
  
  const addInscription = () => {
    const newInscription = {
      id: nextInscriptionId,
      text: 'Text',
      scale: 0.08,
      rotation: 0,
      depth: 0.02,
      font: 'helvetiker',
      clickData: null
    };
    setInscriptions(prev => [...prev, newInscription]);
    setSelectedInscriptionId(nextInscriptionId);
    setNextInscriptionId(prev => prev + 1);
  };
  
  const deleteInscription = (id) => {
    if (inscriptions.length <= 1) return; // Keep at least one
    setInscriptions(prev => prev.filter(i => i.id !== id));
    if (selectedInscriptionId === id) {
      // Select another inscription
      const remaining = inscriptions.filter(i => i.id !== id);
      if (remaining.length > 0) {
        setSelectedInscriptionId(remaining[0].id);
      }
    }
  };

  // Check for offline parameter in URL
  const [offlineMode, setOfflineMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('offline') === 'true';
  });
  const [confirmationNumber, setConfirmationNumber] = useState(null);
  const fileInputRef = useRef(null);

  const price = calculatePrice(scaleX, scaleY, scaleZ);

  // Update showClip based on twist value - only show when exactly 90 (Botai style)
  useEffect(() => {
    setShowClip(twist === 90 && objFile && objFile.includes('Morpheus'));
  }, [twist, objFile]);

  // 检测浏览器是否支持 WebGL（在 mount 时运行一次）
  useEffect(() => {
    const isWebGLAvailable = () => {
      try {
        const canvas = document.createElement('canvas');
        return !!(
          canvas.getContext('webgl2') ||
          canvas.getContext('webgl') ||
          canvas.getContext('experimental-web-gl')
        );
      } catch (e) {
        return false;
      }
    };

    setWebglSupported(isWebGLAvailable());
  }, []);

  // 处理导出到 Google Drive
  const handleExport = async () => {
    if (!currentGeometry) {
      alert('No geometry available to export. Please wait for the mesh to load.');
      return;
    }

    setIsExporting(true);

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${mode}_mesh_${timestamp}.stl`;
      
      const result = await exportAndUploadGeometry(currentGeometry, filename);
      
      alert(`✅ Export successful!\n\nFile: ${filename}\nURL: ${result.fileUrl}`);
    } catch (error) {
      console.error('Export failed:', error);
      alert(`❌ Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // 处理订单
  const handleOrder = async () => {
    if (!offlineMode && (!email || !email.includes('@'))) {
      alert('Please enter a valid email address');
      return;
    }

    setIsOrdering(true);

    try {
      let currentConfirmationNumber = confirmationNumber;
      
      if (!offlineMode) {
        // Online mode: Generate new confirmation number
        const guid = generateGUID();
        currentConfirmationNumber = guid.substring(0, 8);
        setConfirmationNumber(currentConfirmationNumber);
        
        // 构建产品名称
        const productName = `Custom 3D Product-${currentConfirmationNumber}`;
        
        console.log('Creating Order:', {
          guid,
          productName,
          scaleX,
          scaleY,
          scaleZ,
          price,
          email
        });

        // Upload Settings JSON
        const settings = {
            scaleX, scaleY, scaleZ,
            twist, booleanSubtract, subtractText,
            textFont, textScale, textSpacing,
            textOffsetX, textOffsetY, textDepth, textRotation,
            mode, objFile, email,
            confirmationNumber: currentConfirmationNumber,
            timestamp: new Date().toISOString()
        };
        console.log('📤 Uploading settings JSON...');
        await uploadToGoogleDrive(JSON.stringify(settings, null, 2), `order_${currentConfirmationNumber}_settings.json`);

        // Export to Google Drive with confirmation number in filename (if geometry available)
        if (currentGeometry) {
            console.log('📤 Exporting to Google Drive...');
            const filename = `order_${currentConfirmationNumber}_${mode}_mesh.stl`;
            
            try {
            await exportAndUploadGeometry(currentGeometry, filename);
            console.log('✅ Export to Google Drive successful');
            } catch (exportError) {
            console.error('⚠️ Export failed but continuing with order:', exportError);
            }
        } else {
            console.log('⚠️ No geometry available to export, skipping...');
        }

        // 调用你的 Vercel API
        const apiUrl = new URL('https://shopify-draft-order-io3s5gd2e-ricerolls-projects.vercel.app/api/create-order');
        apiUrl.searchParams.append('productName', productName);
        apiUrl.searchParams.append('price', price);
        apiUrl.searchParams.append('email', email);
        
        console.log('API URL:', apiUrl.toString());

        const response = await fetch(apiUrl.toString(), {
            method: 'GET',
            headers: {
            'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            throw new Error(`API Request Failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('API Response:', data);
        
        // 获取 Shopify URL 并跳转
        if (data.checkoutUrl) {
            console.log('Redirecting to Shopify:', data.checkoutUrl);
            window.location.href = data.checkoutUrl;
        } else {
            throw new Error('Failed to get Shopify URL');
        }
      } else {
        // Offline Mode
        if (!currentConfirmationNumber) {
            // Generate a temporary confirmation number if none exists (e.g. testing without loading JSON)
            const guid = generateGUID();
            currentConfirmationNumber = "OFFLINE-" + guid.substring(0, 8);
            console.log("⚠️ No confirmation number found. Using generated one:", currentConfirmationNumber);
        }

        if (currentGeometry) {
            console.log('📤 Exporting to Google Drive (Offline Mode)...');
            // Use same confirmation number
            const filename = `order_${currentConfirmationNumber}_${mode}_offline_mesh.stl`;
            
            await exportAndUploadGeometry(currentGeometry, filename);
            console.log('✅ Export to Google Drive successful');
            alert(`Upload successful!\nFile: ${filename}`);
        } else {
            alert("No geometry to upload.");
        }
        
        setIsOrdering(false);
      }

    } catch (error) {
      console.error('Order/Upload Failed:', error);
      alert('Operation failed: ' + error.message);
      setIsOrdering(false);
    }
  };

  const handleLoadJson = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const settings = JSON.parse(e.target.result);
        
        if (settings.scaleX) setScaleX(settings.scaleX);
        if (settings.scaleY) setScaleY(settings.scaleY);
        if (settings.scaleZ) setScaleZ(settings.scaleZ);
        if (settings.twist !== undefined) setTwist(settings.twist);
        if (settings.booleanSubtract !== undefined) setBooleanSubtract(settings.booleanSubtract);
        if (settings.subtractText) setSubtractText(settings.subtractText);
        if (settings.textFont) setTextFont(settings.textFont);
        if (settings.textScale) setTextScale(settings.textScale);
        if (settings.textSpacing) setTextSpacing(settings.textSpacing);
        if (settings.textOffsetX) setTextOffsetX(settings.textOffsetX);
        if (settings.textOffsetY) setTextOffsetY(settings.textOffsetY);
        if (settings.textDepth) setTextDepth(settings.textDepth);
        if (settings.textRotation) setTextRotation(settings.textRotation);
        if (settings.mode) setMode(settings.mode);
        if (settings.email) setEmail(settings.email);
        if (settings.confirmationNumber) setConfirmationNumber(settings.confirmationNumber);

        if (offlineMode && settings.objFile) {
           // Always use the standard file path (which is now the high-res one for Morpheus)
           // If the JSON saved a specific file path, we might want to respect it, 
           // but for Morpheus we want to ensure we use the current "Morpheus.obj"
           if (settings.objFile.includes('Morpheus')) {
               setObjFile('./Morpheus.obj');
           } else {
               setObjFile(settings.objFile);
           }
        } else if (settings.objFile) {
           setObjFile(settings.objFile);
        }
        
        alert("Settings loaded successfully!");

      } catch (error) {
        console.error("Error parsing JSON:", error);
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="app-container">
      {/* 左侧控制面板 */}
      <ControlPanel
        debugMode={debugMode}
        mode={mode}
        setMode={setMode}
        objFile={objFile}
        setObjFile={setObjFile}
        twist={twist}
        setTwist={setTwist}
        inscriptions={inscriptions}
        selectedInscriptionId={selectedInscriptionId}
        setSelectedInscriptionId={setSelectedInscriptionId}
        deleteInscription={deleteInscription}
        updateInscription={updateInscription}
        addInscription={addInscription}
        showMarker={showMarker}
        setShowMarker={setShowMarker}
        showTestText={showTestText}
        setShowTestText={setShowTestText}
        showTextMesh={showTextMesh}
        setShowTextMesh={setShowTextMesh}
        conformToSurface={conformToSurface}
        setConformToSurface={setConformToSurface}
        showUVMap={showUVMap}
        setShowUVMap={setShowUVMap}
        useAdvancedRendering={useAdvancedRendering}
        setUseAdvancedRendering={setUseAdvancedRendering}
        subdivisionLevel={subdivisionLevel}
        setSubdivisionLevel={setSubdivisionLevel}
        scaleX={scaleX}
        setScaleX={setScaleX}
        scaleY={scaleY}
        setScaleY={setScaleY}
        scaleZ={scaleZ}
        setScaleZ={setScaleZ}
        booleanSubtract={booleanSubtract}
        setBooleanSubtract={setBooleanSubtract}
        localSubtractText={localSubtractText}
        setLocalSubtractText={setLocalSubtractText}
        setSubtractText={setSubtractText}
        textFont={textFont}
        setTextFont={setTextFont}
        textScale={textScale}
        setTextScale={setTextScale}
        textDepth={textDepth}
        setTextDepth={setTextDepth}
        textOffsetX={textOffsetX}
        setTextOffsetX={setTextOffsetX}
        textOffsetY={textOffsetY}
        setTextOffsetY={setTextOffsetY}
        textRotation={textRotation}
        setTextRotation={setTextRotation}
        showText={showText}
        setShowText={setShowText}
        offlineMode={offlineMode}
        email={email}
        setEmail={setEmail}
        price={price}
        fileInputRef={fileInputRef}
        handleLoadJson={handleLoadJson}
        confirmationNumber={confirmationNumber}
        handleOrder={handleOrder}
        isOrdering={isOrdering}
        onApplyInscriptions={handleApplyInscriptions}
      />

      {/* 右侧 3D 查看器 */}
      <div className="canvas-container" style={{ position: 'relative' }}>
        {webglSupported ? (
          <>
            <Canvas
              gl={{
              antialias: true,
              alpha: false,
              powerPreference: 'high-performance',
              failIfMajorPerformanceCaveat: false,
            }}
            onCreated={({ gl }) => {
              gl.setClearColor('#eee');
            }}
          >
            <PerspectiveCamera makeDefault position={[0, 0, 5]} />
            <CameraController twist={twist} />
            <OrbitControls 
              enableZoom={true}
              enablePan={true}
              enableRotate={true}
              minDistance={1}
              maxDistance={20}
              enableDamping={true}
              dampingFactor={0.9}
            />
            <ambientLight intensity={0.6} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <directionalLight position={[-10, -10, -5]} intensity={0.5} />
            
            {mode === 'original' || mode === 'test' || mode === 'inscription' ? (
              objFile ? (
                <>
                  <ModelViewer 
                    objUrl={objFile} 
                    scaleX={mode === 'test' || mode === 'inscription' ? 1.0 : scaleX}
                    scaleY={mode === 'test' || mode === 'inscription' ? 1.0 : scaleY}
                    scaleZ={mode === 'test' || mode === 'inscription' ? 1.0 : scaleZ}
                    twist={mode === 'inscription' ? 0 : twist}
                    booleanSubtract={mode === 'test' || mode === 'inscription' ? false : (debugMode || (objFile && objFile.includes('Morpheus')) ? booleanSubtract : false)}
                    subtractText={subtractText}
                    textFont={textFont}
                    textScale={textScale}
                    textSpacing={textSpacing}
                    textOffsetX={textOffsetX}
                    textOffsetY={textOffsetY}
                    textDepth={textDepth}
                    textRotation={textRotation}
                    showText={showText}
                    subdivisionLevel={debugMode || offlineMode || objFile === './trinity.obj' ? subdivisionLevel : 0}
                    fixedScale={objFile && objFile.includes('Morpheus') ? MORPHEUS_SCALE : null}
                    onGeometryReady={(geometry) => setCurrentGeometry(geometry)}
                    meshRef={mode === 'test' || mode === 'inscription' ? modelMeshRef : null}
                    testModeInscriptions={mode === 'test' || mode === 'inscription' ? inscriptions : null}
                    textMeshGeometries={mode === 'test' || mode === 'inscription' ? textMeshGeometries : null}
                    applyInscriptions={triggerApplyInscriptions}
                    onInscriptionsApplied={handleInscriptionsApplied}
                  />
                  <ClipMesh visible={showClip} />
                  
                  {/* Surface Inscription for Test Mode and Inscription Mode */}
                  {(mode === 'test' || mode === 'inscription') && (
                    <>
                      {/* Raycaster to place inscriptions */}
                      <SurfaceInscription
                        meshRef={modelMeshRef}
                        enabled={true}
                        inscriptionText={getSelectedInscription()?.text || 'Text'}
                        textScale={getSelectedInscription()?.scale || 0.08}
                        textRotation={getSelectedInscription()?.rotation || 0}
                        textDepth={getSelectedInscription()?.depth || 0.02}
                        textFont={getSelectedInscription()?.font || 'helvetiker'}
                        clickData={null}
                        showMarker={false}
                        showText={false}
                        conformToSurface={conformToSurface}
                        showUVMap={false}
                        onInscriptionPlaced={(data) => {
                          updateInscription(selectedInscriptionId, { clickData: cloneClickData(data) });
                        }}
                      />
                      
                      {/* Render all inscriptions */}
                      {inscriptions.map((inscription) => (
                        inscription.clickData && (
                          <SurfaceInscription
                            key={inscription.id}
                            meshRef={modelMeshRef}
                            enabled={false}
                            inscriptionText={inscription.text}
                            textScale={inscription.scale}
                            textRotation={inscription.rotation}
                            textDepth={inscription.depth}
                            textFont={inscription.font}
                            clickData={inscription.clickData}
                            showMarker={showMarker && selectedInscriptionId === inscription.id}
                            showText={showTestText}
                            showTextMesh={showTextMesh}
                            conformToSurface={conformToSurface}
                            showUVMap={showUVMap && selectedInscriptionId === inscription.id}
                            onInscriptionPlaced={null}
                            onTextMeshGeometryReady={(geo) => handleTextMeshGeometryReady(inscription.id, geo)}
                          />
                        )
                      ))}
                    </>
                  )}
                </>
              ) : (
                <mesh>
                  <boxGeometry args={[1, 1, 1]} />
                  <meshStandardMaterial color="#cccccc" wireframe />
                </mesh>
              )
            ) : mode === 'manifold' ? (
              <CatmullClarkCube 
                subdivisionLevel={subdivisionLevel} 
                onGeometryReady={(geometry) => setCurrentGeometry(geometry)}
              />
            ) : (
              <RandomGraphMesh 
                subdivisionLevel={subdivisionLevel}
                subdivisionType={subdivisionType}
                onGeometryReady={(geometry) => setCurrentGeometry(geometry)}
              />
            )}
            
            {debugMode && <gridHelper args={[10, 10]} />}
            
            {useAdvancedRendering && (
              <EffectComposer>
                {useN8AO && (
                  <>
                    <N8AO aoRadius={0.15} intensity={4} distanceFalloff={2} />
                    {/* <BrightnessContrast brightness={0.1} contrast={0.25} /> */}
                  </>
                )}
                {/* {useToneMapping && <ToneMapping />} */}
              </EffectComposer>
            )}
          </Canvas>
          </>
        ) : (
          <div className="placeholder">
            <p>WebGL is not supported in your current browser or environment.</p>
            <p>Suggestions:</p>
            <ul>
              <li>Open in Chrome or Firefox with hardware acceleration enabled.</li>
              <li>Check <code>chrome://gpu</code> or your browser's GPU support page for more info.</li>
              <li>If in a restricted environment, try opening in a standard browser.</li>
            </ul>
            <button className="sample-button" onClick={() => window.location.reload()}>
              Retry (Refresh Page)
            </button>
          </div>
        )}
        
        {/* Upload overlay */}
        {isOrdering && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            color: 'white',
            zIndex: 1000,
            gap: '20px'
          }}>
            <div className="upload-icon">
              <svg 
                width="32" 
                height="32" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="white" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="upload-arrow-svg"
              >
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
              </svg>
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginTop: '10px'
            }}>
              Uploading your design...
            </div>
            <div style={{
              fontSize: '16px',
              opacity: 0.8
            }}>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
