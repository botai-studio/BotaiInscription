import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * UVGridMapper - Creates a grid of dots in UV space and maps them to 3D
 * 
 * Props:
 * - clickData: Contains uv, uvTangent, point, normal from click
 * - meshRef: Reference to the 3D mesh for raycasting
 * - gridSize: Number of dots in each direction (default 5x5)
 * - gridSpacing: Spacing between dots in UV space (default 0.02)
 * - onGridReady: Callback with { uvPoints, points3D } 
 */
export default function UVGridMapper({ 
  clickData, 
  meshRef, 
  gridSize = 5, 
  gridSpacing = 0.02,
  onGridReady 
}) {
  // Compute grid points
  const gridData = useMemo(() => {
    if (!clickData || !clickData.uv || !clickData.uvTangent || !meshRef?.current) {
      return null;
    }

    const { uv, uvTangent, normal } = clickData;
    
    // UV tangent is our X direction, compute perpendicular Y direction
    // In 2D, rotate 90 degrees: (x, y) -> (-y, x)
    const uvBitangent = {
      x: -uvTangent.y,
      y: uvTangent.x
    };

    console.log('🔢 Computing UV grid...');
    console.log(`   Origin UV: (${uv.x.toFixed(4)}, ${uv.y.toFixed(4)})`);
    console.log(`   UV Tangent: (${uvTangent.x.toFixed(4)}, ${uvTangent.y.toFixed(4)})`);
    console.log(`   UV Bitangent: (${uvBitangent.x.toFixed(4)}, ${uvBitangent.y.toFixed(4)})`);

    const uvPoints = [];
    const points3D = [];

    // Generate grid points
    for (let j = 0; j < gridSize; j++) {
      for (let i = 0; i < gridSize; i++) {
        // Compute UV position: origin + i * tangent * spacing + j * bitangent * spacing
        const uvX = uv.x + i * uvTangent.x * gridSpacing + j * uvBitangent.x * gridSpacing;
        const uvY = uv.y + i * uvTangent.y * gridSpacing + j * uvBitangent.y * gridSpacing;

        uvPoints.push({ u: uvX, v: uvY, i, j });
      }
    }

    // Map UV points to 3D by finding triangles that contain each UV point
    let meshCount = 0;
    let totalTriangles = 0;
    
    meshRef.current.traverse((child) => {
      if (!child.isMesh) return;
      meshCount++;
      
      const geometry = child.geometry;
      const posAttr = geometry.attributes.position;
      const uvAttr = geometry.attributes.uv;
      const indexAttr = geometry.index;

      if (!posAttr || !uvAttr) {
        console.log(`   Mesh ${meshCount}: No position or UV attributes`);
        return;
      }

      // Get world matrix for transforming positions
      const worldMatrix = child.matrixWorld;
      
      const triCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;
      totalTriangles += triCount;
      console.log(`   Mesh ${meshCount}: ${triCount} triangles, indexed: ${!!indexAttr}`);
      
      // Debug: log a sample of triangle UVs to understand the UV space
      if (meshCount === 1) {
        console.log(`   Sample triangle UVs:`);
        for (let t = 0; t < Math.min(3, triCount); t++) {
          const i0 = t * 3, i1 = t * 3 + 1, i2 = t * 3 + 2;
          console.log(`     Tri ${t}: (${uvAttr.getX(i0).toFixed(4)}, ${uvAttr.getY(i0).toFixed(4)}), (${uvAttr.getX(i1).toFixed(4)}, ${uvAttr.getY(i1).toFixed(4)}), (${uvAttr.getX(i2).toFixed(4)}, ${uvAttr.getY(i2).toFixed(4)})`);
        }
        console.log(`   Looking for UV points:`);
        uvPoints.slice(0, 5).forEach((p, i) => console.log(`     Point ${i}: (${p.u.toFixed(4)}, ${p.v.toFixed(4)})`));
        
        // Debug: Find closest triangle to first UV point
        let closestDist = Infinity;
        let closestTri = -1;
        const targetU = uvPoints[0].u;
        const targetV = uvPoints[0].v;
        
        for (let t = 0; t < triCount; t++) {
          const i0 = t * 3, i1 = t * 3 + 1, i2 = t * 3 + 2;
          const u0 = uvAttr.getX(i0), v0 = uvAttr.getY(i0);
          const u1 = uvAttr.getX(i1), v1 = uvAttr.getY(i1);
          const u2 = uvAttr.getX(i2), v2 = uvAttr.getY(i2);
          
          // Triangle center
          const cu = (u0 + u1 + u2) / 3;
          const cv = (v0 + v1 + v2) / 3;
          const dist = Math.sqrt((cu - targetU) ** 2 + (cv - targetV) ** 2);
          
          if (dist < closestDist) {
            closestDist = dist;
            closestTri = t;
          }
        }
        
        if (closestTri >= 0) {
          const i0 = closestTri * 3, i1 = closestTri * 3 + 1, i2 = closestTri * 3 + 2;
          const u0 = uvAttr.getX(i0), v0 = uvAttr.getY(i0);
          const u1 = uvAttr.getX(i1), v1 = uvAttr.getY(i1);
          const u2 = uvAttr.getX(i2), v2 = uvAttr.getY(i2);
          console.log(`   Closest triangle to origin UV (dist=${closestDist.toFixed(6)}):`);
          console.log(`     Tri ${closestTri}: (${u0.toFixed(4)}, ${v0.toFixed(4)}), (${u1.toFixed(4)}, ${v1.toFixed(4)}), (${u2.toFixed(4)}, ${v2.toFixed(4)})`);
          
          // Test barycentric
          const bary = computeBarycentricFast(targetU, targetV, u0, v0, u1, v1, u2, v2);
          console.log(`     Bary for origin: a=${bary?.a.toFixed(4)}, b=${bary?.b.toFixed(4)}, c=${bary?.c.toFixed(4)}`);
          console.log(`     Inside? a>=-0.001: ${bary?.a >= -0.001}, b>=-0.001: ${bary?.b >= -0.001}, c>=-0.001: ${bary?.c >= -0.001}`);
        }
      }

      // For each UV point, find which triangle contains it
      uvPoints.forEach((uvPoint, idx) => {
        if (points3D[idx]) return; // Already found

        const targetU = uvPoint.u;
        const targetV = uvPoint.v;

        // Iterate through triangles
        for (let t = 0; t < triCount; t++) {
          // Get vertex indices - for non-indexed, vertices are sequential
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

          // Get UVs of triangle vertices
          const u0 = uvAttr.getX(i0), v0 = uvAttr.getY(i0);
          const u1 = uvAttr.getX(i1), v1 = uvAttr.getY(i1);
          const u2 = uvAttr.getX(i2), v2 = uvAttr.getY(i2);

          // Check if target UV is inside this triangle using barycentric coordinates
          const bary = computeBarycentricFast(targetU, targetV, u0, v0, u1, v1, u2, v2);
          
          if (bary && bary.a >= -0.001 && bary.b >= -0.001 && bary.c >= -0.001) {
            // Point is inside triangle, interpolate 3D position
            const px = posAttr.getX(i0) * bary.a + posAttr.getX(i1) * bary.b + posAttr.getX(i2) * bary.c;
            const py = posAttr.getY(i0) * bary.a + posAttr.getY(i1) * bary.b + posAttr.getY(i2) * bary.c;
            const pz = posAttr.getZ(i0) * bary.a + posAttr.getZ(i1) * bary.b + posAttr.getZ(i2) * bary.c;

            // Transform to world coordinates
            const pos3D = new THREE.Vector3(px, py, pz);
            pos3D.applyMatrix4(worldMatrix);

            points3D[idx] = pos3D;
            
            // Debug first successful mapping
            if (points3D.filter(p => p).length === 1) {
              console.log(`   ✅ First match! UV(${targetU.toFixed(4)}, ${targetV.toFixed(4)}) in tri ${t}`);
              console.log(`      Tri UVs: (${u0.toFixed(4)}, ${v0.toFixed(4)}), (${u1.toFixed(4)}, ${v1.toFixed(4)}), (${u2.toFixed(4)}, ${v2.toFixed(4)})`);
              console.log(`      Bary: (${bary.a.toFixed(4)}, ${bary.b.toFixed(4)}, ${bary.c.toFixed(4)})`);
            }
            return; // Found, move to next UV point
          }
        }
      });
    });

    console.log(`   Searched ${meshCount} meshes, ${totalTriangles} total triangles`);
    console.log(`   Generated ${uvPoints.length} UV points, mapped ${points3D.filter(p => p).length} to 3D`);
    
    // Debug: log first few mapped points
    points3D.forEach((p, idx) => {
      if (p && idx < 5) {
        console.log(`   Point ${idx}: UV(${uvPoints[idx].u.toFixed(4)}, ${uvPoints[idx].v.toFixed(4)}) -> 3D(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`);
      }
    });

    return { uvPoints, points3D };
  }, [clickData, meshRef, gridSize, gridSpacing]);

  // Notify parent when grid is ready
  useEffect(() => {
    if (gridData && onGridReady) {
      onGridReady(gridData);
    }
  }, [gridData, onGridReady]);

  // Render 3D points
  if (!gridData || !gridData.points3D) {
    console.log('❌ No gridData or points3D to render');
    return null;
  }
  
  const validPoints = gridData.points3D.filter(p => p);
  console.log(`🔵 Rendering ${validPoints.length} 3D spheres`);

  return (
    <group>
      {gridData.points3D.map((pos, idx) => {
        if (!pos) return null;
        return (
          <mesh key={idx} position={[pos.x, pos.y, pos.z]}>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshBasicMaterial color={idx === 0 ? '#ff6600' : '#0066ff'} />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * Compute barycentric coordinates of point P in triangle (A, B, C)
 * Returns { a, b, c } where P = a*A + b*B + c*C
 * Using a more robust method
 */
function computeBarycentricFast(px, py, ax, ay, bx, by, cx, cy) {
  // Vector from A to B, A to C, A to P
  const v0x = bx - ax;
  const v0y = by - ay;
  const v1x = cx - ax;
  const v1y = cy - ay;
  const v2x = px - ax;
  const v2y = py - ay;

  // Compute dot products
  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;

  // Compute barycentric coordinates
  const denom = dot00 * dot11 - dot01 * dot01;
  
  // For very small triangles, use a relative threshold
  const maxDot = Math.max(dot00, dot11);
  if (Math.abs(denom) < maxDot * 1e-10 || maxDot < 1e-20) {
    return null; // Degenerate triangle
  }

  const invDenom = 1 / denom;
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
  const w = 1 - u - v;

  // u = weight for B, v = weight for C, w = weight for A
  return { a: w, b: u, c: v };
}
