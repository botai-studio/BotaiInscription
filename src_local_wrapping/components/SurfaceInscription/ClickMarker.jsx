import React, { useRef, useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

export default function ClickMarker({ 
  position, 
  normal, 
  tangent, 
  bitangent, 
  clickMarkerScale
}) {
  const groupRef = useRef();
  
  // Base size multiplier - arrows scale with textScale
  const baseLength = 10;
  const arrowLength = baseLength * (clickMarkerScale / 0.1);
  const markerSize = 0.02 * (clickMarkerScale / 0.1);
  
  // Arrow head proportions
  const headLength = arrowLength * 0.15;
  const headWidth = arrowLength * 0.08;
  
  // Create rotation using tangent/bitangent/normal basis vectors
  const rotation = useMemo(() => {
    if (!normal || !tangent || !bitangent) return new THREE.Euler();
    
    // Build rotation matrix: columns are X (tangent), Y (bitangent), Z (normal)
    const matrix = new THREE.Matrix4();
    matrix.makeBasis(tangent, bitangent, normal);
    
    const euler = new THREE.Euler();
    euler.setFromRotationMatrix(matrix);
    return euler;
  }, [normal, tangent, bitangent]);

  // Create arrow helpers
  const normalArrow = useMemo(() => {
    return new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, 0),
      arrowLength,
      0x2196F3, // Blue
      headLength,
      headWidth
    );
  }, [arrowLength, headLength, headWidth]);

  const tangentArrow = useMemo(() => {
    return new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      arrowLength,
      0xff0000, // Red
      headLength,
      headWidth
    );
  }, [arrowLength, headLength, headWidth]);

  const bitangentArrow = useMemo(() => {
    return new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 0),
      arrowLength,
      0x00ff00, // Green
      headLength,
      headWidth
    );
  }, [arrowLength, headLength, headWidth]);

  if (!position) return null;

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Small sphere at intersection point */}
      <mesh>
        <sphereGeometry args={[markerSize, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      
      {/* Normal direction arrow (blue - Z axis) */}
      <primitive object={normalArrow} />
      
      {/* Tangent direction arrow (red - X axis) */}
      {tangent && <primitive object={tangentArrow} />}
      
      {/* Bitangent direction arrow (green - Y axis) */}
      {bitangent && <primitive object={bitangentArrow} />}
      
      {/* Labels */}
      <Html position={[arrowLength * 1.1, 0, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(255, 0, 0, 0.8)',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '9px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap'
        }}>
          X (U)
        </div>
      </Html>
      
      <Html position={[0, arrowLength * 1.1, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(0, 255, 0, 0.8)',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '9px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap'
        }}>
          Y (V)
        </div>
      </Html>
      
      <Html position={[0, 0, arrowLength * 1.1]} style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(33, 150, 243, 0.8)',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '9px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap'
        }}>
          Z (N)
        </div>
      </Html>
    </group>
  );
}
