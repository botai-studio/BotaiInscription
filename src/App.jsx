import React, { useState, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import MorpheusModel from './components/Scene/MorpheusModel';
import SurfaceRaycaster from './components/SurfaceInscription/SurfaceRaycaster';
import ClickMarker from './components/SurfaceInscription/ClickMarker';
import UVTextMapper from './components/SurfaceInscription/UVTextMapper';
import UVPanel from './components/UI/UVPanel';
import { subtractGeometry } from './utils/csgUtils';
import './App.css';

function App() {
  // Click data from surface
  const [clickData, setClickData] = useState(null);
  
  // UV data extracted from model
  const [uvData, setUVData] = useState(null);
  
  // Grid data (2D UV points and 3D mapped points)
  const [gridData, setGridData] = useState(null);
  
  // Text data (2D UV vertices and 3D mapped vertices)
  const [textData, setTextData] = useState(null);
  
  // Text geometry for CSG
  const [textGeometry, setTextGeometry] = useState(null);
  
  // Whether CSG has been applied
  const [csgApplied, setCsgApplied] = useState(false);
  
  // Mesh reference
  const morpheusRef = useRef(null);

  const handleSurfaceClick = useCallback((data) => {
    console.log('📍 Surface clicked:', data);
    console.log('   UV:', data.uv);
    console.log('   Point:', data.point);
    console.log('   Tangent:', data.tangent);
    setClickData(data);
    setGridData(null); // Reset grid on new click
    setTextData(null); // Reset text on new click
  }, []);

  const handleUVDataReady = useCallback((data) => {
    console.log('📐 UV Data ready:', data.vertices.length, 'vertices');
    setUVData(data);
  }, []);

  const handleGridReady = useCallback((data) => {
    console.log('🔢 Grid ready:', data.uvPoints.length, 'points');
    setGridData(data);
  }, []);

  const handleTextDataReady = useCallback((data) => {
    console.log('📝 Text ready:', data.uvVertices.length, 'vertices,', data.triangles.length, 'triangles');
    setTextData(data);
    // Store the geometry for CSG
    if (data.geometry) {
      setTextGeometry(data.geometry);
    }
  }, []);

  // Apply CSG boolean subtraction
  const handleApplyCSG = useCallback(() => {
    if (!morpheusRef.current || !textGeometry) {
      console.warn('⚠️ Cannot apply CSG: missing mesh or text geometry');
      return;
    }

    console.log('🔪 Applying CSG subtraction...');

    // Find the mesh in the group
    let targetMesh = null;
    morpheusRef.current.traverse((child) => {
      if (child.isMesh && !targetMesh) {
        targetMesh = child;
      }
    });

    if (!targetMesh) {
      console.error('❌ No mesh found in model');
      return;
    }

    // Get base geometry in world space
    const baseGeometry = targetMesh.geometry.clone();
    baseGeometry.applyMatrix4(targetMesh.matrixWorld);

    // Perform CSG subtraction
    const resultGeometry = subtractGeometry(baseGeometry, textGeometry);

    // Transform back to local space
    const inverseMatrix = new THREE.Matrix4().copy(targetMesh.matrixWorld).invert();
    resultGeometry.applyMatrix4(inverseMatrix);

    // Replace the mesh geometry
    targetMesh.geometry.dispose();
    targetMesh.geometry = resultGeometry;

    setCsgApplied(true);
    console.log('✅ CSG applied successfully!');
  }, [textGeometry]);

  return (
    <div className="app-container">
      <div className="canvas-container">
        <Canvas camera={{ position: [0, 0, 280], fov: 20 }}>
          <color attach="background" args={['#fafafa']} />
          
          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <directionalLight position={[-10, -10, -5]} intensity={0.5} />
          
          {/* Model */}
          <MorpheusModel ref={morpheusRef} onUVDataReady={handleUVDataReady} />
          
          {/* Surface interaction */}
          <SurfaceRaycaster 
            meshRef={morpheusRef}
            onSurfaceClick={handleSurfaceClick}
            enabled={true}
          />
          
          {/* Click marker */}
          {clickData && (
            <ClickMarker
              position={clickData.point}
              normal={clickData.normal}
              tangent={clickData.tangent}
              bitangent={clickData.bitangent}
            />
          )}
          
          {/* UV Text Mapper - generates text in UV space and maps to 3D */}
          {clickData && clickData.uvTangent && (
            <UVTextMapper
              clickData={clickData}
              meshRef={morpheusRef}
              text="Roger"
              uvScale={0.01}
              onTextDataReady={handleTextDataReady}
            />
          )}
          
          {/* Camera controls */}
          <OrbitControls />
        </Canvas>
        
        {/* 2D UV Panel */}
        <UVPanel
          uvData={uvData}
          clickData={clickData}
          gridData={gridData}
          textData={textData}
        />

        {/* Control Panel */}
        <div style={{
          position: 'absolute',
          top: 20,
          left: 20,
          background: 'rgba(255,255,255,0.95)',
          padding: '15px',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          fontFamily: 'sans-serif',
          fontSize: '13px',
          minWidth: '200px'
        }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>🔤 Text Inscription</h3>
          
          <div style={{ marginBottom: '10px', color: '#666' }}>
            {!clickData && 'Click on the model to place text'}
            {clickData && !textGeometry && 'Generating text mesh...'}
            {clickData && textGeometry && !csgApplied && 'Text ready for carving'}
            {csgApplied && '✅ Text carved!'}
          </div>

          <button
            onClick={handleApplyCSG}
            disabled={!textGeometry || csgApplied}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: textGeometry && !csgApplied ? 'pointer' : 'not-allowed',
              background: textGeometry && !csgApplied ? '#ff6600' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              transition: 'background 0.2s'
            }}
          >
            🔪 Apply Carving
          </button>

          {textData && (
            <div style={{ marginTop: '10px', fontSize: '11px', color: '#888' }}>
              Vertices: {textData.uvVertices.length}<br/>
              Triangles: {textData.triangles.length}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
