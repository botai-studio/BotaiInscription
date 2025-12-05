import React, { useState, useEffect, useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Surface Text Component - Dot Grid Approach
 * 
 * Creates a grid of dots in UV space (one rectangle per character),
 * then maps them onto the mesh surface using barycentric interpolation.
 */
export default function SurfaceText({ 
  position, 
  normal, 
  tangent, 
  bitangent, 
  text = 'Botai', 
  textScale = 0.1, 
  textRotation = 0,
  textDepth = 0.02,
  targetMesh = null,
  conformToSurface = true
}) {
  const [dotPositions, setDotPositions] = useState([]);
  
  // Calculate rotated basis vectors
  const basis = useMemo(() => {
    if (!normal || !tangent || !bitangent) return null;
    
    const rotAngle = (textRotation * Math.PI) / 180;
    const rotatedTangent = tangent.clone().applyAxisAngle(normal, rotAngle);
    const rotatedBitangent = bitangent.clone().applyAxisAngle(normal, rotAngle);
    
    return { tangent: rotatedTangent, bitangent: rotatedBitangent, normal: normal.clone() };
  }, [normal, tangent, bitangent, textRotation]);

  // Create dot grid and map to surface
  useEffect(() => {
    if (!text || text.length === 0 || !position || !basis) return;
    
    const numChars = text.length;
    const dotsPerCharX = 3; // 3 dots wide per character (left, center, right)
    const dotsPerCharY = 3; // 3 dots tall per character (bottom, middle, top) = 9 dots total
    const charWidth = textScale * 0.6; // Width of each character in UV space (narrower)
    const charHeight = textScale * 1.2; // Height of each character (taller - text ratio)
    const charSpacing = textScale * 0.4; // Space between characters (increased for more distance)
    
    // Click position is top-left corner (U=0 is left, V=0 is top)
    const startX = 0; // Start at click position (left edge)
    const startY = -charHeight; // Go downward from click position (top edge)
    
    // Generate dot positions in UV space (3x3 grid per character)
    const uvDots = [];
    
    for (let c = 0; c < numChars; c++) {
      const charStartX = startX + c * (charWidth + charSpacing);
      
      // 3x3 grid: corners (4) + edges (4) + center (1) = 9 dots
      for (let dy = 0; dy < dotsPerCharY; dy++) {
        for (let dx = 0; dx < dotsPerCharX; dx++) {
          const u = charStartX + (dx / (dotsPerCharX - 1)) * charWidth;
          const v = startY + (dy / (dotsPerCharY - 1)) * charHeight;
          const isCenter = (dx === 1 && dy === 1); // Middle dot
          const char = text[c]; // The actual character
          uvDots.push({ u, v, charIndex: c, isCenter, char });
        }
      }
    }
    
    console.log(`📝 Created ${uvDots.length} dots for "${text}" (${numChars} chars × 9 dots)`);
    
    // If no mesh to conform to, just transform to world space flat
    if (!conformToSurface || !targetMesh?.current) {
      const worldDots = uvDots.map(dot => {
        const worldPos = position.clone()
          .add(basis.tangent.clone().multiplyScalar(dot.u))
          .add(basis.bitangent.clone().multiplyScalar(dot.v))
          .add(basis.normal.clone().multiplyScalar(0.005));
        return worldPos;
      });
      setDotPositions(worldDots);
      console.log('📝 Flat dots in world space');
      return;
    }
    
    // Collect mesh triangles with UV coordinates
    // ONLY collect triangles whose face normal points same direction as click normal
    const mesh = targetMesh.current;
    const meshTriangles = [];
    
    mesh.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const geom = child.geometry;
        const posAttr = geom.attributes.position;
        const indexAttr = geom.index;
        
        if (!posAttr) return;
        
        child.updateMatrixWorld(true);
        const worldMatrix = child.matrixWorld;
        
        const worldPositions = [];
        for (let i = 0; i < posAttr.count; i++) {
          const v = new THREE.Vector3(
            posAttr.getX(i),
            posAttr.getY(i),
            posAttr.getZ(i)
          ).applyMatrix4(worldMatrix);
          worldPositions.push(v);
        }
        
        const numTris = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;
        
        for (let t = 0; t < numTris; t++) {
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
          
          // Compute face normal
          const edge1 = v1.clone().sub(v0);
          const edge2 = v2.clone().sub(v0);
          const faceNormal = edge1.clone().cross(edge2).normalize();
          
          // FILTER: Only include triangles facing the same direction as click normal
          // This prevents dots from appearing on the opposite side of the mesh
          const dotProduct = faceNormal.dot(basis.normal);
          if (dotProduct < 0.1) continue; // Skip back-facing or perpendicular triangles
          
          // Compute local UV for each vertex (projection onto tangent plane)
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
    
    console.log(`📐 Collected ${meshTriangles.length} front-facing mesh triangles`);
    
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
    
    // Map each dot to the surface
    const worldDots = [];
    let mappedCount = 0;
    
    for (const dot of uvDots) {
      const dotUV = new THREE.Vector2(dot.u, dot.v);
      
      let bestTriangle = null;
      let bestBary = null;
      let bestDist = Infinity;
      
      // Find triangle containing this UV point
      for (const tri of meshTriangles) {
        const bary = barycentricCoords(dotUV, tri.uv0, tri.uv1, tri.uv2);
        if (!bary) continue;
        
        // Check if inside triangle
        if (bary.u >= -0.001 && bary.v >= -0.001 && bary.w >= -0.001) {
          bestTriangle = tri;
          bestBary = bary;
          break;
        }
        
        // Track closest as fallback
        const center = tri.uv0.clone().add(tri.uv1).add(tri.uv2).divideScalar(3);
        const dist = dotUV.distanceTo(center);
        if (dist < bestDist) {
          bestDist = dist;
          bestTriangle = tri;
          bestBary = bary;
        }
      }
      
      // Only add dot if we found a front-facing triangle
      if (bestTriangle && bestBary && 
          bestBary.u >= -0.5 && bestBary.v >= -0.5 && bestBary.w >= -0.5) {
        // Interpolate 3D position using barycentric coords
        const surfacePos = new THREE.Vector3()
          .addScaledVector(bestTriangle.v0, bestBary.w)
          .addScaledVector(bestTriangle.v1, bestBary.v)
          .addScaledVector(bestTriangle.v2, bestBary.u);
        
        // Offset along the LOCAL face normal (not click normal) to prevent occlusion
        // Use a larger offset scaled with textScale to ensure visibility
        const offsetAmount = Math.max(0.008, textScale * 0.1);
        surfacePos.add(bestTriangle.faceNormal.clone().multiplyScalar(offsetAmount));
        worldDots.push({
          position: surfacePos,
          charIndex: dot.charIndex,
          isCenter: dot.isCenter,
          char: dot.char
        });
        mappedCount++;
      }
      // Skip dots that don't map to front-facing triangles (no fallback to prevent back-side dots)
    }
    
    setDotPositions(worldDots);
    console.log(`✅ Dots mapped to surface: ${mappedCount}/${uvDots.length}`);
    
  }, [text, textScale, textRotation, position, basis, targetMesh, conformToSurface]);

  // Colors for different characters
  const charColors = [
    '#e53935', // red
    '#43a047', // green
    '#1e88e5', // blue
    '#fb8c00', // orange
    '#8e24aa', // purple
    '#00acc1', // cyan
    '#ffb300', // amber
    '#6d4c41', // brown
    '#546e7a', // blue-grey
    '#d81b60', // pink
  ];

  if (dotPositions.length === 0 || !position) return null;

  const dotSize = textScale * 0.06; // Size of each dot

  return (
    <group>
      {dotPositions.map((dot, i) => (
        <group key={i}>
          <mesh position={[dot.position.x, dot.position.y, dot.position.z]}>
            <sphereGeometry args={[dotSize, 8, 8]} />
            <meshStandardMaterial color={charColors[dot.charIndex % charColors.length]} />
          </mesh>
          {/* Label on center dot */}
          {dot.isCenter && (
            <Html
              position={[dot.position.x, dot.position.y, dot.position.z]}
              style={{ pointerEvents: 'none' }}
              center
            >
              <div style={{
                background: charColors[dot.charIndex % charColors.length],
                color: 'white',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '12px',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                transform: 'translateY(-20px)'
              }}>
                {dot.char}
              </div>
            </Html>
          )}
        </group>
      ))}
    </group>
  );
}
