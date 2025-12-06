import React, { useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';

/**
 * Surface Text Mesh Component - Font-based approach
 * 
 * Creates actual text geometry from fonts, maps vertices to the curved surface,
 * and extrudes to create a closed mesh suitable for boolean operations.
 */
export default function SurfaceTextMesh({ 
  position, 
  normal, 
  tangent, 
  bitangent, 
  text = 'Botai', 
  textScale = 0.1, 
  textRotation = 0,
  textDepth = 0.02,
  textFont = 'helvetiker',
  targetMesh = null,
  conformToSurface = true,
  onGeometryReady = null // Callback when geometry is ready for CSG
}) {
  const [geometry, setGeometry] = useState(null);
  const [font, setFont] = useState(null);
  
  // Font URLs mapping - mapped to closest available Three.js fonts
  const fontUrls = {
    helvetiker: 'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', // Helvetica
    gentilis: 'https://threejs.org/examples/fonts/gentilis_bold.typeface.json', // Garamond
    droid_sans: 'https://threejs.org/examples/fonts/droid/droid_sans_bold.typeface.json', // Inter
    optimer: 'https://threejs.org/examples/fonts/optimer_bold.typeface.json', // Caveat
    droid_serif: 'https://threejs.org/examples/fonts/droid/droid_serif_bold.typeface.json', // Pacifico
  };

  // Load font
  useEffect(() => {
    const loader = new FontLoader();
    const fontUrl = fontUrls[textFont] || fontUrls.helvetiker;
    
    console.log(`🔤 Loading font: ${textFont}`);
    loader.load(fontUrl, (loadedFont) => {
      setFont(loadedFont);
      console.log(`🔤 Font "${textFont}" loaded for SurfaceTextMesh`);
    }, undefined, (err) => {
      console.error(`Failed to load font "${textFont}":`, err);
      // Fallback to helvetiker if failed
      if (textFont !== 'helvetiker') {
        loader.load(fontUrls.helvetiker, (loadedFont) => {
          setFont(loadedFont);
          console.log('🔤 Fallback font loaded');
        });
      }
    });
  }, [textFont]);
  
  // Calculate rotated basis vectors
  const basis = useMemo(() => {
    if (!normal || !tangent || !bitangent) return null;
    
    const rotAngle = (textRotation * Math.PI) / 180;
    const rotatedTangent = tangent.clone().applyAxisAngle(normal, rotAngle);
    const rotatedBitangent = bitangent.clone().applyAxisAngle(normal, rotAngle);
    
    return { tangent: rotatedTangent, bitangent: rotatedBitangent, normal: normal.clone() };
  }, [normal, tangent, bitangent, textRotation]);

  // Build the deformed text mesh
  useEffect(() => {
    if (!text || !position || !basis || !font || !targetMesh?.current) {
      setGeometry(null);
      return;
    }
    
    console.log(`🔤 Building SurfaceTextMesh for "${text}"...`);
    
    // Generate shapes from font
    const shapes = font.generateShapes(text, textScale);
    
    // Create ShapeGeometry (2D triangulated mesh)
    const shapeGeom = new THREE.ShapeGeometry(shapes);
    shapeGeom.computeBoundingBox();
    const bbox = shapeGeom.boundingBox;
    
    // Get the 2D vertices
    const posAttr = shapeGeom.attributes.position;
    const indexAttr = shapeGeom.index;
    
    console.log(`   ShapeGeometry: ${posAttr.count} vertices, ${indexAttr ? indexAttr.count / 3 : posAttr.count / 3} triangles`);
    
    // Collect mesh triangles for UV mapping (same logic as SurfaceText)
    const mesh = targetMesh.current;
    const meshTriangles = [];
    
    mesh.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const geom = child.geometry;
        const meshPosAttr = geom.attributes.position;
        const meshIndexAttr = geom.index;
        
        if (!meshPosAttr) return;
        
        child.updateMatrixWorld(true);
        const worldMatrix = child.matrixWorld;
        
        const worldPositions = [];
        for (let i = 0; i < meshPosAttr.count; i++) {
          const v = new THREE.Vector3(
            meshPosAttr.getX(i),
            meshPosAttr.getY(i),
            meshPosAttr.getZ(i)
          ).applyMatrix4(worldMatrix);
          worldPositions.push(v);
        }
        
        const numTris = meshIndexAttr ? meshIndexAttr.count / 3 : meshPosAttr.count / 3;
        
        for (let t = 0; t < numTris; t++) {
          let i0, i1, i2;
          if (meshIndexAttr) {
            i0 = meshIndexAttr.getX(t * 3);
            i1 = meshIndexAttr.getX(t * 3 + 1);
            i2 = meshIndexAttr.getX(t * 3 + 2);
          } else {
            i0 = t * 3;
            i1 = t * 3 + 1;
            i2 = t * 3 + 2;
          }
          
          const v0 = worldPositions[i0];
          const v1 = worldPositions[i1];
          const v2 = worldPositions[i2];
          
          // Compute face normal
          const edge1 = v1.clone().sub(v0);
          const edge2 = v2.clone().sub(v0);
          const faceNormal = edge1.clone().cross(edge2).normalize();
          
          // Filter by normal direction
          const dotProduct = faceNormal.dot(basis.normal);
          if (dotProduct < 0.1) continue;
          
          // Compute local UV for each vertex
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
          
          meshTriangles.push({ v0, v1, v2, uv0, uv1, uv2, faceNormal });
        }
      }
    });
    
    console.log(`   Collected ${meshTriangles.length} mesh triangles for mapping`);
    
    // Helper: compute barycentric coordinates
    function barycentricCoords(p, a, b, c) {
      const v0 = c.clone().sub(a);
      const v1 = b.clone().sub(a);
      const v2 = p.clone().sub(a);
      
      const dot00 = v0.dot(v0);
      const dot01 = v0.dot(v1);
      const dot02 = v0.dot(v2);
      const dot11 = v1.dot(v1);
      const dot12 = v1.dot(v2);
      
      const denom = dot00 * dot11 - dot01 * dot01;
      if (Math.abs(denom) < 1e-10) return null;
      
      const invDenom = 1 / denom;
      const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
      const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
      
      return { u, v, w: 1 - u - v };
    }
    
    // Helper: map a 2D UV point to 3D surface position and normal
    function mapToSurface(uvPoint) {
      let bestTriangle = null;
      let bestBary = null;
      let bestDist = Infinity;
      
      for (const tri of meshTriangles) {
        const bary = barycentricCoords(uvPoint, tri.uv0, tri.uv1, tri.uv2);
        if (!bary) continue;
        
        // Check if inside triangle
        if (bary.u >= -0.01 && bary.v >= -0.01 && bary.w >= -0.01) {
          bestTriangle = tri;
          bestBary = bary;
          break;
        }
        
        // Track closest as fallback
        const center = tri.uv0.clone().add(tri.uv1).add(tri.uv2).divideScalar(3);
        const dist = uvPoint.distanceTo(center);
        if (dist < bestDist) {
          bestDist = dist;
          bestTriangle = tri;
          bestBary = bary;
        }
      }
      
      if (!bestTriangle || !bestBary) return null;
      if (bestBary.u < -0.5 || bestBary.v < -0.5 || bestBary.w < -0.5) return null;
      
      // Interpolate 3D position
      const surfacePos = new THREE.Vector3()
        .addScaledVector(bestTriangle.v0, bestBary.w)
        .addScaledVector(bestTriangle.v1, bestBary.v)
        .addScaledVector(bestTriangle.v2, bestBary.u);
      
      return { position: surfacePos, normal: bestTriangle.faceNormal.clone() };
    }
    
    // Map all ShapeGeometry vertices to surface
    const frontVertices = [];
    const backVertices = [];
    const vertexNormals = [];
    let unmappedCount = 0;
    
    for (let i = 0; i < posAttr.count; i++) {
      // ShapeGeometry vertices are in 2D (x, y), z is 0
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      
      // Use x, y as UV coordinates (text local space)
      const uvPoint = new THREE.Vector2(x, y);
      
      const mapped = mapToSurface(uvPoint);
      
      if (mapped) {
        // Front face: on surface with small offset
        const frontPos = mapped.position.clone().add(mapped.normal.clone().multiplyScalar(0.001));
        frontVertices.push(frontPos);
        
        // Back face: extruded inward (negative normal direction for subtraction)
        const backPos = mapped.position.clone().add(mapped.normal.clone().multiplyScalar(-textDepth));
        backVertices.push(backPos);
        
        vertexNormals.push(mapped.normal);
      } else {
        // Fallback: flat projection if mapping fails
        const worldPos = position.clone()
          .add(basis.tangent.clone().multiplyScalar(x))
          .add(basis.bitangent.clone().multiplyScalar(y));
        
        frontVertices.push(worldPos.clone().add(basis.normal.clone().multiplyScalar(0.001)));
        backVertices.push(worldPos.clone().add(basis.normal.clone().multiplyScalar(-textDepth)));
        vertexNormals.push(basis.normal.clone());
        unmappedCount++;
      }
    }
    
    console.log(`   Mapped ${posAttr.count - unmappedCount}/${posAttr.count} vertices to surface`);
    
    // Build the final geometry with front face, back face, and sides
    const vertices = [];
    const indices = [];
    
    // Add front face vertices (indices 0 to N-1)
    for (const v of frontVertices) {
      vertices.push(v.x, v.y, v.z);
    }
    
    // Add back face vertices (indices N to 2N-1)
    for (const v of backVertices) {
      vertices.push(v.x, v.y, v.z);
    }
    
    const numVerts = frontVertices.length;
    
    // Front face triangles (same winding as original)
    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i += 3) {
        indices.push(indexAttr.getX(i), indexAttr.getX(i + 1), indexAttr.getX(i + 2));
      }
    } else {
      for (let i = 0; i < numVerts; i += 3) {
        indices.push(i, i + 1, i + 2);
      }
    }
    
    // Back face triangles (reversed winding for correct normals)
    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i += 3) {
        const i0 = indexAttr.getX(i) + numVerts;
        const i1 = indexAttr.getX(i + 1) + numVerts;
        const i2 = indexAttr.getX(i + 2) + numVerts;
        indices.push(i0, i2, i1); // Reversed winding
      }
    } else {
      for (let i = 0; i < numVerts; i += 3) {
        indices.push(i + numVerts, i + 2 + numVerts, i + 1 + numVerts);
      }
    }
    
    // Extract boundary edges for side walls
    // An edge is on the boundary if it appears in only one triangle
    const edgeCount = new Map();
    const getEdgeKey = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
    
    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i += 3) {
        const i0 = indexAttr.getX(i);
        const i1 = indexAttr.getX(i + 1);
        const i2 = indexAttr.getX(i + 2);
        
        [
          [i0, i1],
          [i1, i2],
          [i2, i0]
        ].forEach(([a, b]) => {
          const key = getEdgeKey(a, b);
          edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
        });
      }
    }
    
    // Find boundary edges (count === 1)
    const boundaryEdges = [];
    edgeCount.forEach((count, key) => {
      if (count === 1) {
        const [a, b] = key.split('-').map(Number);
        boundaryEdges.push([a, b]);
      }
    });
    
    console.log(`   Found ${boundaryEdges.length} boundary edges for side walls`);
    
    // Create side wall quads for each boundary edge
    for (const [a, b] of boundaryEdges) {
      // Front edge: a, b
      // Back edge: a + numVerts, b + numVerts
      // Create two triangles for the quad
      const fa = a;
      const fb = b;
      const ba = a + numVerts;
      const bb = b + numVerts;
      
      // Two triangles forming a quad (check winding)
      indices.push(fa, fb, bb);
      indices.push(fa, bb, ba);
    }
    
    // Create BufferGeometry
    const bufferGeom = new THREE.BufferGeometry();
    bufferGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    bufferGeom.setIndex(indices);
    bufferGeom.computeVertexNormals();
    
    setGeometry(bufferGeom);
    
    // Notify parent that geometry is ready
    if (onGeometryReady) {
      onGeometryReady(bufferGeom);
    }
    
    console.log(`✅ SurfaceTextMesh built: ${vertices.length / 3} vertices, ${indices.length / 3} triangles`);
    
  }, [text, textScale, textRotation, textDepth, position, basis, font, targetMesh, conformToSurface]);

  if (!geometry || !position) return null;

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial 
        color="#ff6600"
        side={THREE.DoubleSide}
        transparent={true}
        opacity={0.9}
      />
    </mesh>
  );
}
