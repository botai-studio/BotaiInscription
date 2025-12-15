import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import * as THREE from 'three';

const LOFI_SCALE = 1;

const LofiModel = forwardRef(({ visible = true, onModelReady }, ref) => {
  const obj = useLoader(OBJLoader, './Morpheus_lofi.obj');
  const groupRef = useRef();
  const [model, setModel] = useState(null);
  const originalGeometryRef = useRef(null);

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
        
        // Store original geometry (first mesh only)
        if (!originalGeometryRef.current) {
          originalGeometryRef.current = child.geometry.clone();
          console.log('💾 Lofi original geometry stored:', originalGeometryRef.current.attributes.position.count, 'vertices');
        }
      }
    });

    // Notify parent about model ready with original geometry
    if (onModelReady && originalGeometryRef.current) {
      onModelReady(originalGeometryRef.current.clone());
    }

    setModel(clonedObj);
  }, [obj, onModelReady]);

  // Simply forward the ref to groupRef
  useImperativeHandle(ref, () => groupRef.current, [model]);

  if (!model) return null;

  return (
    <group ref={groupRef} scale={[LOFI_SCALE, LOFI_SCALE, LOFI_SCALE]} visible={visible}>
      <primitive object={model} />
    </group>
  );
});

LofiModel.displayName = 'LofiModel';

export default LofiModel;
