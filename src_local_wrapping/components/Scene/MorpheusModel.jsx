import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import * as THREE from 'three';

const MORPHEUS_SCALE = 1;

const MorpheusModel = forwardRef(({ visible = true }, ref) => {
  const obj = useLoader(OBJLoader, './Morpheus_uv.obj');
  const groupRef = useRef();
  const [model, setModel] = useState(null);

  useEffect(() => {
    if (!obj) return;

    const clonedObj = obj.clone();
    
    // Apply material to all meshes
    clonedObj.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0xcccccc,
          metalness: 0.1,
          roughness: 0.6,
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
    <group ref={groupRef} scale={[MORPHEUS_SCALE, MORPHEUS_SCALE, MORPHEUS_SCALE]} visible={visible}>
      <primitive object={model} />
    </group>
  );
});

MorpheusModel.displayName = 'MorpheusModel';

export default MorpheusModel;
