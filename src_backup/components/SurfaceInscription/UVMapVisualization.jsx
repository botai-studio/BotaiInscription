import React, { useRef, useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * UV Map Visualization Component
 * Shows a checkerboard-textured plane in the local UV space around the click point
 */
export default function UVMapVisualization({ 
  position, 
  normal, 
  tangent, 
  bitangent, 
  textScale = 0.1,
  textRotation = 0,
  targetMesh = null 
}) {
  const meshRef = useRef();
  const [geometry, setGeometry] = useState(null);
  
  // Calculate rotated basis vectors
  const basis = useMemo(() => {
    if (!normal || !tangent || !bitangent) return null;
    
    const rotAngle = (textRotation * Math.PI) / 180;
    const rotatedTangent = tangent.clone().applyAxisAngle(normal, rotAngle);
    const rotatedBitangent = bitangent.clone().applyAxisAngle(normal, rotAngle);
    
    return { tangent: rotatedTangent, bitangent: rotatedBitangent, normal: normal.clone() };
  }, [normal, tangent, bitangent, textRotation]);

  // Create checkerboard texture
  const checkerTexture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    const numChecks = 8;
    const checkSize = size / numChecks;
    
    for (let y = 0; y < numChecks; y++) {
      for (let x = 0; x < numChecks; x++) {
        const isWhite = (x + y) % 2 === 0;
        ctx.fillStyle = isWhite ? '#ffffff' : '#1565c0';
        ctx.fillRect(x * checkSize, y * checkSize, checkSize, checkSize);
      }
    }
    
    // Add UV coordinate labels
    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('U→', 10, 30);
    ctx.fillStyle = '#00aa00';
    ctx.fillText('V↑', 10, size - 10);
    
    // Mark center
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.arc(size/2, size/2, 8, 0, Math.PI * 2);
    ctx.fill();
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }, []);

  // Build UV-mapped geometry from mesh surface
  useEffect(() => {
    if (!position || !basis || !targetMesh?.current) {
      // Create a simple flat plane if no mesh
      const size = textScale * 5;
      const planeGeom = new THREE.PlaneGeometry(size, size, 1, 1);
      
      // Transform to world space
      const positions = planeGeom.attributes.position;
      const posArray = positions.array;
      
      for (let i = 0; i < positions.count; i++) {
        const localX = posArray[i * 3];
        const localY = posArray[i * 3 + 1];
        
        const worldPos = position.clone()
          .add(basis.tangent.clone().multiplyScalar(localX))
          .add(basis.bitangent.clone().multiplyScalar(localY))
          .add(basis.normal.clone().multiplyScalar(0.003));
        
        posArray[i * 3] = worldPos.x;
        posArray[i * 3 + 1] = worldPos.y;
        posArray[i * 3 + 2] = worldPos.z;
      }
      
      positions.needsUpdate = true;
      planeGeom.computeVertexNormals();
      setGeometry(planeGeom);
      return;
    }
    
    console.log('🗺️ Building UV map visualization...');
    
    const mesh = targetMesh.current;
    const uvSize = textScale * 5; // Size of UV region to visualize
    
    // Collect triangles that fall within our UV region
    const triangles = [];
    
    mesh.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const geom = child.geometry;
        const posAttr = geom.attributes.position;
        const indexAttr = geom.index;
        
        if (!posAttr) return;
        
        child.updateMatrixWorld(true);
        const worldMatrix = child.matrixWorld;
        
        // Get vertex positions in world space
        const worldPositions = [];
        for (let i = 0; i < posAttr.count; i++) {
          const v = new THREE.Vector3(
            posAttr.getX(i),
            posAttr.getY(i),
            posAttr.getZ(i)
          ).applyMatrix4(worldMatrix);
          worldPositions.push(v);
        }
        
        // Process triangles
        const numTriangles = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;
        
        for (let t = 0; t < numTriangles; t++) {
          let i0, i1, i2;
          if (indexAttr) {
            i0 = indexAttr.getX(t * 3);
            i1 = indexAttr.getX(t * 3 + 1);
            i2 = indexAttr.getX(t * 3 + 2);
          } else {
            i0 = t * 3;
            i1 = t * 3 + 1;
            i2 = t * 3 + 2;
          }
          
          const v0 = worldPositions[i0];
          const v1 = worldPositions[i1];
          const v2 = worldPositions[i2];
          
          // Compute UV for each vertex
          const uv0 = new THREE.Vector2(
            v0.clone().sub(position).dot(basis.tangent),
            v0.clone().sub(position).dot(basis.bitangent)
          );
          const uv1 = new THREE.Vector2(
            v1.clone().sub(position).dot(basis.tangent),
            v1.clone().sub(position).dot(basis.bitangent)
          );
          const uv2 = new THREE.Vector2(
            v2.clone().sub(position).dot(basis.tangent),
            v2.clone().sub(position).dot(basis.bitangent)
          );
          
          // Check if triangle is within our UV region
          const maxDist = Math.max(
            Math.max(Math.abs(uv0.x), Math.abs(uv0.y)),
            Math.max(Math.abs(uv1.x), Math.abs(uv1.y)),
            Math.max(Math.abs(uv2.x), Math.abs(uv2.y))
          );
          
          if (maxDist < uvSize) {
            triangles.push({ v0, v1, v2, uv0, uv1, uv2 });
          }
        }
      }
    });
    
    console.log(`🗺️ Found ${triangles.length} triangles in UV region`);
    
    if (triangles.length === 0) {
      setGeometry(null);
      return;
    }
    
    // Build geometry from collected triangles
    const vertices = [];
    const uvs = [];
    const indices = [];
    
    triangles.forEach((tri, i) => {
      const baseIdx = i * 3;
      
      // Offset vertices slightly along normal to prevent z-fighting
      const offset = basis.normal.clone().multiplyScalar(0.003);
      
      vertices.push(
        tri.v0.x + offset.x, tri.v0.y + offset.y, tri.v0.z + offset.z,
        tri.v1.x + offset.x, tri.v1.y + offset.y, tri.v1.z + offset.z,
        tri.v2.x + offset.x, tri.v2.y + offset.y, tri.v2.z + offset.z
      );
      
      // Map UVs to 0-1 range based on uvSize
      uvs.push(
        (tri.uv0.x / uvSize + 0.5), (tri.uv0.y / uvSize + 0.5),
        (tri.uv1.x / uvSize + 0.5), (tri.uv1.y / uvSize + 0.5),
        (tri.uv2.x / uvSize + 0.5), (tri.uv2.y / uvSize + 0.5)
      );
      
      indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
    });
    
    const bufferGeom = new THREE.BufferGeometry();
    bufferGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    bufferGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    bufferGeom.setIndex(indices);
    bufferGeom.computeVertexNormals();
    
    setGeometry(bufferGeom);
    console.log(`✅ UV map visualization built with ${triangles.length} triangles`);
    
  }, [position, basis, targetMesh, textScale]);

  if (!geometry || !position) return null;

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial 
        map={checkerTexture}
        side={THREE.DoubleSide}
        transparent={true}
        opacity={0.85}
      />
    </mesh>
  );
}
