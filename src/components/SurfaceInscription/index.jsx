import React from 'react';
import ClickMarker from './ClickMarker';
import SurfaceRaycaster from './SurfaceRaycaster';
import SurfaceText from './SurfaceText';
import SurfaceTextMesh from './SurfaceTextMesh';
import UVMapVisualization from './UVMapVisualization';

// Main exported component
export default function SurfaceInscription({ 
  meshRef, 
  enabled = true,
  inscriptionText = 'Botai',
  textScale = 0.1,
  textRotation = 0,
  textDepth = 0.02,
  clickData = null,
  showMarker = true,
  showText = true,
  showTextMesh = false,
  conformToSurface = true,
  showUVMap = false,
  onInscriptionPlaced = null,
  onTextMeshGeometryReady = null // Callback when text mesh geometry is ready
}) {
  const handleSurfaceClick = (data) => {
    console.log('📍 Inscription placement point updated');
    
    if (onInscriptionPlaced) {
      onInscriptionPlaced(data);
    }
  };

  return (
    <>
      <SurfaceRaycaster 
        meshRef={meshRef} 
        onSurfaceClick={handleSurfaceClick}
        enabled={enabled}
      />
      
      {/* Marker arrows */}
      {clickData && showMarker && (
        <ClickMarker 
          position={clickData.point}
          normal={clickData.normal}
          tangent={clickData.tangent}
          bitangent={clickData.bitangent}
          textScale={textScale}
          textRotation={textRotation}
          inscriptionText={inscriptionText}
        />
      )}
      
      {/* UV Map Visualization */}
      {clickData && showUVMap && (
        <UVMapVisualization
          position={clickData.point}
          normal={clickData.normal}
          tangent={clickData.tangent}
          bitangent={clickData.bitangent}
          textScale={textScale}
          textRotation={textRotation}
          targetMesh={meshRef}
        />
      )}
      
      {/* Dot Grid Text on surface (original approach) */}
      {clickData && showText && (
        <SurfaceText
          position={clickData.point}
          normal={clickData.normal}
          tangent={clickData.tangent}
          bitangent={clickData.bitangent}
          text={inscriptionText}
          textScale={textScale}
          textRotation={textRotation}
          textDepth={textDepth}
          targetMesh={meshRef}
          conformToSurface={conformToSurface}
        />
      )}
      
      {/* Font-based Text Mesh on surface (new approach) */}
      {clickData && showTextMesh && (
        <SurfaceTextMesh
          position={clickData.point}
          normal={clickData.normal}
          tangent={clickData.tangent}
          bitangent={clickData.bitangent}
          text={inscriptionText}
          textScale={textScale}
          textRotation={textRotation}
          textDepth={textDepth}
          targetMesh={meshRef}
          conformToSurface={conformToSurface}
          onGeometryReady={onTextMeshGeometryReady}
        />
      )}
    </>
  );
}

// Export the marker component for potential external use
export { ClickMarker, SurfaceRaycaster, SurfaceText, SurfaceTextMesh, UVMapVisualization };
