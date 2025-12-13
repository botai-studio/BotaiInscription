import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import * as THREE from 'three';

const MORPHEUS_SCALE = 1.0;

const ClipModel = forwardRef((props, ref) => {
  const obj = useLoader(OBJLoader, './clip.obj');
  const groupRef = useRef();
  const [model, setModel] = useState(null);

  useEffect(() => {
    if (!obj) return;

    const clonedObj = obj.clone();
    
    // Apply material to all meshes
    clonedObj.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0xd0d0d0,
          metalness: 0.1,
          roughness: 0.8,
        });
        child.material.side = THREE.DoubleSide;
      }
    });

    setModel(clonedObj);
  }, [obj]);

  // Expose the group ref to parent
  useImperativeHandle(ref, () => groupRef.current);

  if (!model) return null;


  return (
    <group 
      ref={groupRef} 
      position={[0, 0, 0]} 
      rotation={[0, 0, 0]}
      scale={[MORPHEUS_SCALE, MORPHEUS_SCALE, MORPHEUS_SCALE]}
    >
      <primitive object={model} />
    </group>
  );
});

ClipModel.displayName = 'ClipModel';

export default ClipModel;
