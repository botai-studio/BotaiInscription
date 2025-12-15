import React, { useEffect, useMemo, useState, useRef } from 'react';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';

// Default fonts list
const DEFAULT_FONTS = [
  { id: 'helvetiker', name: 'Helvetica', url: 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json' }
];

// Global cache for UV grids per mesh
const uvGridCache = new WeakMap();

/**
 * UVTextMapper - Creates extruded text in UV space and maps to 3D surface
 * Creates front face, back face, and side walls for proper CSG subtraction
 * Subdivides triangles to better conform to curved surfaces
 */
export default function UVTextMapper({ 
  clickData, 
  meshRef, 
  text = 'Roger',
  textScale = 0.01,
  extrudeDepth = 2.0,
  fontId = 'helvetiker',
  rotation = 0,
  availableFonts = DEFAULT_FONTS,
  maxTriangleSize = 0.5, // Maximum edge length in text space before subdivision
  onTextDataReady,
  onOutOfBounds
}) {
  const [font, setFont] = useState(null);
  const [loadedFontId, setLoadedFontId] = useState(null);

  // Load font when fontId changes
  useEffect(() => {
    const fontInfo = availableFonts.find(f => f.id === fontId) || availableFonts[0];
    
    // Skip if already loaded
    if (loadedFontId === fontInfo.id && font) return;
    
    const loader = new FontLoader();
    loader.load(fontInfo.url, (loadedFont) => {
      setFont(loadedFont);
      setLoadedFontId(fontInfo.id);
      console.log(`🔤 Font loaded: ${fontInfo.name}`);
    });
  }, [fontId, availableFonts, loadedFontId, font]);

  // Cache UV grid for mesh (only rebuild if mesh changes)
  const uvGridData = useMemo(() => {
    if (!meshRef?.current) return null;
    
    // Check cache first
    if (uvGridCache.has(meshRef.current)) {
      return uvGridCache.get(meshRef.current);
    }
    
    // Build and cache
    console.log('🔧 Building UV grid index...');
    const gridData = buildUVGrid(meshRef);
    uvGridCache.set(meshRef.current, gridData);
    console.log(`   Grid built with ${gridData.triangleData.length} triangles`);
    return gridData;
  }, [meshRef?.current]);

  // Generate extruded text mesh
  const textMeshData = useMemo(() => {
    if (!font || !clickData || !clickData.uv || !clickData.uvTangent || !meshRef?.current || !uvGridData) {
      return null;
    }

    const { uv, uvTangent } = clickData;
    
    // Apply rotation to UV tangent
    const rotRad = (rotation * Math.PI) / 180;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);
    const rotatedTangent = {
      x: uvTangent.x * cosR - uvTangent.y * sinR,
      y: uvTangent.x * sinR + uvTangent.y * cosR
    };
    
    // UV bitangent (perpendicular to rotated tangent)
    const uvBitangent = {
      x: -rotatedTangent.y,
      y: rotatedTangent.x
    };

    console.log('📝 Generating extruded text mesh in UV space...');
    console.log(`   Text: "${text}", Scale: ${textScale}, Depth: ${extrudeDepth}, Rotation: ${rotation}°`);

    // Generate shapes from font
    const shapes = font.generateShapes(text, 1);
    
    // Create ShapeGeometry (triangulated 2D mesh - front face)
    const shapeGeom = new THREE.ShapeGeometry(shapes);
    const posAttr = shapeGeom.attributes.position;
    const indexAttr = shapeGeom.index;

    console.log(`   Original ShapeGeometry: ${posAttr.count} vertices, ${indexAttr ? indexAttr.count / 3 : posAttr.count / 3} triangles`);

    // Extract original vertices (in text space, scaled)
    const originalVertices = [];
    for (let i = 0; i < posAttr.count; i++) {
      originalVertices.push({
        x: posAttr.getX(i) * textScale,
        y: posAttr.getY(i) * textScale
      });
    }

    // Get original indices
    const originalIndices = [];
    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i++) {
        originalIndices.push(indexAttr.getX(i));
      }
    } else {
      for (let i = 0; i < posAttr.count; i++) {
        originalIndices.push(i);
      }
    }

    // Subdivide triangles to better conform to curved surfaces
    const { vertices: subdivVertices, indices: subdivIndices } = subdivideTriangles(
      originalVertices,
      originalIndices,
      maxTriangleSize * textScale // Scale the max size to match text scale
    );

    console.log(`   After subdivision: ${subdivVertices.length} vertices, ${subdivIndices.length / 3} triangles`);

    // Extract edge vertices for side walls
    const edgeVertices = extractShapeEdges(shapes, textScale);
    console.log(`   Edge vertices for sides: ${edgeVertices.length} points`);

    // Transform subdivided vertices to UV space (using rotated tangent)
    const uvVertices = subdivVertices.map(v => ({
      u: uv.x + v.x * rotatedTangent.x + v.y * uvBitangent.x,
      v: uv.y + v.x * rotatedTangent.y + v.y * uvBitangent.y
    }));

    // Use subdivided indices
    const faceIndices = subdivIndices;

    // Transform edge vertices to UV space (using rotated tangent)
    const uvEdgeVertices = edgeVertices.map(({ x, y, isGap }) => ({
      u: uv.x + x * rotatedTangent.x + y * uvBitangent.x,
      v: uv.y + x * rotatedTangent.y + y * uvBitangent.y,
      isGap
    }));

    // Map UV vertices to 3D using cached grid
    const { vertices3D: faceVertices3D, normals3D: faceNormals3D } = mapUVVerticesToMeshFast(uvVertices, uvGridData);
    const { vertices3D: edgeVertices3D, normals3D: edgeNormals3D } = mapUVVerticesToMeshFast(uvEdgeVertices, uvGridData);

    const faceMappedCount = faceVertices3D.filter(v => v).length;
    // For edge vertices, count only non-gap vertices
    const nonGapEdgeCount = uvEdgeVertices.filter(v => !v.isGap).length;
    const edgeMappedCount = edgeVertices3D.filter(v => v).length;
    console.log(`   Mapped ${faceMappedCount}/${uvVertices.length} face vertices`);
    console.log(`   Mapped ${edgeMappedCount}/${nonGapEdgeCount} edge vertices (excluding gaps)`);

    // Check if any vertices are out of UV bounds (not mapped)
    const unmappedFaceCount = uvVertices.length - faceMappedCount;
    const unmappedEdgeCount = nonGapEdgeCount - edgeMappedCount;
    const hasUnmappedVertices = unmappedFaceCount > 0 || unmappedEdgeCount > 0;
    
    if (hasUnmappedVertices) {
      console.warn(`⚠️ Text has ${unmappedFaceCount + unmappedEdgeCount} vertices outside UV bounds!`);
      return { isOutOfBounds: true, unmappedCount: unmappedFaceCount + unmappedEdgeCount };
    }

    // Build combined 3D geometry
    const positions = [];
    const indices = [];
    let vertexOffset = 0;

    // === FRONT FACE ===
    const frontOffset = 0.2;
    const frontVertexStart = vertexOffset;
    
    for (let i = 0; i < uvVertices.length; i++) {
      if (faceVertices3D[i] && faceNormals3D[i]) {
        const p = faceVertices3D[i].clone().addScaledVector(faceNormals3D[i], frontOffset);
        positions.push(p.x, p.y, p.z);
      } else {
        positions.push(0, 0, 0);
      }
    }
    vertexOffset += uvVertices.length;

    // Front face triangles
    for (let i = 0; i < faceIndices.length; i += 3) {
      const i0 = faceIndices[i];
      const i1 = faceIndices[i + 1];
      const i2 = faceIndices[i + 2];

      if (faceVertices3D[i0] && faceVertices3D[i1] && faceVertices3D[i2]) {
        indices.push(frontVertexStart + i0, frontVertexStart + i1, frontVertexStart + i2);
      }
    }

    // === BACK FACE ===
    const backVertexStart = vertexOffset;
    
    for (let i = 0; i < uvVertices.length; i++) {
      if (faceVertices3D[i] && faceNormals3D[i]) {
        const p = faceVertices3D[i].clone().addScaledVector(faceNormals3D[i], -extrudeDepth);
        positions.push(p.x, p.y, p.z);
      } else {
        positions.push(0, 0, 0);
      }
    }
    vertexOffset += uvVertices.length;

    // Back face triangles (reversed winding)
    for (let i = 0; i < faceIndices.length; i += 3) {
      const i0 = faceIndices[i];
      const i1 = faceIndices[i + 1];
      const i2 = faceIndices[i + 2];

      if (faceVertices3D[i0] && faceVertices3D[i1] && faceVertices3D[i2]) {
        indices.push(backVertexStart + i0, backVertexStart + i2, backVertexStart + i1);
      }
    }

    // === SIDE WALLS ===
    const frontEdgeStart = vertexOffset;
    
    for (let i = 0; i < uvEdgeVertices.length; i++) {
      if (edgeVertices3D[i] && edgeNormals3D[i]) {
        const p = edgeVertices3D[i].clone().addScaledVector(edgeNormals3D[i], frontOffset);
        positions.push(p.x, p.y, p.z);
      } else {
        positions.push(0, 0, 0);
      }
    }
    vertexOffset += uvEdgeVertices.length;

    const backEdgeStart = vertexOffset;
    
    for (let i = 0; i < uvEdgeVertices.length; i++) {
      if (edgeVertices3D[i] && edgeNormals3D[i]) {
        const p = edgeVertices3D[i].clone().addScaledVector(edgeNormals3D[i], -extrudeDepth);
        positions.push(p.x, p.y, p.z);
      } else {
        positions.push(0, 0, 0);
      }
    }
    vertexOffset += uvEdgeVertices.length;

    // Side wall triangles
    for (let i = 0; i < uvEdgeVertices.length - 1; i++) {
      // Skip gaps between contours
      if (uvEdgeVertices[i].isGap || uvEdgeVertices[i + 1].isGap) continue;
      if (!edgeVertices3D[i] || !edgeVertices3D[i + 1]) continue;

      const f0 = frontEdgeStart + i;
      const f1 = frontEdgeStart + i + 1;
      const b0 = backEdgeStart + i;
      const b1 = backEdgeStart + i + 1;

      // Two triangles per quad
      indices.push(f0, b0, f1);
      indices.push(f1, b0, b1);
    }

    console.log(`   Total: ${positions.length / 3} vertices, ${indices.length / 3} triangles`);

    // Create BufferGeometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    shapeGeom.dispose();

    // Build triangles array for UV panel
    const triangles = [];
    for (let i = 0; i < faceIndices.length; i += 3) {
      triangles.push([faceIndices[i], faceIndices[i + 1], faceIndices[i + 2]]);
    }

    return { uvVertices, vertices3D: faceVertices3D, triangles, geometry };

  }, [font, clickData, meshRef, text, textScale, extrudeDepth, rotation, maxTriangleSize, uvGridData]);

  // Track last notification to prevent infinite loops from callback reference changes
  const lastNotificationRef = useRef({ isOutOfBounds: null, geometryId: null });

  // Notify parent about out of bounds or successful generation
  useEffect(() => {
    if (textMeshData) {
      const geometryId = textMeshData.geometry?.uuid;
      const lastNotif = lastNotificationRef.current;
      
      if (textMeshData.isOutOfBounds) {
        // Only notify if OOB status changed
        if (lastNotif.isOutOfBounds !== true) {
          lastNotificationRef.current = { isOutOfBounds: true, geometryId: null };
          if (onOutOfBounds) {
            onOutOfBounds(true, textMeshData.unmappedCount);
          }
        }
      } else {
        // Only notify if we have a new geometry or OOB status changed
        if (lastNotif.isOutOfBounds !== false || lastNotif.geometryId !== geometryId) {
          lastNotificationRef.current = { isOutOfBounds: false, geometryId };
          if (onOutOfBounds) {
            onOutOfBounds(false, 0);
          }
          if (onTextDataReady) {
            onTextDataReady(textMeshData);
          }
        }
      }
    }
  }, [textMeshData, onTextDataReady, onOutOfBounds]);

  // Don't render if out of bounds or no geometry
  if (!textMeshData || textMeshData.isOutOfBounds || !textMeshData.geometry) return null;

  return (
    <mesh geometry={textMeshData.geometry}>
      <meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} />
    </mesh>
  );
}

