import React, { useState, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import MorpheusModel from './components/Scene/MorpheusModel';
import SurfaceRaycaster from './components/SurfaceInscription/SurfaceRaycaster';
import ClickMarker from './components/SurfaceInscription/ClickMarker';
import UVGridMapper from './components/SurfaceInscription/UVGridMapper';
import UVPanel from './components/UI/UVPanel';
import './App.css';

function App() {
  // Click data from surface
  const [clickData, setClickData] = useState(null);
  
  // UV data extracted from model
  const [uvData, setUVData] = useState(null);
  
  // Grid data (2D UV points and 3D mapped points)
  const [gridData, setGridData] = useState(null);
  
  // Mesh reference
  const morpheusRef = useRef(null);

  const handleSurfaceClick = useCallback((data) => {
    console.log('📍 Surface clicked:', data);
    console.log('   UV:', data.uv);
    console.log('   Point:', data.point);
    console.log('   Tangent:', data.tangent);
    setClickData(data);
    setGridData(null); // Reset grid on new click
  }, []);

  const handleUVDataReady = useCallback((data) => {
    console.log('📐 UV Data ready:', data.vertices.length, 'vertices');
    setUVData(data);
  }, []);

  const handleGridReady = useCallback((data) => {
    console.log('🔢 Grid ready:', data.uvPoints.length, 'points');
    setGridData(data);
  }, []);

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
          
          {/* UV Grid Mapper - computes and renders 3D grid points */}
          {clickData && clickData.uvTangent && (
            <UVGridMapper
              clickData={clickData}
              meshRef={morpheusRef}
              gridSize={5}
              gridSpacing={0.02}
              onGridReady={handleGridReady}
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
        />
      </div>
    </div>
  );
}

export default App;
