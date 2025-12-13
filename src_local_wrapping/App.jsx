import React, { useState, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import MorpheusModel from './components/Scene/MorpheusModel';
import ClipModel from './components/Scene/ClipModel';
import SurfaceRaycaster from './components/SurfaceInscription/SurfaceRaycaster';
import ClickMarker from './components/SurfaceInscription/ClickMarker';
import GridMapper from './components/SurfaceInscription/GridMapper';
import TextSurfaceMapper from './components/SurfaceInscription/TextSurfaceMapper';
import ControlPanel from './components/UI/ControlPanel';
import GridTestPanel from './components/UI/GridTestPanel';
import { subtractGeometries, getMergedGeometry } from './utils/csgOperations';
import './App.css';

// Centralized grid size constant (in 3D units)
const GRID_SIZE = 40;

function App() {
  // Inscription parameters
  const [inscriptionText, setInscriptionText] = useState('Botai');
  const [textScale, setTextScale] = useState(5);
  const [clickMarkerScale, setClickMarkerScale] = useState(0.1);
  const [textRotation, setTextRotation] = useState(0);
  const [gridDensityX, setGridDensityX] = useState(50);
  const [gridDensityY, setGridDensityY] = useState(10);
  const [extrusionDepth, setExtrusionDepth] = useState(0.5);
  
  // Click data
  const [clickData, setClickData] = useState(null);
  
  // Visibility toggles
  const [showMarker, setShowMarker] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showText3D, setShowText3D] = useState(true);
  
  // Grid data for text mapping
  const [gridData, setGridData] = useState(null);
  
  // Text geometry for CSG
  const [textGeometry, setTextGeometry] = useState(null);
  
  // CSG result
  const [resultGeometry, setResultGeometry] = useState(null);
  const [isInscribing, setIsInscribing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  
  // Mesh references
  const morpheusRef = useRef(null);
  const clipRef = useRef(null);

  const handleSurfaceClick = (data) => {
    console.log('📍 Surface clicked:', data);
    setClickData(data);
    setGridData(null); // Reset grid data on new click
  };

  const handleGridReady = useCallback((data) => {
    setGridData(data);
  }, []);

  const handleTextGeometryReady = useCallback((geometry) => {
    setTextGeometry(geometry);
  }, []);

  const handleInscribe = useCallback(() => {
    if (!morpheusRef.current || !textGeometry) {
      console.error('Missing morpheus model or text geometry');
      return;
    }

    setIsInscribing(true);
    
    // Use setTimeout to allow UI to update before heavy computation
    setTimeout(() => {
      try {
        console.log('🎯 Starting inscription...');
        
        // Get morpheus geometry
        const morpheusGeometry = getMergedGeometry(morpheusRef.current);
        console.log('   Got morpheus geometry');
        
        // Perform CSG subtraction
        const result = subtractGeometries(morpheusGeometry, textGeometry);
        
        setResultGeometry(result);
        setShowResult(true);
        
        console.log('✅ Inscription complete!');
        
        // Clean up temporary geometry
        morpheusGeometry.dispose();
      } catch (error) {
        console.error('❌ Inscription failed:', error);
        alert('Inscription failed: ' + error.message);
      } finally {
        setIsInscribing(false);
      }
    }, 50);
  }, [textGeometry]);

  return (
    <div className="app-container">
      <ControlPanel
        inscriptionText={inscriptionText}
        setInscriptionText={setInscriptionText}
        textScale={textScale}
        setTextScale={setTextScale}
        textRotation={textRotation}
        setTextRotation={setTextRotation}
        gridDensityX={gridDensityX}
        setGridDensityX={setGridDensityX}
        gridDensityY={gridDensityY}
        setGridDensityY={setGridDensityY}
        extrusionDepth={extrusionDepth}
        setExtrusionDepth={setExtrusionDepth}
        showMarker={showMarker}
        setShowMarker={setShowMarker}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        showText3D={showText3D}
        setShowText3D={setShowText3D}
        showResult={showResult}
        setShowResult={setShowResult}
        onInscribe={handleInscribe}
        canInscribe={!!textGeometry && !!clickData}
        isInscribing={isInscribing}
      />
      
      <div className="canvas-container">
        <Canvas camera={{ position: [0, 0, 280], fov: 20 }}>
          <color attach="background" args={['#fafafa']} />
          
          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <directionalLight position={[-10, -10, -5]} intensity={0.5} />
          
          {/* Original Model - hide when showing result */}
          <group visible={!showResult}>
            <MorpheusModel ref={morpheusRef} />
          </group>
          <ClipModel ref={clipRef} />
          
          {/* Surface interaction */}
          <SurfaceRaycaster 
            meshRef={morpheusRef}
            onSurfaceClick={handleSurfaceClick}
            enabled={true}
          />
          
          {/* Click marker */}
          {clickData && showMarker && (
            <ClickMarker
              position={clickData.point}
              normal={clickData.normal}
              tangent={clickData.tangent}
              bitangent={clickData.bitangent}
              clickMarkerScale={clickMarkerScale}
            />
          )}
          
          {/* Grid mapping - always compute when clicked, visibility controlled separately */}
          {clickData && (
            <GridMapper
              clickData={clickData}
              textScale={textScale}
              textRotation={textRotation}
              gridDensityX={gridDensityX}
              gridDensityY={gridDensityY}
              gridSize={GRID_SIZE}
              targetMesh={morpheusRef}
              onGridReady={handleGridReady}
              showPoints={showGrid}
            />
          )}
          
          {/* 3D Text on surface */}
          {clickData && showText3D && gridData && (
            <TextSurfaceMapper
              gridData={gridData}
              inscriptionText={inscriptionText}
              textScale={textScale}
              extrusionDepth={extrusionDepth}
              visible={showText3D}
              onGeometryReady={handleTextGeometryReady}
            />
          )}
          
          {/* CSG Result mesh */}
          {showResult && resultGeometry && (
            <mesh geometry={resultGeometry}>
              <meshStandardMaterial 
                color={0xcccccc}
                metalness={0.1}
                roughness={0.6}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
          
          {/* Camera controls */}
          <OrbitControls />
        </Canvas>
        
        {/* 2D Grid test panel */}
        <GridTestPanel
          clickData={clickData}
          inscriptionText={inscriptionText}
          textScale={textScale}
          textRotation={textRotation}
          gridDensityX={gridDensityX}
          gridDensityY={gridDensityY}
          gridSize={GRID_SIZE}
        />
      </div>
    </div>
  );
}

export default App;