/**
 * Subdivide triangles that are too large
 * This helps the mesh conform better to curved surfaces
 */
function subdivideTriangles(vertices, indices, maxEdgeLength) {
  // Work with arrays we can modify
  let currentVertices = [...vertices];
  let currentIndices = [...indices];
  
  // Keep subdividing until all triangles are small enough
  let iterations = 0;
  const maxIterations = 5; // Prevent infinite loops
  
  while (iterations < maxIterations) {
    const newIndices = [];
    let subdivided = false;
    
    for (let i = 0; i < currentIndices.length; i += 3) {
      const i0 = currentIndices[i];
      const i1 = currentIndices[i + 1];
      const i2 = currentIndices[i + 2];
      
      const v0 = currentVertices[i0];
      const v1 = currentVertices[i1];
      const v2 = currentVertices[i2];
      
      // Calculate edge lengths
      const e01 = Math.sqrt((v1.x - v0.x) ** 2 + (v1.y - v0.y) ** 2);
      const e12 = Math.sqrt((v2.x - v1.x) ** 2 + (v2.y - v1.y) ** 2);
      const e20 = Math.sqrt((v0.x - v2.x) ** 2 + (v0.y - v2.y) ** 2);
      
      const maxEdge = Math.max(e01, e12, e20);
      
      if (maxEdge > maxEdgeLength) {
        // Subdivide by splitting the longest edge
        subdivided = true;
        
        // Find which edge to split
        let splitV0, splitV1, oppositeV, splitI0, splitI1, oppositeI;
        
        if (e01 >= e12 && e01 >= e20) {
          splitV0 = v0; splitV1 = v1; oppositeV = v2;
          splitI0 = i0; splitI1 = i1; oppositeI = i2;
        } else if (e12 >= e01 && e12 >= e20) {
          splitV0 = v1; splitV1 = v2; oppositeV = v0;
          splitI0 = i1; splitI1 = i2; oppositeI = i0;
        } else {
          splitV0 = v2; splitV1 = v0; oppositeV = v1;
          splitI0 = i2; splitI1 = i0; oppositeI = i1;
        }
        
        // Create midpoint
        const midpoint = {
          x: (splitV0.x + splitV1.x) / 2,
          y: (splitV0.y + splitV1.y) / 2
        };
        
        const midIdx = currentVertices.length;
        currentVertices.push(midpoint);
        
        // Create two new triangles
        // Triangle 1: splitV0, midpoint, opposite
        newIndices.push(splitI0, midIdx, oppositeI);
        // Triangle 2: midpoint, splitV1, opposite
        newIndices.push(midIdx, splitI1, oppositeI);
      } else {
        // Keep triangle as-is
        newIndices.push(i0, i1, i2);
      }
    }
    
    currentIndices = newIndices;
    
    if (!subdivided) break;
    iterations++;
  }
  
  console.log(`   Subdivision iterations: ${iterations}`);
  
  return { vertices: currentVertices, indices: currentIndices };
}

