import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';

// Shared scale constant for Morpheus model and its accessories (clip)
const MORPHEUS_SCALE = 0.018;

// Component to load and display the clip mesh
export default function ClipMesh({ visible }) {
  const [clipObj, setClipObj] = useState(null);
  
  useEffect(() => {
    if (!visible) {
      setClipObj(null);
      return;
    }
    
    const loader = new OBJLoader();
    
    loader.load('./clip.obj', (obj) => {
      obj.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xd0d0d0,
            metalness: 0.1,
            roughness: 0.8,
          });
          child.material.side = THREE.DoubleSide;
        }
      });
      
      // Get clip's bounding box and center it
      const clipBox = new THREE.Box3().setFromObject(obj);
      const clipCenter = clipBox.getCenter(new THREE.Vector3());
      const clipSize = clipBox.getSize(new THREE.Vector3());
      
      console.log('📎 Clip original bounding box:', { center: clipCenter, size: clipSize });
      
      // Center the clip at origin
      obj.position.set(-clipCenter.x, -clipCenter.y, -clipCenter.z);
      
      // DON'T scale the clip - keep it at original size
      // The Botai mesh will apply its own normalizedScale via the group
      // We need to match that scale instead
      
      setClipObj(obj);
    });
  }, [visible]);
  
  if (!visible || !clipObj) return null;
  
  // Use the same scale as Morpheus model
  // Position offset in world coordinates (after scaling)
  const yOffset = -0.2;
  
  return (
    <group position={[0, yOffset, 0]} rotation={[-Math.PI, 0, 0]}>
      <group scale={[MORPHEUS_SCALE, MORPHEUS_SCALE, MORPHEUS_SCALE]}>
        <primitive object={clipObj} />
      </group>
    </group>
  );
}
