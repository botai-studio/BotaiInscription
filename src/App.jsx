import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, N8AO } from '@react-three/postprocessing';
import ModelViewer from './components/ModelViewer/ModelViewer';
import CatmullClarkCube from './components/Procedural/CatmullClarkCube';
import RandomGraphMesh from './components/Procedural/RandomGraphMesh';
import SurfaceInscription from './components/SurfaceInscription';
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
      <div className="control-panel">
        <img src="./Botai_Logo.svg" alt="Botai" style={{ width: '100px', marginBottom: '16px' }} />
        
        {/* 选择模式按钮 */}
        <div className="control-group">
          <label style={{ fontSize: '13px', fontWeight: '600' }}>Select Mode:</label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
            {debugMode && (
              <>
                <button
                  type="button"
                  className="sample-button"
                  onClick={() => setMode('graph')}
                  style={{
                    background: mode === 'graph' ? '#000' : '#f5f5f5',
                    color: mode === 'graph' ? '#fff' : '#000',
                    flex: '1 1 45%'
                  }}
                >
                  Random Graph
                </button>
                <button
                  type="button"
                  className="sample-button"
                  onClick={() => setMode('manifold')}
                  style={{
                    background: mode === 'manifold' ? '#000' : '#f5f5f5',
                    color: mode === 'manifold' ? '#fff' : '#000',
                    flex: '1 1 45%'
                  }}
                >
                  Cube
                </button>
              </>
            )}
            <button
              type="button"
              className="sample-button"
              onClick={() => { setObjFile('./bow_tie_small.obj'); setMode('original'); }}
              style={{
                background: mode === 'original' && objFile.includes('bow_tie_small') ? '#000' : '#f5f5f5',
                color: mode === 'original' && objFile.includes('bow_tie_small') ? '#fff' : '#000',
                flex: '1 1 45%'
              }}
            >
              Bow Tie
            </button>
            <button
              type="button"
              className="sample-button"
              onClick={() => { setObjFile('./trinity.obj'); setMode('original'); }}
              style={{
                background: mode === 'original' && objFile.includes('trinity') ? '#000' : '#f5f5f5',
                color: mode === 'original' && objFile.includes('trinity') ? '#fff' : '#000',
                flex: '1 1 45%'
              }}
            >
              Trinity
            </button>
            <button
              type="button"
              className="sample-button"
              onClick={() => { setObjFile('./Morpheus.obj'); setMode('original'); }}
              style={{
                background: mode === 'original' && objFile.includes('Morpheus') ? '#000' : '#f5f5f5',
                color: mode === 'original' && objFile.includes('Morpheus') ? '#fff' : '#000',
                flex: '1 1 45%'
              }}
            >
              Morpheus
            </button>
            <button
              type="button"
              className="sample-button"
              onClick={() => { setObjFile('./Webber Edge.obj'); setMode('original'); }}
              style={{
                background: mode === 'original' && objFile.includes('Webber Edge') ? '#000' : '#f5f5f5',
                color: mode === 'original' && objFile.includes('Webber Edge') ? '#fff' : '#000',
                flex: '1 1 45%'
              }}
            >
              Webber Edge
            </button>
            <button
              type="button"
              className="sample-button"
              onClick={() => { setObjFile('./Morpheus.obj'); setMode('test'); setTwist(90); }}
              style={{
                  background: mode === 'test' ? '#000' : '#f5f5f5',
                  color: mode === 'test' ? '#fff' : '#000',
                  flex: '1 1 45%',
                  border: mode === 'test' ? '1px solid #000' : '1px solid #e0e0e0'
                }}
              >
                Test Mode
              </button>
          </div>
          {mode === 'original' && objFile && <p className="file-status">✓ {objFile.split('/').pop()}</p>}
          {mode === 'test' && <p className="file-status">Test Mode Active</p>}
        </div>

        {/* High Resolution Toggle - Removed as we always use high res now */}
        
        {/* TEST MODE UI */}
        {mode === 'test' ? (
          <>
            {/* Style Toggle: Flat / Botai */}
            <div className="control-group" style={{ marginTop: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600' }}>Style:</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="sample-button"
                  onClick={() => setTwist(0)}
                  style={{
                    background: twist === 0 ? '#000' : '#f5f5f5',
                    color: twist === 0 ? '#fff' : '#000',
                    flex: '1 1 45%'
                  }}
                >
                  Flat
                </button>
                <button
                  type="button"
                  className="sample-button"
                  onClick={() => setTwist(90)}
                  style={{
                    background: twist === 90 ? '#000' : '#f5f5f5',
                    color: twist === 90 ? '#fff' : '#000',
                    flex: '1 1 45%'
                  }}
                >
                  Botai
                </button>
              </div>
            </div>

            {/* Twist Slider */}
            <div className="control-group">
              <label>
                Twist: <span className="value">{twist}°</span>
              </label>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={twist}
                onChange={(e) => setTwist(parseInt(e.target.value))}
                className="slider"
              />
              <div className="slider-labels">
                <span>-180°</span>
                <span>0°</span>
                <span>180°</span>
              </div>
            </div>

            {/* Inscription Cards Section */}
            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '11px', color: '#333', margin: '0 0 10px 0' }}>
                <strong>Inscriptions</strong> — Click on mesh or hold 'A' + move
              </p>
              
              {/* Inscription Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {inscriptions.map((inscription, index) => (
                  <div
                    key={inscription.id}
                    onClick={() => setSelectedInscriptionId(inscription.id)}
                    style={{
                      padding: '10px',
                      border: selectedInscriptionId === inscription.id ? '2px solid #000' : '1px solid #e0e0e0',
                      background: selectedInscriptionId === inscription.id ? '#f0f0f0' : '#fff',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                  >
                    {/* Card Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#333' }}>
                        #{index + 1} {inscription.clickData ? '✓' : '○'}
                      </span>
                      {inscriptions.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteInscription(inscription.id); }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            color: '#999',
                            padding: '0 4px'
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    
                    {/* Text Input */}
                    <div style={{ marginBottom: '6px' }}>
                      <input
                        type="text"
                        value={inscription.text}
                        onChange={(e) => updateInscription(inscription.id, { text: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Enter text"
                        maxLength="20"
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                          fontSize: '11px',
                          border: '1px solid #ddd',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    
                    {/* Scale Slider */}
                    <div style={{ marginBottom: '4px' }}>
                      <label style={{ fontSize: '10px', color: '#666' }}>
                        Scale: {inscription.scale.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0.02"
                        max="0.2"
                        step="0.01"
                        value={inscription.scale}
                        onChange={(e) => updateInscription(inscription.id, { scale: parseFloat(e.target.value) })}
                        onClick={(e) => e.stopPropagation()}
                        className="slider"
                        style={{ marginTop: '2px' }}
                      />
                    </div>
                    
                    {/* Rotation Slider */}
                    <div style={{ marginBottom: '4px' }}>
                      <label style={{ fontSize: '10px', color: '#666' }}>
                        Rotation: {inscription.rotation}°
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        step="5"
                        value={inscription.rotation}
                        onChange={(e) => updateInscription(inscription.id, { rotation: parseInt(e.target.value) })}
                        onClick={(e) => e.stopPropagation()}
                        className="slider"
                        style={{ marginTop: '2px' }}
                      />
                    </div>
                    
                    {/* Depth Slider */}
                    <div>
                      <label style={{ fontSize: '10px', color: '#666' }}>
                        Depth: {inscription.depth.toFixed(3)}
                      </label>
                      <input
                        type="range"
                        min="0.005"
                        max="0.05"
                        step="0.005"
                        value={inscription.depth}
                        onChange={(e) => updateInscription(inscription.id, { depth: parseFloat(e.target.value) })}
                        onClick={(e) => e.stopPropagation()}
                        className="slider"
                        style={{ marginTop: '2px' }}
                      />
                    </div>
                    
                    {/* Position Info (if placed) */}
                    {inscription.clickData && (
                      <div style={{ marginTop: '6px', fontSize: '9px', color: '#888' }}>
                        Position: ({inscription.clickData.point.x.toFixed(2)}, {inscription.clickData.point.y.toFixed(2)}, {inscription.clickData.point.z.toFixed(2)})
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Add New Inscription Card */}
                <div
                  onClick={addInscription}
                  style={{
                    padding: '20px',
                    border: '2px dashed #ccc',
                    background: '#fafafa',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'border-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#999'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#ccc'}
                >
                  <span style={{ fontSize: '24px', color: '#999' }}>+</span>
                </div>
              </div>
            </div>

            {/* Global Settings Card */}
            <div style={{ marginTop: '16px', padding: '10px', background: '#f5f5f5', border: '1px solid #e0e0e0' }}>
              <p style={{ fontSize: '11px', fontWeight: '600', color: '#333', margin: '0 0 8px 0' }}>
                Display Settings
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '10px', color: '#333' }}>
                  <input
                    type="checkbox"
                    checked={showMarker}
                    onChange={(e) => setShowMarker(e.target.checked)}
                    style={{ width: '12px', height: '12px', cursor: 'pointer' }}
                  />
                  <span>Marker</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '10px', color: '#333' }}>
                  <input
                    type="checkbox"
                    checked={showTestText}
                    onChange={(e) => setShowTestText(e.target.checked)}
                    style={{ width: '12px', height: '12px', cursor: 'pointer' }}
                  />
                  <span>Dots</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '10px', color: '#333' }}>
                  <input
                    type="checkbox"
                    checked={showTextMesh}
                    onChange={(e) => setShowTextMesh(e.target.checked)}
                    style={{ width: '12px', height: '12px', cursor: 'pointer' }}
                  />
                  <span>Text Mesh</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '10px', color: '#333' }}>
                  <input
                    type="checkbox"
                    checked={conformToSurface}
                    onChange={(e) => setConformToSurface(e.target.checked)}
                    style={{ width: '12px', height: '12px', cursor: 'pointer' }}
                  />
                  <span>Conform</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '10px', color: '#333' }}>
                  <input
                    type="checkbox"
                    checked={showUVMap}
                    onChange={(e) => setShowUVMap(e.target.checked)}
                    style={{ width: '12px', height: '12px', cursor: 'pointer' }}
                  />
                  <span>UV Map</span>
                </label>
              </div>
            </div>

            {/* Advanced Rendering Toggle */}
            <div className="control-group" style={{ marginTop: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useAdvancedRendering}
                  onChange={(e) => setUseAdvancedRendering(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '12px', fontWeight: '600' }}>Advanced Rendering</span>
              </label>
            </div>
          </>
        ) : mode === 'original' ? (
          <>
            {/* Subdivision Level - Only show for Trinity or in debug mode or offline mode */}
            {(debugMode || offlineMode || objFile === './trinity.obj') && (
              <div className="control-group" style={{ marginTop: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>
                  Subdivision Level: <span className="value">{subdivisionLevel}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="1"
                  value={subdivisionLevel}
                  onChange={(e) => setSubdivisionLevel(parseInt(e.target.value))}
                  className="slider"
                />
                <div className="slider-labels">
                  <span>0</span>
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                </div>
              </div>
            )}

            {/* Scale X Slider */}
            <div className="control-group">
              <label>
                Scale X: <span className="value">{scaleX.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.01"
                value={scaleX}
                onChange={(e) => setScaleX(parseFloat(e.target.value))}
                className="slider"
              />
              <div className="slider-labels">
                <span>0.5</span>
                <span>1.0</span>
                <span>1.5</span>
              </div>
            </div>

            {/* Scale Y Slider */}
            <div className="control-group">
              <label>
                Scale Y: <span className="value">{scaleY.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.01"
                value={scaleY}
                onChange={(e) => setScaleY(parseFloat(e.target.value))}
                className="slider"
              />
              <div className="slider-labels">
                <span>0.5</span>
                <span>1.0</span>
                <span>1.5</span>
              </div>
            </div>

            {/* Scale Z Slider */}
            <div className="control-group">
              <label>
                Scale Z: <span className="value">{scaleZ.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.01"
                value={scaleZ}
                onChange={(e) => setScaleZ(parseFloat(e.target.value))}
                className="slider"
              />
              <div className="slider-labels">
                <span>0.5</span>
                <span>1.0</span>
                <span>1.5</span>
              </div>
            </div>

            {/* Flat/Botai Toggle - Only show for Morpheus in non-debug mode */}
            {!debugMode && objFile && objFile.includes('Morpheus') && (
              <div className="control-group" style={{ marginTop: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Style:</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="sample-button"
                    onClick={() => setTwist(0)}
                    style={{
                      background: twist === 0 ? '#000' : '#f5f5f5',
                      color: twist === 0 ? '#fff' : '#000',
                      flex: '1 1 45%'
                    }}
                  >
                    Flat
                  </button>
                  <button
                    type="button"
                    className="sample-button"
                    onClick={() => setTwist(90)}
                    style={{
                      background: twist === 90 ? '#000' : '#f5f5f5',
                      color: twist === 90 ? '#fff' : '#000',
                      flex: '1 1 45%'
                    }}
                  >
                    Botai
                  </button>
                </div>
              </div>
            )}

            {/* Twist Slider - Always visible */}
            <div className="control-group">
              <label>
                Twist: <span className="value">{twist}°</span>
              </label>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={twist}
                onChange={(e) => setTwist(parseInt(e.target.value))}
                className="slider"
              />
              <div className="slider-labels">
                <span>-180°</span>
                <span>0°</span>
                <span>180°</span>
              </div>
            </div>

            {/* Inscription - Only show for Morpheus or in debug mode */}
            {(debugMode || (objFile && objFile.includes('Morpheus'))) && (
              <>
                <div className="control-group" style={{ marginTop: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={booleanSubtract}
                      onChange={(e) => setBooleanSubtract(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: '600' }}>Inscription</span>
                  </label>
                </div>

            {/* Text Input for Inscription */}
            {booleanSubtract && (
              <>
                <div className="control-group">
                  <label style={{ fontSize: '12px', fontWeight: '600' }}>
                    Inscription Text:
                  </label>
                  <input
                    type="text"
                    value={localSubtractText}
                    onChange={(e) => setLocalSubtractText(e.target.value)}
                    onBlur={() => setSubtractText(localSubtractText)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setSubtractText(localSubtractText);
                        e.target.blur();
                      }
                    }}
                    placeholder="Enter text (e.g., Botai)"
                    maxLength="50"
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '13px',
                      border: '2px solid #ddd',
                      borderRadius: '4px',
                      marginTop: '4px',
                    }}
                  />
                </div>

                {/* Font Selection */}
                <div className="control-group">
                  <label style={{ fontSize: '12px', fontWeight: '600' }}>
                    Font:
                  </label>
                  <select
                    value={textFont}
                    onChange={(e) => setTextFont(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '13px',
                      border: '2px solid #ddd',
                      borderRadius: '4px',
                      marginTop: '4px',
                    }}
                  >
                    <option value="helvetiker">Helvetica</option>
                    <option value="gentilis">Garamond</option>
                    <option value="droid_sans">Inter</option>
                    <option value="optimer">Caveat</option>
                    <option value="droid_serif">Pacifico</option>
                  </select>
                </div>

                {/* Text Scale Buttons - Small/Medium/Large */}
                <div className="control-group">
                  <label style={{ fontSize: '12px', fontWeight: '600' }}>Text Size:</label>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <button
                      type="button"
                      className="sample-button"
                      onClick={() => setTextScale(0.05)}
                      style={{
                        background: textScale === 0.05 ? '#000' : '#f5f5f5',
                        color: textScale === 0.05 ? '#fff' : '#000',
                        flex: 1
                      }}
                    >
                      Small
                    </button>
                    <button
                      type="button"
                      className="sample-button"
                      onClick={() => setTextScale(0.10)}
                      style={{
                        background: textScale === 0.10 ? '#000' : '#f5f5f5',
                        color: textScale === 0.10 ? '#fff' : '#000',
                        flex: 1
                      }}
                    >
                      Medium
                    </button>
                    <button
                      type="button"
                      className="sample-button"
                      onClick={() => setTextScale(0.15)}
                      style={{
                        background: textScale === 0.15 ? '#000' : '#f5f5f5',
                        color: textScale === 0.15 ? '#fff' : '#000',
                        flex: 1
                      }}
                    >
                      Large
                    </button>
                  </div>
                </div>

                {/* Text Depth Buttons - Deep/Shallow */}
                <div className="control-group">
                  <label style={{ fontSize: '12px', fontWeight: '600' }}>Text Depth:</label>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <button
                      type="button"
                      className="sample-button"
                      onClick={() => setTextDepth(-0.05)}
                      style={{
                        background: textDepth === -0.05 ? '#000' : '#f5f5f5',
                        color: textDepth === -0.05 ? '#fff' : '#000',
                        flex: 1
                      }}
                    >
                      Deep
                    </button>
                    <button
                      type="button"
                      className="sample-button"
                      onClick={() => setTextDepth(0.25)}
                      style={{
                        background: textDepth === 0.25 ? '#000' : '#f5f5f5',
                        color: textDepth === 0.25 ? '#fff' : '#000',
                        flex: 1
                      }}
                    >
                      Shallow
                    </button>
                  </div>
                </div>

                {/* Text X Offset Slider */}
                <div className="control-group">
                  <label>
                    Text X Offset: <span className="value">{textOffsetX.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min="-0.5"
                    max="0.5"
                    step="0.01"
                    value={textOffsetX}
                    onChange={(e) => setTextOffsetX(parseFloat(e.target.value))}
                    className="slider"
                  />
                  <div className="slider-labels">
                    <span>-0.5</span>
                    <span>0</span>
                    <span>0.5</span>
                  </div>
                </div>

                {/* Text Y Offset Slider */}
                <div className="control-group">
                  <label>
                    Text Y Offset: <span className="value">{textOffsetY.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min="-0.45"
                    max="0.45"
                    step="0.01"
                    value={textOffsetY}
                    onChange={(e) => setTextOffsetY(parseFloat(e.target.value))}
                    className="slider"
                  />
                  <div className="slider-labels">
                    <span>-0.45</span>
                    <span>0</span>
                    <span>0.45</span>
                  </div>
                </div>

                {/* Text Rotation Slider */}
                <div className="control-group">
                  <label>
                    Text Rotation: <span className="value">{textRotation.toFixed(0)}°</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="1"
                    value={textRotation}
                    onChange={(e) => setTextRotation(parseFloat(e.target.value))}
                    className="slider"
                  />
                  <div className="slider-labels">
                    <span>0°</span>
                    <span>180°</span>
                    <span>360°</span>
                  </div>
                </div>

                {/* Show Inscription Preview - Only show in debug mode */}
                {debugMode && (
                  <div className="control-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={showText}
                        onChange={(e) => setShowText(e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: '600' }}>Show Inscription Preview</span>
                    </label>
                  </div>
                )}
              </>
            )}
              </>
            )}

            {/* Advanced Rendering Toggle */}
            <div className="control-group" style={{ marginTop: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useAdvancedRendering}
                  onChange={(e) => setUseAdvancedRendering(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '12px', fontWeight: '600' }}>Advanced Rendering</span>
              </label>
            </div>
          </>
        ) : (
          <>
            {/* Subdivision Level */}
            <div className="control-group" style={{ marginTop: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600' }}>
                Subdivision Level: <span className="value">{subdivisionLevel}</span>
              </label>
              <input
                type="range"
                min="0"
                max="3"
                step="1"
                value={subdivisionLevel}
                onChange={(e) => setSubdivisionLevel(parseInt(e.target.value))}
                className="slider"
              />
              <div className="slider-labels">
                <span>0</span>
                <span>1</span>
                <span>2</span>
                <span>3</span>
              </div>
            </div>
          </>
        )}

        {/* Spacer to push bottom content down */}
        <div style={{ flex: 1 }}></div>

        {/* 邮箱输入 */}
        {!offlineMode && (
        <div className="control-group" style={{ marginTop: '20px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600' }}>Email Address:</label>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="email-input"
          />
        </div>
        )}

        {/* 价格显示 */}
        <div className="price-display">
          <h2>Price: ${price}</h2>
          <p className="price-note">
            {scaleX === 1.0 && scaleY === 1.0 && scaleZ === 1.0
              ? 'Standard Size (1.0×1.0×1.0) - Base Price' 
              : `Volume: ${(scaleX * scaleY * scaleZ).toFixed(2)} (${scaleX.toFixed(2)}×${scaleY.toFixed(2)}×${scaleZ.toFixed(2)})`
            }
          </p>
        </div>

        {/* Offline Mode Controls */}
        {offlineMode && (
            <div className="control-group" style={{ marginTop: '10px' }}>
                <input
                    type="file"
                    accept=".json"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleLoadJson}
                />
                <button
                    className="sample-button"
                    onClick={() => fileInputRef.current.click()}
                    style={{ width: '100%', marginBottom: '10px', background: '#333', color: 'white' }}
                >
                    Load Settings JSON
                </button>
                {confirmationNumber && (
                    <div style={{ fontSize: '12px', marginBottom: '10px', color: 'green' }}>
                        Loaded Order: {confirmationNumber}
                    </div>
                )}
            </div>
        )}

        {/* Order/Upload 按钮 */}
        <button
          className="order-button"
          onClick={handleOrder}
          disabled={isOrdering || (!offlineMode && !email)}
        >
          {isOrdering ? 'Processing & Uploading...' : (offlineMode ? 'Upload Mesh' : 'Order Now ')}
        </button>

        {/* Load JSON Settings - Only show in debug mode */}
        {debugMode && (
          <div className="control-group" style={{ marginTop: '20px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600' }}>Load Settings (JSON):</label>
            <input
              type="file"
              accept=".json"
              onChange={handleLoadJson}
              ref={fileInputRef}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '13px',
                border: '2px solid #ddd',
                borderRadius: '4px',
                marginTop: '4px',
              }}
            />
          </div>
        )}
      </div>

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
            
            {mode === 'original' || mode === 'test' ? (
              objFile ? (
                <>
                  <ModelViewer 
                    objUrl={objFile} 
                    scaleX={mode === 'test' ? 1.0 : scaleX}
                    scaleY={mode === 'test' ? 1.0 : scaleY}
                    scaleZ={mode === 'test' ? 1.0 : scaleZ}
                    twist={twist}
                    booleanSubtract={mode === 'test' ? false : (debugMode || (objFile && objFile.includes('Morpheus')) ? booleanSubtract : false)}
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
                    meshRef={mode === 'test' ? modelMeshRef : null}
                    testModeInscriptions={mode === 'test' ? inscriptions : null}
                    applyInscriptions={false} // We will add a button for this later
                    onInscriptionsApplied={() => console.log('Inscriptions applied')}
                  />
                  <ClipMesh visible={showClip} />
                  
                  {/* Surface Inscription for Test Mode - Multiple Inscriptions */}
                  {mode === 'test' && (
                    <>
                      {/* Raycaster to place inscriptions */}
                      <SurfaceInscription
                        meshRef={modelMeshRef}
                        enabled={true}
                        inscriptionText={getSelectedInscription()?.text || 'Text'}
                        textScale={getSelectedInscription()?.scale || 0.08}
                        textRotation={getSelectedInscription()?.rotation || 0}
                        textDepth={getSelectedInscription()?.depth || 0.02}
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
                            clickData={inscription.clickData}
                            showMarker={showMarker && selectedInscriptionId === inscription.id}
                            showText={showTestText}
                            showTextMesh={showTextMesh}
                            conformToSurface={conformToSurface}
                            showUVMap={showUVMap && selectedInscriptionId === inscription.id}
                            onInscriptionPlaced={null}
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