/**
 * Extract edge vertices from shapes for side walls
 */
function extractShapeEdges(shapes, scale) {
  const edgePoints = [];
  
  shapes.forEach((shape, shapeIdx) => {
    // Add gap marker between shapes
    if (shapeIdx > 0) {
      edgePoints.push({ x: 0, y: 0, isGap: true });
    }
    
    // Main shape contour
    const shapePoints = shape.getPoints(12);
    shapePoints.forEach(pt => {
      edgePoints.push({ x: pt.x * scale, y: pt.y * scale, isGap: false });
    });
    // Close the contour
    if (shapePoints.length > 0) {
      edgePoints.push({ x: shapePoints[0].x * scale, y: shapePoints[0].y * scale, isGap: false });
    }
    
    // Holes
    if (shape.holes) {
      shape.holes.forEach((hole) => {
        edgePoints.push({ x: 0, y: 0, isGap: true }); // Gap before hole
        const holePoints = hole.getPoints(12);
        holePoints.forEach(pt => {
          edgePoints.push({ x: pt.x * scale, y: pt.y * scale, isGap: false });
        });
        // Close hole contour
        if (holePoints.length > 0) {
          edgePoints.push({ x: holePoints[0].x * scale, y: holePoints[0].y * scale, isGap: false });
        }
      });
    }
  });
  
  return edgePoints;
}

