import React, { useRef, useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

// Helper component to show the click marker on the surface
export default function ClickMarker({ position, normal, tangent, bitangent, textScale = 0.1, textRotation = 0, inscriptionText = 'Botai' }) {
  const groupRef = useRef();
  
  // Base size multiplier - arrows scale with textScale
  const baseLength = 0.5; // Base arrow length
  const arrowLength = baseLength * (textScale / 0.1); // Scale relative to default 0.1
  const markerSize = 0.02 * (textScale / 0.1);
  
  // Arrow head proportions
  const headLength = arrowLength * 0.15;
  const headWidth = arrowLength * 0.08;
  
  // Create rotation using tangent/bitangent/normal basis vectors
  const rotation = useMemo(() => {
    if (!normal || !tangent || !bitangent) return new THREE.Euler();
    
    // Apply text rotation around normal first
    const rotatedTangent = tangent.clone();
    const rotatedBitangent = bitangent.clone();
    const rotAngle = (textRotation * Math.PI) / 180;
    
    // Rotate tangent and bitangent around normal
    rotatedTangent.applyAxisAngle(normal, rotAngle);
    rotatedBitangent.applyAxisAngle(normal, rotAngle);
    
    // Build rotation matrix: columns are X (tangent), Y (bitangent), Z (normal)
    const matrix = new THREE.Matrix4();
    matrix.makeBasis(rotatedTangent, rotatedBitangent, normal);
    
    const euler = new THREE.Euler();
    euler.setFromRotationMatrix(matrix);
    return euler;
  }, [normal, tangent, bitangent, textRotation]);

  // Create arrow helpers with SAME length for all axes
  const normalArrow = useMemo(() => {
    return new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, 0),
      arrowLength,
      0x2196F3,
      headLength,
      headWidth
    );
  }, [arrowLength, headLength, headWidth]);

  const tangentArrow = useMemo(() => {
    return new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      arrowLength,
      0xff0000,
      headLength,
      headWidth
    );
  }, [arrowLength, headLength, headWidth]);

  const bitangentArrow = useMemo(() => {
    return new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 0),
      arrowLength,
      0x00ff00,
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
      
      {/* Tangent direction arrow (red - X axis) - represents text direction */}
      {tangent && <primitive object={tangentArrow} />}
      
      {/* Bitangent direction arrow (green - Y axis) */}
      {bitangent && <primitive object={bitangentArrow} />}
      
      {/* Text direction indicator label */}
      <Html position={[arrowLength * 1.1, 0, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(255, 0, 0, 0.8)',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '9px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
        }}>
          Text →
        </div>
      </Html>
      
      {/* Info display */}
      <Html position={[0, arrowLength * 1.1, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(33, 150, 243, 0.9)',
          color: 'white',
          padding: '6px 10px',
          borderRadius: '4px',
          fontSize: '10px',
          whiteSpace: 'nowrap',
          transform: 'translateX(-50%)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}>
          <strong>{inscriptionText}</strong>
        </div>
      </Html>
    </group>
  );
}
