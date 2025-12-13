import React, { useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';

/**
 * TextSurfaceMapper - Maps 2D text vertices to 3D surface positions using grid data
 * and creates an extruded mesh suitable for boolean operations
 * 
 * Algorithm:
 * 1. For each 2D text vertex (u, v):
 *    - Find which grid cell it falls into
 *    - Bilinear interpolate 3D position AND normal from grid corners
 * 2. Create extruded mesh:
 *    - Front face: triangles on the surface
 *    - Back face: triangles offset by -depth * normal (reversed winding)
 *    - Side walls: quads connecting boundary edges
 */
export default function TextSurfaceMapper({ 
  gridData, 
  inscriptionText,
  textScale,
  extrusionDepth = 0.5, // Depth to extrude into the surface
  visible = true,
  showVertices = false, // Toggle to show individual vertices
  onGeometryReady = null // Callback when extruded geometry is ready
}) {
  const [font, setFont] = useState(null);
  const [textMesh2D, setTextMesh2D] = useState(null);

  // Load font
  useEffect(() => {
    const loader = new FontLoader();
    loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (loadedFont) => {
      setFont(loadedFont);
    });
  }, []);

  // Generate 2D text mesh
  useEffect(() => {
    if (!font || !inscriptionText) {
      setTextMesh2D(null);
      return;
    }

    const shapes = font.generateShapes(inscriptionText, 1);
    const geometry = new THREE.ShapeGeometry(shapes);
    
    const posAttr = geometry.attributes.position;
    const vertices = [];
    for (let i = 0; i < posAttr.count; i++) {
      vertices.push({
        x: posAttr.getX(i),
        y: posAttr.getY(i)
      });
    }
    
    const indexAttr = geometry.index;
    const triangles = [];
    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i += 3) {
        triangles.push([
          indexAttr.getX(i),
          indexAttr.getX(i + 1),
          indexAttr.getX(i + 2)
        ]);
      }
    } else {
      for (let i = 0; i < posAttr.count; i += 3) {
        triangles.push([i, i + 1, i + 2]);
      }
    }

    setTextMesh2D({ vertices, triangles });
    geometry.dispose();
  }, [font, inscriptionText]);

  // Helper function to interpolate position and normal from grid
  const interpolateFromGrid = (u, v, grid, stepSizeX, stepSizeY, gridDensityX, gridDensityY) => {
    const cellI = Math.floor(u / stepSizeX);
    const cellJ = Math.floor(v / stepSizeY);
    
    // Check bounds
    if (cellI < 0 || cellI >= gridDensityX || cellJ < 0 || cellJ >= gridDensityY) {
      return null;
    }
    
    // Local coordinates within cell [0, 1]
    const localU = (u - cellI * stepSizeX) / stepSizeX;
    const localV = (v - cellJ * stepSizeY) / stepSizeY;
    
    // Get grid corners
    const c00 = grid[cellJ]?.[cellI];
    const c10 = grid[cellJ]?.[cellI + 1];
    const c01 = grid[cellJ + 1]?.[cellI];
    const c11 = grid[cellJ + 1]?.[cellI + 1];
    
    if (!c00 || !c10 || !c01 || !c11) {
      return null;
    }
    
    // Bilinear interpolation weights
    const w00 = (1 - localU) * (1 - localV);
    const w10 = localU * (1 - localV);
    const w01 = (1 - localU) * localV;
    const w11 = localU * localV;
    
    // Interpolate position
    const position = new THREE.Vector3(
      w00 * c00.point.x + w10 * c10.point.x + w01 * c01.point.x + w11 * c11.point.x,
      w00 * c00.point.y + w10 * c10.point.y + w01 * c01.point.y + w11 * c11.point.y,
      w00 * c00.point.z + w10 * c10.point.z + w01 * c01.point.z + w11 * c11.point.z
    );
    
    // Interpolate normal
    const normal = new THREE.Vector3(
      w00 * c00.normal.x + w10 * c10.normal.x + w01 * c01.normal.x + w11 * c11.normal.x,
      w00 * c00.normal.y + w10 * c10.normal.y + w01 * c01.normal.y + w11 * c11.normal.y,
      w00 * c00.normal.z + w10 * c10.normal.z + w01 * c01.normal.z + w11 * c11.normal.z
    ).normalize();
    
    return { position, normal };
  };

  // Create extruded 3D geometry
  const extrudedGeometry = useMemo(() => {
    if (!gridData || !textMesh2D || !gridData.grid.length) return null;
    
    const { grid, stepSizeX, stepSizeY, gridDensityX, gridDensityY } = gridData;
    const { vertices, triangles } = textMesh2D;
    const scaleFactor = textScale;
    
    console.log('🔨 Creating extruded text mesh...');
    console.log(`   Vertices: ${vertices.length}, Triangles: ${triangles.length}`);
    console.log(`   Extrusion depth: ${extrusionDepth}`);
    
    // Step 1: Map all 2D vertices to 3D positions + normals
    const mappedVertices = []; // { position, normal, valid }
    
    vertices.forEach((v2d) => {
      const u = v2d.x * scaleFactor;
      const v = v2d.y * scaleFactor;
      
      const result = interpolateFromGrid(u, v, grid, stepSizeX, stepSizeY, gridDensityX, gridDensityY);
      
      if (result) {
        mappedVertices.push({ ...result, valid: true });
      } else {
        mappedVertices.push({ position: null, normal: null, valid: false });
      }
    });
    
    // Step 2: Find valid triangles and build edge map for boundary detection
    const validTriangles = [];
    const edgeCount = new Map(); // "i-j" -> count
    
    const makeEdgeKey = (a, b) => {
      const min = Math.min(a, b);
      const max = Math.max(a, b);
      return `${min}-${max}`;
    };
    
    triangles.forEach((tri) => {
      const [i0, i1, i2] = tri;
      if (mappedVertices[i0].valid && mappedVertices[i1].valid && mappedVertices[i2].valid) {
        validTriangles.push(tri);
        
        // Count edges
        [[i0, i1], [i1, i2], [i2, i0]].forEach(([a, b]) => {
          const key = makeEdgeKey(a, b);
          edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
        });
      }
    });
    
    // Step 3: Find boundary edges (edges with count === 1)
    const boundaryEdges = [];
    edgeCount.forEach((count, key) => {
      if (count === 1) {
        const [a, b] = key.split('-').map(Number);
        boundaryEdges.push([a, b]);
      }
    });
    
    console.log(`   Valid triangles: ${validTriangles.length}`);
    console.log(`   Boundary edges: ${boundaryEdges.length}`);
    
    if (validTriangles.length === 0) return null;
    
    // Step 4: Build geometry arrays
    const positions = [];
    const indices = [];
    
    // Small offset to prevent z-fighting with the surface
    const frontOffset = 0.5;
    
    // Vertex mapping: original index -> new index for front face
    const frontVertexMap = new Map();
    let currentIndex = 0;
    
    // Add front face vertices (offset slightly outward to prevent overlap)
    validTriangles.forEach((tri) => {
      tri.forEach((idx) => {
        if (!frontVertexMap.has(idx)) {
          const v = mappedVertices[idx];
          const frontPos = v.position.clone().addScaledVector(v.normal, frontOffset);
          positions.push(frontPos.x, frontPos.y, frontPos.z);
          frontVertexMap.set(idx, currentIndex++);
        }
      });
    });
    
    const frontVertexCount = currentIndex;
    
    // Add back face vertices (offset by -depth * normal from original surface position)
    const backVertexMap = new Map();
    validTriangles.forEach((tri) => {
      tri.forEach((idx) => {
        if (!backVertexMap.has(idx)) {
          const v = mappedVertices[idx];
          // Back face: -extrusionDepth (goes into the surface from original position)
          // Total depth = frontOffset + extrusionDepth
          const backPos = v.position.clone().addScaledVector(v.normal, -extrusionDepth);
          positions.push(backPos.x, backPos.y, backPos.z);
          backVertexMap.set(idx, currentIndex++);
        }
      });
    });
    
    // Add front face triangles (original winding)
    validTriangles.forEach((tri) => {
      const [i0, i1, i2] = tri;
      indices.push(
        frontVertexMap.get(i0),
        frontVertexMap.get(i1),
        frontVertexMap.get(i2)
      );
    });
    
    // Add back face triangles (reversed winding for outward-facing normals)
    validTriangles.forEach((tri) => {
      const [i0, i1, i2] = tri;
      indices.push(
        backVertexMap.get(i0),
        backVertexMap.get(i2), // Reversed
        backVertexMap.get(i1)  // Reversed
      );
    });
    
    // Add side walls for boundary edges
    boundaryEdges.forEach(([a, b]) => {
      // We need to determine the correct winding order
      // Front edge: a -> b
      // Back edge: a' -> b' (offset versions)
      
      const frontA = frontVertexMap.get(a);
      const frontB = frontVertexMap.get(b);
      const backA = backVertexMap.get(a);
      const backB = backVertexMap.get(b);
      
      if (frontA !== undefined && frontB !== undefined && 
          backA !== undefined && backB !== undefined) {
        // Create quad as two triangles
        // Triangle 1: frontA, frontB, backB
        // Triangle 2: frontA, backB, backA
        indices.push(frontA, frontB, backB);
        indices.push(frontA, backB, backA);
      }
    });
    
    console.log(`   Total vertices: ${positions.length / 3}`);
    console.log(`   Total triangles: ${indices.length / 3}`);
    
    // Create geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    return geometry;
  }, [gridData, textMesh2D, textScale, extrusionDepth]);

  // Simple mapped vertices for visualization (optional)
  const mappedVerticesForDisplay = useMemo(() => {
    if (!showVertices || !gridData || !textMesh2D || !gridData.grid.length) return [];
    
    const { grid, stepSizeX, stepSizeY, gridDensityX, gridDensityY } = gridData;
    const { vertices } = textMesh2D;
    const scaleFactor = textScale;
    
    const points = [];
    vertices.forEach((v2d) => {
      const u = v2d.x * scaleFactor;
      const v = v2d.y * scaleFactor;
      const result = interpolateFromGrid(u, v, grid, stepSizeX, stepSizeY, gridDensityX, gridDensityY);
      if (result) {
        points.push(result.position);
      }
    });
    
    return points;
  }, [gridData, textMesh2D, textScale, showVertices]);

  // Notify parent when geometry is ready
  useEffect(() => {
    if (onGeometryReady) {
      onGeometryReady(extrudedGeometry);
    }
  }, [extrudedGeometry, onGeometryReady]);

  if (!visible || !gridData) return null;

  return (
    <group>
      {/* Render mapped vertices as small spheres (optional) */}
      {showVertices && mappedVerticesForDisplay.map((point, index) => (
        <mesh key={index} position={point}>
          <sphereGeometry args={[0.03, 6, 6]} />
          <meshBasicMaterial color={0xff6600} />
        </mesh>
      ))}
      
      {/* Render extruded 3D text mesh */}
      {extrudedGeometry && (
        <mesh geometry={extrudedGeometry}>
          <meshStandardMaterial 
            color={0xff6600} 
            side={THREE.DoubleSide}
            metalness={0.3}
            roughness={0.7}
          />
        </mesh>
      )}
    </group>
  );
}