/**
 * Build a spatial grid index for UV triangles for fast lookup
 */
function buildUVGrid(meshRef, gridSize = 32) {
  const grid = {};
  const triangleData = [];
  
  meshRef.current.traverse((child) => {
    if (!child.isMesh) return;
    
    const geometry = child.geometry;
    const meshPosAttr = geometry.attributes.position;
    const meshUVAttr = geometry.attributes.uv;
    const meshNormalAttr = geometry.attributes.normal;

    if (!meshPosAttr || !meshUVAttr) return;

    const worldMatrix = child.matrixWorld;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(worldMatrix);
    const triCount = meshPosAttr.count / 3;

    for (let t = 0; t < triCount; t++) {
      const i0 = t * 3, i1 = t * 3 + 1, i2 = t * 3 + 2;

      const u0 = meshUVAttr.getX(i0), v0 = meshUVAttr.getY(i0);
      const u1 = meshUVAttr.getX(i1), v1 = meshUVAttr.getY(i1);
      const u2 = meshUVAttr.getX(i2), v2 = meshUVAttr.getY(i2);

      // Store triangle data
      const triIdx = triangleData.length;
      triangleData.push({
        uv: [u0, v0, u1, v1, u2, v2],
        pos: [
          meshPosAttr.getX(i0), meshPosAttr.getY(i0), meshPosAttr.getZ(i0),
          meshPosAttr.getX(i1), meshPosAttr.getY(i1), meshPosAttr.getZ(i1),
          meshPosAttr.getX(i2), meshPosAttr.getY(i2), meshPosAttr.getZ(i2)
        ],
        normal: meshNormalAttr ? [
          meshNormalAttr.getX(i0), meshNormalAttr.getY(i0), meshNormalAttr.getZ(i0),
          meshNormalAttr.getX(i1), meshNormalAttr.getY(i1), meshNormalAttr.getZ(i1),
          meshNormalAttr.getX(i2), meshNormalAttr.getY(i2), meshNormalAttr.getZ(i2)
        ] : null,
        worldMatrix,
        normalMatrix
      });

      // Calculate UV bounding box
      const minU = Math.min(u0, u1, u2);
      const maxU = Math.max(u0, u1, u2);
      const minV = Math.min(v0, v1, v2);
      const maxV = Math.max(v0, v1, v2);

      // Add to grid cells that this triangle overlaps
      const cellMinX = Math.floor(minU * gridSize);
      const cellMaxX = Math.floor(maxU * gridSize);
      const cellMinY = Math.floor(minV * gridSize);
      const cellMaxY = Math.floor(maxV * gridSize);

      for (let cx = cellMinX; cx <= cellMaxX; cx++) {
        for (let cy = cellMinY; cy <= cellMaxY; cy++) {
          const key = `${cx},${cy}`;
          if (!grid[key]) grid[key] = [];
          grid[key].push(triIdx);
        }
      }
    }
  });

  return { grid, triangleData, gridSize };
}

