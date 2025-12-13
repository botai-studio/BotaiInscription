import React from 'react';
import * as THREE from 'three';

/**
 * ClickMarker - Visual indicator showing click point, normal, tangent, and bitangent
 */
export default function ClickMarker({ position, normal, tangent, bitangent, scale = 2 }) {
  if (!position || !normal || !tangent || !bitangent) return null;

  return (
    <group position={position}>
      {/* Sphere at click point */}
      <mesh>
        <sphereGeometry args={[0.3 * scale, 16, 16]} />
        <meshBasicMaterial color="yellow" />
      </mesh>
      
      {/* Normal (blue) - pointing outward */}
      <arrowHelper 
        args={[
          normal, 
          new THREE.Vector3(0, 0, 0), 
          5 * scale, 
          0x0000ff, 
          1 * scale, 
          0.5 * scale
        ]} 
      />
      
      {/* Tangent (red) - X direction on surface */}
      <arrowHelper 
        args={[
          tangent, 
          new THREE.Vector3(0, 0, 0), 
          5 * scale, 
          0xff0000, 
          1 * scale, 
          0.5 * scale
        ]} 
      />
      
      {/* Bitangent (green) - Y direction on surface */}
      <arrowHelper 
        args={[
          bitangent, 
          new THREE.Vector3(0, 0, 0), 
          5 * scale, 
          0x00ff00, 
          1 * scale, 
          0.5 * scale
        ]} 
      />
    </group>
  );
}
