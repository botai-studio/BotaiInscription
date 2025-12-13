import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import * as THREE from 'three';

const MORPHEUS_SCALE = 1;

const MorpheusModel = forwardRef(({ visible = true, onUVDataReady }, ref) => {
  const obj = useLoader(OBJLoader, './Morpheus_uv.obj');
  const groupRef = useRef();
  const [model, setModel] = useState(null);

  useEffect(() => {
    if (!obj) return;

    const clonedObj = obj.clone();
    
    // Collect UV data from all meshes
    const allVertices = [];
    const allUVs = [];
    const allTriangles = [];
    let vertexOffset = 0;
    
    // Apply material to all meshes and extract UV data
    clonedObj.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0xcccccc,
          metalness: 0.1,
          roughness: 0.6,
        });
        child.material.side = THREE.DoubleSide;
        
        // Extract UV and position data
        const geometry = child.geometry;
        const posAttr = geometry.attributes.position;
        const uvAttr = geometry.attributes.uv;
        
        if (posAttr && uvAttr) {
          // Extract vertices and UVs
          for (let i = 0; i < posAttr.count; i++) {
            allVertices.push({
              x: posAttr.getX(i),
              y: posAttr.getY(i),
              z: posAttr.getZ(i)
            });
            allUVs.push({
              u: uvAttr.getX(i),
              v: uvAttr.getY(i)
            });
          }
          
          // Extract triangles (indices)
          if (geometry.index) {
            for (let i = 0; i < geometry.index.count; i += 3) {
              allTriangles.push([
                geometry.index.getX(i) + vertexOffset,
                geometry.index.getX(i + 1) + vertexOffset,
                geometry.index.getX(i + 2) + vertexOffset
              ]);
            }
          } else {
            // Non-indexed geometry
            for (let i = 0; i < posAttr.count; i += 3) {
              allTriangles.push([
                i + vertexOffset,
                i + 1 + vertexOffset,
                i + 2 + vertexOffset
              ]);
            }
          }
          
          vertexOffset = allVertices.length;
        }
      }
    });

    console.log(`🎨 Model loaded: ${allVertices.length} vertices, ${allTriangles.length} triangles`);
    
    // Calculate UV range without spreading huge arrays (avoids stack overflow)
    let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
    for (const uv of allUVs) {
      if (uv.u < uMin) uMin = uv.u;
      if (uv.u > uMax) uMax = uv.u;
      if (uv.v < vMin) vMin = uv.v;
      if (uv.v > vMax) vMax = uv.v;
    }
    console.log(`   UV range: u=[${uMin.toFixed(3)}, ${uMax.toFixed(3)}], v=[${vMin.toFixed(3)}, ${vMax.toFixed(3)}]`);

    // Notify parent about UV data
    if (onUVDataReady) {
      onUVDataReady({
        vertices: allVertices,
        uvs: allUVs,
        triangles: allTriangles
      });
    }

    setModel(clonedObj);
  }, [obj, onUVDataReady]);

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
