import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import MorpheusModel from './components/Scene/MorpheusModel';
import SurfaceRaycaster from './components/SurfaceInscription/SurfaceRaycaster';
import ClickMarker from './components/SurfaceInscription/ClickMarker';
import UVTextMapper from './components/SurfaceInscription/UVTextMapper';
import UVPanel from './components/UI/UVPanel';
import ControlPanel from './components/UI/ControlPanel';
import { subtractGeometry } from './utils/csgUtils';
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
      />

      {/* 3D Canvas */}
      <div className="canvas-container">
        <Canvas camera={{ position: [0, 0, 280], fov: 20 }}>
          <color attach="background" args={['#fafafa']} />
          
          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <directionalLight position={[-10, -10, -5]} intensity={0.5} />
          
          {/* Model */}
          <MorpheusModel ref={morpheusRef} onUVDataReady={handleUVDataReady} onModelReady={handleModelReady} />
          
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
      </div>
    </div>
  );
}

export default App;
