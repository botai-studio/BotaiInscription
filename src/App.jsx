import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, N8AO } from '@react-three/postprocessing';
import * as THREE from 'three';
import MorpheusModel from './components/Scene/MorpheusModel';
import LofiModel from './components/Scene/LofiModel';
import ClipModel from './components/Scene/ClipModel';
import SurfaceRaycaster from './components/SurfaceInscription/SurfaceRaycaster';
import ClickMarker from './components/SurfaceInscription/ClickMarker';
import UVTextMapper from './components/SurfaceInscription/UVTextMapper';
import UVPanel from './components/UI/UVPanel';
import ControlPanel from './components/UI/ControlPanel';
import { useTutorial } from './components/UI/Tutorial';
import { subtractGeometry, unionGeometry } from './utils/csgUtils';
import { downloadSTL, uploadToGoogleDrive, generateGUID } from './utils/stlExporter';
import './App.css';

// Generate unique ID
let inscriptionIdCounter = 1;
const generateId = () => `inscription-${inscriptionIdCounter++}`;

// Available fonts (Three.js built-in + Google Fonts via @compai)
const AVAILABLE_FONTS = [
  // Three.js built-in fonts
  { id: 'helvetiker', name: 'Helvetica', url: 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json' },
  { id: 'optimer', name: 'Optimer', url: 'https://threejs.org/examples/fonts/optimer_regular.typeface.json' },
  { id: 'gentilis', name: 'Gentilis', url: 'https://threejs.org/examples/fonts/gentilis_regular.typeface.json' },
  // Google Fonts via @compai (jsdelivr CDN)
  { id: 'roboto', name: 'Roboto', url: 'https://cdn.jsdelivr.net/npm/@compai/font-roboto@0.0.4/data/typefaces/normal-400.json' },
  { id: 'open-sans', name: 'Open Sans', url: 'https://cdn.jsdelivr.net/npm/@compai/font-open-sans@0.0.4/data/typefaces/normal-400.json' },
  { id: 'merriweather', name: 'Merriweather', url: 'https://cdn.jsdelivr.net/npm/@compai/font-merriweather@0.0.4/data/typefaces/normal-400.json' }
];

// Default inscription values
const createDefaultInscription = () => ({
  id: generateId(),
  text: 'Botai',
  scale: 0.015,
  depth: 0.5,
  font: 'helvetiker',
  rotation: 0,
  clickData: null,
  geometry: null
});

function App() {
  // Check URL parameter for mode (dev or prod, default is prod)
  // Check URL parameter for mode (dev or prod, default is prod)
  const devMode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'dev';
  }, []);

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
  
  // Dev settings - default 0.5 in dev mode, 2.0 in prod mode
  const [maxTriangleEdge, setMaxTriangleEdge] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'dev' ? 0.5 : 2.0;
  });
  
  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  
  // Inscribing state
  const [isInscribing, setIsInscribing] = useState(false);
  
  // Hover state for preview dot
  const [hoverData, setHoverData] = useState(null);
  
  // Order state
  const [email, setEmail] = useState('');
  const [isOrdering, setIsOrdering] = useState(false);
  
  // Loaded order confirmation number (from JSON)
  const [loadedConfirmationNumber, setLoadedConfirmationNumber] = useState(null);
  
  // Tutorial
  const tutorial = useTutorial(isLoading);
  
  // Mesh references
  const morpheusRef = useRef(null);  // UV model (always used for raycast/UV mapping)
  const lofiRef = useRef(null);       // Lofi model (visible in prod, receives CSG)
  const clipRef = useRef(null);
  
  // Store original geometry for reset
  const originalGeometryRef = useRef(null);      // For UV model
  const originalLofiGeometryRef = useRef(null);  // For lofi model
  
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

  // Handle model ready - store original geometry for reset (UV model)
  const handleModelReady = useCallback((geometry) => {
    originalGeometryRef.current = geometry;
    console.log('💾 Original UV geometry stored:', geometry.attributes.position.count, 'vertices');
    // In dev mode, loading is done when UV model is ready
    if (devMode) {
      setIsLoading(false);
    }
  }, [devMode]);

  // Handle lofi model ready - store original geometry for reset
  const handleLofiModelReady = useCallback((geometry) => {
    originalLofiGeometryRef.current = geometry;
    console.log('💾 Original Lofi geometry stored:', geometry.attributes.position.count, 'vertices');
    // In prod mode, loading is done when lofi model is ready
    if (!devMode) {
      setIsLoading(false);
    }
  }, [devMode]);

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

  // Apply all inscriptions (CSG subtraction) then union with clip
  const handleApplyInscriptions = useCallback(() => {
    // In prod mode, use lofi model; in dev mode, use UV model
    const targetRef = devMode ? morpheusRef : lofiRef;
    
    if (!targetRef.current) {
      console.warn('⚠️ No mesh reference');
      return;
    }

    // Get inscriptions with geometry
    const inscriptionsWithGeometry = inscriptions.filter(i => i.geometry);
    
    if (inscriptionsWithGeometry.length === 0) {
      console.warn('⚠️ No inscription geometries ready');
      return;
    }

    // Show inscribing overlay
    setIsInscribing(true);
    
    // Use setTimeout to allow UI to update before heavy CSG operations
    setTimeout(() => {
    console.log('🔪 Applying', inscriptionsWithGeometry.length, 'inscriptions...');
    console.log(`   Using ${devMode ? 'UV model (dev)' : 'Lofi model (prod)'}`);    

    // Find the bowtie mesh
    let targetMesh = null;
    targetRef.current.traverse((child) => {
      if (child.isMesh && !targetMesh) {
        targetMesh = child;
      }
    });

    if (!targetMesh) {
      console.error('❌ No bowtie mesh found');
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

    // Union with clip model if available
    if (clipRef.current) {
      let clipMesh = null;
      clipRef.current.traverse((child) => {
        if (child.isMesh && !clipMesh) {
          clipMesh = child;
        }
      });

      if (clipMesh) {
        console.log('🔗 Joining with clip model...');
        // Get clip geometry in world space
        let clipGeometry = clipMesh.geometry.clone();
        clipGeometry.applyMatrix4(clipMesh.matrixWorld);
        
        // Union the carved bowtie with the clip
        // Only simplify in dev mode (prod needs full detail for manufacturing)
        resultGeometry = unionGeometry(resultGeometry, clipGeometry, devMode);
        console.log('✅ Union complete');
      } else {
        console.warn('⚠️ No clip mesh found for union');
      }
    } else {
      console.warn('⚠️ No clip reference for union');
    }

    // Transform back to local space
    const inverseMatrix = new THREE.Matrix4().copy(targetMesh.matrixWorld).invert();
    resultGeometry.applyMatrix4(inverseMatrix);

    // Replace the mesh geometry
    targetMesh.geometry.dispose();
    targetMesh.geometry = resultGeometry;

    setIsCarved(true);
    setShowTextMesh(false); // Hide text meshes after carving
    setShowClipModel(false); // Hide clip model since it's now part of the combined mesh
    setIsInscribing(false); // Hide inscribing overlay
    console.log('✅ All inscriptions applied and joined with clip!');
    }, 50); // Small delay to allow overlay to render
  }, [inscriptions, devMode]);

  // Reset to original mesh
  const handleReset = useCallback(() => {
    // In prod mode, reset lofi model; in dev mode, reset UV model
    const targetRef = devMode ? morpheusRef : lofiRef;
    const originalRef = devMode ? originalGeometryRef : originalLofiGeometryRef;
    
    if (!targetRef.current || !originalRef.current) {
      console.warn('⚠️ Cannot reset: no original geometry');
      return;
    }

    console.log('↺ Resetting to original mesh...');

    // Find the mesh and restore original geometry
    targetRef.current.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        child.geometry = originalRef.current.clone();
      }
    });

    // Reset inscriptions but preserve settings (text, scale, depth, font, rotation)
    setInscriptions(prev => prev.map(inscription => ({
      ...inscription,
      clickData: null,  // Clear position
      geometry: null    // Clear generated geometry
    })));
    
    // Clear stored valid positions
    lastValidClickDataRef.current = {};
    
    // Clear UV warnings
    setUvWarnings({});
    
    // Reset carve state
    setIsCarved(false);
    setShowTextMesh(true);
    setShowClipModel(true); // Show clip model again after reset

    console.log('✅ Reset complete');
  }, [devMode]);

  // Handle STL download
  const handleDownloadSTL = useCallback(() => {
    // In prod mode, use lofi model; in dev mode, use UV model
    const targetRef = devMode ? morpheusRef : lofiRef;
    
    if (!targetRef.current) {
      alert('No model available.');
      return;
    }

    // Find the mesh
    let targetMesh = null;
    targetRef.current.traverse((child) => {
      if (child.isMesh && !targetMesh) {
        targetMesh = child;
      }
    });

    if (!targetMesh || !targetMesh.geometry) {
      alert('No geometry available.');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = loadedConfirmationNumber 
      ? `botai_${loadedConfirmationNumber}.stl`
      : `botai_inscription_${timestamp}.stl`;

    try {
      downloadSTL(targetMesh.geometry, filename);
    } catch (error) {
      console.error('Download failed:', error);
      alert(`Download failed: ${error.message}`);
    }
  }, [devMode, loadedConfirmationNumber]);

  // Handle JSON download (dev mode)
  const handleDownloadJSON = useCallback(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = loadedConfirmationNumber
      ? `botai_${loadedConfirmationNumber}.json`
      : `botai_inscription_${timestamp}.json`;
    
    const jsonData = {
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
    
    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('✅ JSON download initiated');
  }, [inscriptions, loadedConfirmationNumber]);

  // Handle loading JSON settings (dev mode)
  const handleLoadJSON = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        
        if (!jsonData.inscriptions || !Array.isArray(jsonData.inscriptions)) {
          throw new Error('Invalid JSON format: missing inscriptions array');
        }

        // Extract confirmation number from JSON or filename
        // Try from JSON data first (order_XXXXXXXX.json format)
        let confirmNum = jsonData.confirmationNumber;
        if (!confirmNum) {
          // Try to extract from filename (e.g., "order_12345678.json" or "botai_12345678.json")
          const filenameMatch = file.name.match(/(?:order_|botai_)([A-Za-z0-9-]+)(?:_|\.)/) 
                              || file.name.match(/^([A-Za-z0-9-]{6,})\.json$/);
          if (filenameMatch) {
            confirmNum = filenameMatch[1];
          }
        }
        
        if (confirmNum) {
          setLoadedConfirmationNumber(confirmNum);
          console.log('📋 Loaded confirmation number:', confirmNum);
        } else {
          setLoadedConfirmationNumber(null);
        }

        // Convert loaded inscriptions to the app format
        const loadedInscriptions = jsonData.inscriptions.map((i, index) => ({
          id: `inscription-loaded-${index + 1}`,
          text: i.text || 'Botai',
          scale: i.scale || 0.015,
          depth: i.depth || 0.5,
          font: i.font || 'helvetiker',
          rotation: i.rotation || 0,
          clickData: i.clickData ? {
            point: new THREE.Vector3(i.clickData.point.x, i.clickData.point.y, i.clickData.point.z),
            normal: new THREE.Vector3(i.clickData.normal.x, i.clickData.normal.y, i.clickData.normal.z),
            uv: new THREE.Vector2(i.clickData.uv.x, i.clickData.uv.y),
            faceIndex: i.clickData.faceIndex,
            tangent: i.clickData.tangent ? new THREE.Vector3(i.clickData.tangent.x, i.clickData.tangent.y, i.clickData.tangent.z) : null,
            bitangent: i.clickData.bitangent ? new THREE.Vector3(i.clickData.bitangent.x, i.clickData.bitangent.y, i.clickData.bitangent.z) : null,
            uvTangent: i.clickData.uvTangent ? new THREE.Vector2(i.clickData.uvTangent.x, i.clickData.uvTangent.y) : null,
            uvBitangent: i.clickData.uvBitangent ? new THREE.Vector2(i.clickData.uvBitangent.x, i.clickData.uvBitangent.y) : null
          } : null,
          geometry: null
        }));

        setInscriptions(loadedInscriptions);
        setSelectedInscriptionId(loadedInscriptions[0]?.id);
        setIsCarved(false);
        setUvWarnings({});
        
        // Clear stored valid positions
        lastValidClickDataRef.current = {};

        const confirmMsg = confirmNum ? ` (Order: ${confirmNum})` : '';
        console.log('✅ Loaded', loadedInscriptions.length, 'inscriptions from JSON');
        alert(`Loaded ${loadedInscriptions.length} inscription(s) from JSON${confirmMsg}`);
      } catch (error) {
        console.error('Failed to load JSON:', error);
        alert('Failed to load JSON: ' + error.message);
      }
    };
    reader.readAsText(file);
    
    // Reset file input so the same file can be loaded again
    event.target.value = '';
  }, []);

  // Handle order submission
  const handleOrder = useCallback(async () => {
    if (!email || !email.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    // In prod mode, use lofi model; in dev mode, use UV model
    const targetRef = devMode ? morpheusRef : lofiRef;
    
    if (!targetRef.current) {
      alert('No model available.');
      return;
    }

    // Find the mesh
    let targetMesh = null;
    targetRef.current.traverse((child) => {
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
      
      // Calculate price: base $88 + $1 per character
      const totalCharacters = inscriptions.reduce((sum, i) => sum + (i.text?.length || 0), 0);
      const price = 88 + totalCharacters;
      
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
  }, [email, inscriptions, devMode]);

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
        maxTriangleEdge={maxTriangleEdge}
        setMaxTriangleEdge={setMaxTriangleEdge}
        onDownloadSTL={handleDownloadSTL}
        onDownloadJSON={handleDownloadJSON}
        onLoadJSON={handleLoadJSON}
        email={email}
        setEmail={setEmail}
        onOrder={handleOrder}
        isOrdering={isOrdering}
        devMode={devMode}
      />

      {/* 3D Canvas */}
      <div className="canvas-container">
        <Canvas camera={{ position: [0, 0, 380], fov: 20 }}>
          <color attach="background" args={['#fafafa']} />
          
          {/* Lighting */}
          <ambientLight intensity={0.3} />
          <directionalLight position={[0, 0, 10]} intensity={1} />
          {/* <directionalLight position={[-10, -10, -5]} intensity={0.5} /> */}
          {/* Rim light from behind to highlight carved edges */}
          <directionalLight position={[0, 0, -10]} intensity={0.8} color="#ffffff" />
          {/* <directionalLight position={[5, -5, -8]} intensity={0.4} color="#e0e0ff" /> */}
          
          {/* Models */}
          {/* UV Model - always loaded for UV mapping/raycasting, visible only in dev mode */}
          <MorpheusModel 
            ref={morpheusRef} 
            onUVDataReady={handleUVDataReady} 
            onModelReady={handleModelReady}
            visible={devMode}  
          />
          
          {/* Lofi Model - loaded and visible only in prod mode, receives CSG operations */}
          {!devMode && (
            <LofiModel 
              ref={lofiRef} 
              onModelReady={handleLofiModelReady}
              visible={true}
            />
          )}
          
          <ClipModel ref={clipRef} visible={showClipModel} />
          
          {/* Surface interaction - always uses UV model for raycasting */}
          <SurfaceRaycaster 
            meshRef={morpheusRef}
            onSurfaceClick={handleSurfaceClick}
            onHover={setHoverData}
            enabled={!isCarved}
          />
          
          {/* Hover preview dot */}
          {hoverData && !isCarved && (
            <mesh position={hoverData.point.clone().addScaledVector(hoverData.normal, 0.1)}>
              <sphereGeometry args={[0.3, 16, 16]} />
              <meshBasicMaterial color="#4a90d9" opacity={0.7} transparent />
            </mesh>
          )}
          
          {/* Click markers for all placed inscriptions */}
          {showMarker && !isCarved && inscriptions.map(inscription => 
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
                maxTriangleSize={maxTriangleEdge}
                onTextDataReady={(data) => handleTextGeometryReady(inscription.id, data)}
                onOutOfBounds={(isOOB, count) => handleOutOfBounds(inscription.id, isOOB, count)}
              />
            )
          )}
          
          {/* Post-processing effects - Strong AO for visible inscriptions */}
          <EffectComposer>
            <N8AO 
              aoRadius={0.8} 
              intensity={3} 
              distanceFalloff={1} 
              color="black"
              aoSamples={16}
              denoiseSamples={8}
            />
          </EffectComposer>
          
          {/* Camera controls */}
          <OrbitControls />
        </Canvas>
        
        {/* 2D UV Panel - only in dev mode */}
        {devMode && showUVPanel && (
          <UVPanel
            uvData={uvData}
            clickData={selectedInscription?.clickData}
            gridData={null}
            textData={null}
          />
        )}
        
        {/* Loading overlay */}
        {isLoading && (
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
            zIndex: 1001
          }}>
            <div className="upload-icon">
              {/* Ring only - no arrow */}
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginTop: '10px'
            }}>
              Loading Botai...
            </div>
          </div>
        )}
        
        {/* Inscribing overlay */}
        {isInscribing && (
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
            zIndex: 1000
          }}>
            <div className="upload-icon">
              {/* Ring only - no arrow */}
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginTop: '10px'
            }}>
              Inscribing...
            </div>
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
          </div>
        )}
        
        {/* Tutorial help button (inside canvas) */}
        {tutorial.helpButton}
      </div>
      
      {/* Tutorial overlay */}
      {tutorial.overlay}
    </div>
  );
}

export default App;