/**
 * Map UV vertices to 3D mesh positions and normals using pre-built spatial grid
 */
function mapUVVerticesToMeshFast(uvVertices, uvGridData) {
  const vertices3D = new Array(uvVertices.length).fill(null);
  const normals3D = new Array(uvVertices.length).fill(null);

  if (!uvGridData) return { vertices3D, normals3D };

  const { grid, triangleData, gridSize } = uvGridData;

  uvVertices.forEach((uvPoint, idx) => {
    if (uvPoint.isGap) return;

    // Find grid cell for this UV point
    const cellX = Math.floor(uvPoint.u * gridSize);
    const cellY = Math.floor(uvPoint.v * gridSize);
    const key = `${cellX},${cellY}`;
    
    // Get candidate triangles from grid
    const candidates = grid[key] || [];
    
    for (const triIdx of candidates) {
      const tri = triangleData[triIdx];
      const [u0, v0, u1, v1, u2, v2] = tri.uv;

      const bary = computeBarycentricFast(uvPoint.u, uvPoint.v, u0, v0, u1, v1, u2, v2);
      
      const tolerance = -0.01;
      if (bary && bary.a >= tolerance && bary.b >= tolerance && bary.c >= tolerance) {
        const [px0, py0, pz0, px1, py1, pz1, px2, py2, pz2] = tri.pos;
        
        const px = px0 * bary.a + px1 * bary.b + px2 * bary.c;
        const py = py0 * bary.a + py1 * bary.b + py2 * bary.c;
        const pz = pz0 * bary.a + pz1 * bary.b + pz2 * bary.c;

        const pos3D = new THREE.Vector3(px, py, pz);
        pos3D.applyMatrix4(tri.worldMatrix);
        vertices3D[idx] = pos3D;

        if (tri.normal) {
          const [nx0, ny0, nz0, nx1, ny1, nz1, nx2, ny2, nz2] = tri.normal;
          const nx = nx0 * bary.a + nx1 * bary.b + nx2 * bary.c;
          const ny = ny0 * bary.a + ny1 * bary.b + ny2 * bary.c;
          const nz = nz0 * bary.a + nz1 * bary.b + nz2 * bary.c;
          
          const normal = new THREE.Vector3(nx, ny, nz);
          normal.applyMatrix3(tri.normalMatrix).normalize();
          normals3D[idx] = normal;
        }
        break;
      }
    }
  });

  return { vertices3D, normals3D };
}

function computeBarycentricFast(px, py, ax, ay, bx, by, cx, cy) {
  const v0x = bx - ax, v0y = by - ay;
  const v1x = cx - ax, v1y = cy - ay;
  const v2x = px - ax, v2y = py - ay;

  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;

  const denom = dot00 * dot11 - dot01 * dot01;
  const maxDot = Math.max(dot00, dot11);
  if (Math.abs(denom) < maxDot * 1e-10 || maxDot < 1e-20) return null;

  const invDenom = 1 / denom;
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

  return { a: 1 - u - v, b: u, c: v };
}
