import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, N8AO } from '@react-three/postprocessing';
import * as THREE from 'three';
import MorpheusModel from './components/Scene/MorpheusModel';
import ClipModel from './components/Scene/ClipModel';
import SurfaceRaycaster from './components/SurfaceInscription/SurfaceRaycaster';
import ClickMarker from './components/SurfaceInscription/ClickMarker';
import UVTextMapper from './components/SurfaceInscription/UVTextMapper';
import UVPanel from './components/UI/UVPanel';
import ControlPanel from './components/UI/ControlPanel';
import { subtractGeometry } from './utils/csgUtils';
import { downloadSTL, uploadToGoogleDrive, generateGUID } from './utils/stlExporter';
import './App.css';

// Generate unique ID
let inscriptionIdCounter = 1;
const generateId = () => `inscription-${inscriptionIdCounter++}`;

// Available fonts
const AVAILABLE_FONTS = [
  { id: 'helvetiker', name: 'Helvetica', url: 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json' },
  { id: 'gentilis', name: 'Garamond', url: 'https://threejs.org/examples/fonts/gentilis_regular.typeface.json' },
  { id: 'optimer', name: 'Optimer', url: 'https://threejs.org/examples/fonts/optimer_regular.typeface.json' },
  { id: 'droid_sans', name: 'Droid Sans', url: 'https://threejs.org/examples/fonts/droid/droid_sans_regular.typeface.json' },
  { id: 'droid_serif', name: 'Droid Serif', url: 'https://threejs.org/examples/fonts/droid/droid_serif_regular.typeface.json' }
];

// Default inscription values
const createDefaultInscription = () => ({
  id: generateId(),
  text: 'Botai',
  scale: 0.01,
  depth: 0.5,
  font: 'helvetiker',
  rotation: 0,
  clickData: null,
  geometry: null
});

function App() {
  // Inscriptions list
  const [inscriptions, setInscriptions] = useState([createDefaultInscription()]);
  const [selectedInscriptionId, setSelectedInscriptionId] = useState(inscriptions[0].id);
  
  // UV data extracted from model
  const [uvData, setUVData] = useState(null);
  
  // Whether CSG has been applied
  const [isCarved, setIsCarved] = useState(false);
  
  // Warning for out of bounds text
  const [uvWarnings, setUvWarnings] = useState({}); // { inscriptionId: { outOfBounds: bool, count: number } }
  
  // Display settings
  const [showMarker, setShowMarker] = useState(true);
  const [showArrows, setShowArrows] = useState(false);
  const [showTextMesh, setShowTextMesh] = useState(true);
  const [showUVPanel, setShowUVPanel] = useState(true);
  const [showClipModel, setShowClipModel] = useState(true);
  
  // Order state
  const [email, setEmail] = useState('');
  const [isOrdering, setIsOrdering] = useState(false);
  
  // Mesh reference
  const morpheusRef = useRef(null);
  
  // Store original geometry for reset
  const originalGeometryRef = useRef(null);
  
  // Store last valid clickData for each inscription (to restore if new click goes out of bounds)
  const lastValidClickDataRef = useRef({});

  // Get selected inscription
  const selectedInscription = useMemo(() => 
    inscriptions.find(i => i.id === selectedInscriptionId),
    [inscriptions, selectedInscriptionId]
  );

  // Handle surface click - assign to selected inscription
  const handleSurfaceClick = useCallback((data) => {
    if (isCarved) return; // Don't allow clicks after carving
    
    console.log('📍 Surface clicked:', data);
    
    // Clear any reverted warning when user clicks again
    setUvWarnings(prev => {
      const current = prev[selectedInscriptionId];
      if (current?.reverted) {
        return { ...prev, [selectedInscriptionId]: null };
      }
      return prev;
    });
    
    setInscriptions(prev => prev.map(inscription => 
      inscription.id === selectedInscriptionId
        ? { ...inscription, clickData: data, geometry: null }
        : inscription
    ));
  }, [selectedInscriptionId, isCarved]);

  // Handle UV data ready from model
  const handleUVDataReady = useCallback((data) => {
    console.log('📐 UV Data ready:', data.vertices.length, 'vertices');
    setUVData(data);
  }, []);

  // Handle model ready - store original geometry for reset
  const handleModelReady = useCallback((geometry) => {
    originalGeometryRef.current = geometry;
    console.log('💾 Original geometry stored:', geometry.attributes.position.count, 'vertices');
  }, []);

  // Handle text geometry ready from UVTextMapper
  const handleTextGeometryReady = useCallback((inscriptionId, data) => {
    console.log('📝 Text geometry ready for', inscriptionId);
    
    setInscriptions(prev => prev.map(inscription => 
      inscription.id === inscriptionId
        ? { ...inscription, geometry: data.geometry }
        : inscription
    ));
  }, []);

  // Handle out of bounds warning from UVTextMapper
  const handleOutOfBounds = useCallback((inscriptionId, isOutOfBounds, unmappedCount) => {
    if (isOutOfBounds) {
      // Restore previous valid position if it exists
      const lastValid = lastValidClickDataRef.current[inscriptionId];
      if (lastValid) {
        console.log('🔄 Restoring previous valid position for', inscriptionId);
        // Set warning with reverted flag - this will persist after revert
        setUvWarnings(prev => ({
          ...prev,
          [inscriptionId]: { outOfBounds: true, count: unmappedCount, reverted: true }
        }));
        setInscriptions(prev => prev.map(inscription => 
          inscription.id === inscriptionId
            ? { ...inscription, clickData: lastValid, geometry: null }
            : inscription
        ));
      } else {
        // No previous valid position, show warning
        setUvWarnings(prev => ({
          ...prev,
          [inscriptionId]: { outOfBounds: true, count: unmappedCount, reverted: false }
        }));
        // Clear geometry
        setInscriptions(prev => prev.map(inscription => 
          inscription.id === inscriptionId
            ? { ...inscription, geometry: null }
            : inscription
        ));
      }
    } else {
      // Only clear warning if it wasn't a reverted state
      setUvWarnings(prev => {
        const current = prev[inscriptionId];
        // If we just reverted, keep the warning visible
        if (current?.reverted) {
          return prev;
        }
        return { ...prev, [inscriptionId]: null };
      });
      
      // Store this as the last valid position
      const inscription = inscriptions.find(i => i.id === inscriptionId);
      if (inscription?.clickData) {
        lastValidClickDataRef.current[inscriptionId] = inscription.clickData;
        console.log('✅ Stored valid position for', inscriptionId);
      }
    }
  }, [inscriptions]);

  // Update inscription
  const updateInscription = useCallback((id, updates) => {
    setInscriptions(prev => prev.map(inscription => 
      inscription.id === id
        ? { ...inscription, ...updates, geometry: null } // Reset geometry on any change
        : inscription
    ));
  }, []);

  // Delete inscription
  const deleteInscription = useCallback((id) => {
    // Clean up stored valid position
    delete lastValidClickDataRef.current[id];
    
    setInscriptions(prev => {
      const newList = prev.filter(i => i.id !== id);
      // If we deleted the selected one, select the first
      if (id === selectedInscriptionId && newList.length > 0) {
        setSelectedInscriptionId(newList[0].id);
      }
      return newList.length > 0 ? newList : [createDefaultInscription()];
    });
  }, [selectedInscriptionId]);

  // Add new inscription
  const addInscription = useCallback(() => {
    const newInscription = createDefaultInscription();
    setInscriptions(prev => [...prev, newInscription]);
    setSelectedInscriptionId(newInscription.id);
  }, []);

  // Apply all inscriptions (CSG subtraction)
  const handleApplyInscriptions = useCallback(() => {
    if (!morpheusRef.current) {
      console.warn('⚠️ No mesh reference');
      return;
    }

    // Get inscriptions with geometry
    const inscriptionsWithGeometry = inscriptions.filter(i => i.geometry);
    
    if (inscriptionsWithGeometry.length === 0) {
      console.warn('⚠️ No inscription geometries ready');
      return;
    }

    console.log('🔪 Applying', inscriptionsWithGeometry.length, 'inscriptions...');

    // Find the mesh
    let targetMesh = null;
    morpheusRef.current.traverse((child) => {
      if (child.isMesh && !targetMesh) {
        targetMesh = child;
      }
    });

    if (!targetMesh) {
      console.error('❌ No mesh found');
      return;
    }

    // Get base geometry in world space
    let resultGeometry = targetMesh.geometry.clone();
    resultGeometry.applyMatrix4(targetMesh.matrixWorld);

    // Subtract each inscription
    for (const inscription of inscriptionsWithGeometry) {
      console.log(`   Subtracting: "${inscription.text}"`);
      resultGeometry = subtractGeometry(resultGeometry, inscription.geometry);
    }

    // Transform back to local space
    const inverseMatrix = new THREE.Matrix4().copy(targetMesh.matrixWorld).invert();
    resultGeometry.applyMatrix4(inverseMatrix);

    // Replace the mesh geometry
    targetMesh.geometry.dispose();
    targetMesh.geometry = resultGeometry;

    setIsCarved(true);
    setShowTextMesh(false); // Hide text meshes after carving
    console.log('✅ All inscriptions applied!');
  }, [inscriptions]);

  // Reset to original mesh
  const handleReset = useCallback(() => {
    if (!morpheusRef.current || !originalGeometryRef.current) {
      console.warn('⚠️ Cannot reset: no original geometry');
      return;
    }

    console.log('↺ Resetting to original mesh...');

    // Find the mesh and restore original geometry
    morpheusRef.current.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        child.geometry = originalGeometryRef.current.clone();
      }
    });

    // Reset state
    const newInscription = createDefaultInscription();
    setInscriptions([newInscription]);
    setSelectedInscriptionId(newInscription.id);
    setIsCarved(false);
    setShowTextMesh(true);

    console.log('✅ Reset complete');
  }, []);

  // Handle STL download
  const handleDownloadSTL = useCallback(() => {
    if (!morpheusRef.current) {
      alert('No model available.');
      return;
    }

    // Find the mesh
    let targetMesh = null;
    morpheusRef.current.traverse((child) => {
      if (child.isMesh && !targetMesh) {
        targetMesh = child;
      }
    });

    if (!targetMesh || !targetMesh.geometry) {
      alert('No geometry available.');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `botai_inscription_${timestamp}.stl`;

    try {
      downloadSTL(targetMesh.geometry, filename);
    } catch (error) {
      console.error('Download failed:', error);
      alert(`Download failed: ${error.message}`);
    }
  }, []);

  // Handle order submission
  const handleOrder = useCallback(async () => {
    if (!email || !email.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    if (!morpheusRef.current) {
      alert('No model available.');
      return;
    }

    // Find the mesh
    let targetMesh = null;
    morpheusRef.current.traverse((child) => {
      if (child.isMesh && !targetMesh) {
        targetMesh = child;
      }
    });

    if (!targetMesh || !targetMesh.geometry) {
      alert('No geometry available.');
      return;
    }

    setIsOrdering(true);

    try {
      // Generate confirmation number
      const guid = generateGUID();
      const confirmationNumber = guid.substring(0, 8);
      
      // Build product name
      const productName = `Botai Custom Inscription-${confirmationNumber}`;
      const price = 60; // Base price
      
      console.log('Creating Order:', {
        guid,
        productName,
        price,
        email
      });

      // Build complete inscription data for JSON
      const orderData = {
        confirmationNumber,
        email,
        timestamp: new Date().toISOString(),
        inscriptions: inscriptions.map(i => ({
          id: i.id,
          text: i.text,
          scale: i.scale,
          depth: i.depth,
          font: i.font,
          rotation: i.rotation,
          clickData: i.clickData ? {
            point: { x: i.clickData.point.x, y: i.clickData.point.y, z: i.clickData.point.z },
            normal: { x: i.clickData.normal.x, y: i.clickData.normal.y, z: i.clickData.normal.z },
            uv: { x: i.clickData.uv.x, y: i.clickData.uv.y },
            faceIndex: i.clickData.faceIndex,
            tangent: i.clickData.tangent ? { x: i.clickData.tangent.x, y: i.clickData.tangent.y, z: i.clickData.tangent.z } : null,
            bitangent: i.clickData.bitangent ? { x: i.clickData.bitangent.x, y: i.clickData.bitangent.y, z: i.clickData.bitangent.z } : null,
            uvTangent: i.clickData.uvTangent ? { x: i.clickData.uvTangent.x, y: i.clickData.uvTangent.y } : null,
            uvBitangent: i.clickData.uvBitangent ? { x: i.clickData.uvBitangent.x, y: i.clickData.uvBitangent.y } : null
          } : null
        }))
      };
      
      console.log('📤 Uploading order JSON...');
      await uploadToGoogleDrive(JSON.stringify(orderData, null, 2), `order_${confirmationNumber}.json`);
      console.log('✅ Order JSON uploaded');

      // Call Shopify API
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
      
      // Redirect to Shopify checkout
      if (data.checkoutUrl) {
        console.log('Redirecting to Shopify:', data.checkoutUrl);
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('Failed to get Shopify URL');
      }

    } catch (error) {
      console.error('Order Failed:', error);
      alert('Order failed: ' + error.message);
      setIsOrdering(false);
    }
  }, [email, inscriptions]);

  return (
    <div className="app-container">
      {/* Left Control Panel */}
      <ControlPanel
        inscriptions={inscriptions}
        selectedInscriptionId={selectedInscriptionId}
        setSelectedInscriptionId={setSelectedInscriptionId}
        updateInscription={updateInscription}
        deleteInscription={deleteInscription}
        addInscription={addInscription}
        onApplyInscriptions={handleApplyInscriptions}
        onReset={handleReset}
        isCarved={isCarved}
        uvWarnings={uvWarnings}
        showMarker={showMarker}
        setShowMarker={setShowMarker}
        showArrows={showArrows}
        setShowArrows={setShowArrows}
        showTextMesh={showTextMesh}
        setShowTextMesh={setShowTextMesh}
        showUVPanel={showUVPanel}
        setShowUVPanel={setShowUVPanel}
        showClipModel={showClipModel}
        setShowClipModel={setShowClipModel}
        onDownloadSTL={handleDownloadSTL}
        email={email}
        setEmail={setEmail}
        onOrder={handleOrder}
        isOrdering={isOrdering}
      />

      {/* 3D Canvas */}
      <div className="canvas-container">
        <Canvas camera={{ position: [0, 0, 280], fov: 20 }}>
          <color attach="background" args={['#fafafa']} />
          
          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <directionalLight position={[-10, -10, -5]} intensity={0.5} />
          
          {/* Models */}
          <MorpheusModel ref={morpheusRef} onUVDataReady={handleUVDataReady} onModelReady={handleModelReady} />
          <ClipModel visible={showClipModel} />
          
          {/* Surface interaction */}
          <SurfaceRaycaster 
            meshRef={morpheusRef}
            onSurfaceClick={handleSurfaceClick}
            enabled={!isCarved}
          />
          
          {/* Click markers for all placed inscriptions */}
          {showMarker && inscriptions.map(inscription => 
            inscription.clickData && (
              <ClickMarker
                key={`marker-${inscription.id}`}
                position={inscription.clickData.point}
                normal={inscription.clickData.normal}
                tangent={inscription.clickData.tangent}
                bitangent={inscription.clickData.bitangent}
                isSelected={inscription.id === selectedInscriptionId}
                showArrows={showArrows}
              />
            )
          )}
          
          {/* Text meshes for all placed inscriptions */}
          {showTextMesh && !isCarved && inscriptions.map(inscription => 
            inscription.clickData && inscription.clickData.uvTangent && (
              <UVTextMapper
                key={`text-${inscription.id}`}
                clickData={inscription.clickData}
                meshRef={morpheusRef}
                text={inscription.text}
                textScale={inscription.scale}
                extrudeDepth={inscription.depth}
                fontId={inscription.font}
                rotation={inscription.rotation}
                availableFonts={AVAILABLE_FONTS}
                onTextDataReady={(data) => handleTextGeometryReady(inscription.id, data)}
                onOutOfBounds={(isOOB, count) => handleOutOfBounds(inscription.id, isOOB, count)}
              />
            )
          )}
          
          {/* Post-processing effects */}
          <EffectComposer>
            <N8AO aoRadius={0.15} intensity={4} distanceFalloff={2} />
          </EffectComposer>
          
          {/* Camera controls */}
          <OrbitControls />
        </Canvas>
        
        {/* 2D UV Panel */}
        {showUVPanel && (
          <UVPanel
            uvData={uvData}
            clickData={selectedInscription?.clickData}
            gridData={null}
            textData={null}
          />
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
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
