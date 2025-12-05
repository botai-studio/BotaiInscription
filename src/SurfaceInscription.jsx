import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Html, Text3D, Center } from '@react-three/drei';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';

/**
 * SurfaceInscription Component
 * 
 * Handles click detection on mesh surface for placing inscriptions.
 * Step 1: Raycast to find intersection point and surface normal
 * Step 2: Generate text geometry at the clicked position, oriented to surface
 */

// Helper component to show the click marker on the surface
function ClickMarker({ position, normal, tangent, bitangent, textScale = 0.1, textRotation = 0, inscriptionText = 'Botai' }) {
  const groupRef = useRef();
  
  // Base size multiplier - arrows scale with textScale
  const baseLength = 0.5; // Base arrow length
  const arrowLength = baseLength * (textScale / 0.1); // Scale relative to default 0.1
  const markerSize = 0.02 * (textScale / 0.1);
  
  // Arrow head proportions
  const headLength = arrowLength * 0.15;
  const headWidth = arrowLength * 0.08;
  
  // Create rotation using tangent/bitangent/normal basis vectors
  const rotation = useMemo(() => {
    if (!normal || !tangent || !bitangent) return new THREE.Euler();
    
    // Apply text rotation around normal first
    const rotatedTangent = tangent.clone();
    const rotatedBitangent = bitangent.clone();
    const rotAngle = (textRotation * Math.PI) / 180;
    
    // Rotate tangent and bitangent around normal
    rotatedTangent.applyAxisAngle(normal, rotAngle);
    rotatedBitangent.applyAxisAngle(normal, rotAngle);
    
    // Build rotation matrix: columns are X (tangent), Y (bitangent), Z (normal)
    const matrix = new THREE.Matrix4();
    matrix.makeBasis(rotatedTangent, rotatedBitangent, normal);
    
    const euler = new THREE.Euler();
    euler.setFromRotationMatrix(matrix);
    return euler;
  }, [normal, tangent, bitangent, textRotation]);

  // Create arrow helpers with SAME length for all axes
  const normalArrow = useMemo(() => {
    return new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, 0),
      arrowLength,
      0x2196F3,
      headLength,
      headWidth
    );
  }, [arrowLength, headLength, headWidth]);

  const tangentArrow = useMemo(() => {
    return new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      arrowLength,
      0xff0000,
      headLength,
      headWidth
    );
  }, [arrowLength, headLength, headWidth]);

  const bitangentArrow = useMemo(() => {
    return new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 0),
      arrowLength,
      0x00ff00,
      headLength,
      headWidth
    );
  }, [arrowLength, headLength, headWidth]);

  if (!position) return null;

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Small sphere at intersection point */}
      <mesh>
        <sphereGeometry args={[markerSize, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      
      {/* Normal direction arrow (blue - Z axis) */}
      <primitive object={normalArrow} />
      
      {/* Tangent direction arrow (red - X axis) - represents text direction */}
      {tangent && <primitive object={tangentArrow} />}
      
      {/* Bitangent direction arrow (green - Y axis) */}
      {bitangent && <primitive object={bitangentArrow} />}
      
      {/* Text direction indicator label */}
      <Html position={[arrowLength * 1.1, 0, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(255, 0, 0, 0.8)',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '9px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
        }}>
          Text →
        </div>
      </Html>
      
      {/* Info display */}
      <Html position={[0, arrowLength * 1.1, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(33, 150, 243, 0.9)',
          color: 'white',
          padding: '6px 10px',
          borderRadius: '4px',
          fontSize: '10px',
          whiteSpace: 'nowrap',
          transform: 'translateX(-50%)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}>
          <strong>{inscriptionText}</strong>
        </div>
      </Html>
    </group>
  );
}

// Main component that handles raycasting
function SurfaceRaycaster({ meshRef, onSurfaceClick, enabled = true }) {
  const { camera, gl, scene } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useMemo(() => new THREE.Vector2(), []);
  const isAKeyDown = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const performRaycast = (event) => {
      // Get canvas bounds
      const rect = gl.domElement.getBoundingClientRect();
      
      // Calculate normalized device coordinates
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Update raycaster
      raycaster.setFromCamera(mouse, camera);

      // Find intersections with the mesh
      let intersects = [];
      
      if (meshRef && meshRef.current) {
        // Raycast against the specific mesh
        intersects = raycaster.intersectObject(meshRef.current, true);
      } else {
        // Raycast against all meshes in the scene
        intersects = raycaster.intersectObjects(scene.children, true);
      }

      // Filter to only mesh objects (not helpers, etc.)
      const meshIntersects = intersects.filter(i => i.object.isMesh);

      if (meshIntersects.length > 0) {
        const hit = meshIntersects[0];
        
        // Get the intersection point in world coordinates
        const point = hit.point.clone();
        
        // Get the face normal in world coordinates
        const normal = hit.face.normal.clone();
        
        // Transform normal to world coordinates
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
        normal.applyMatrix3(normalMatrix).normalize();

        // Calculate tangent and bitangent for text orientation
        // Use camera's right direction to align text horizontally from viewer's perspective
        const cameraRight = new THREE.Vector3();
        camera.matrixWorld.extractBasis(cameraRight, new THREE.Vector3(), new THREE.Vector3());
        cameraRight.normalize();
        
        let tangent = new THREE.Vector3();
        let bitangent = new THREE.Vector3();

        // Project camera right onto the surface plane (perpendicular to normal)
        // tangent = cameraRight - (cameraRight · normal) * normal
        tangent.copy(cameraRight).addScaledVector(normal, -cameraRight.dot(normal));
        
        // If projection is too small (camera right is parallel to normal), use camera up
        if (tangent.lengthSq() < 0.01) {
          const cameraUp = new THREE.Vector3();
          camera.matrixWorld.extractBasis(new THREE.Vector3(), cameraUp, new THREE.Vector3());
          tangent.copy(cameraUp).addScaledVector(normal, -cameraUp.dot(normal));
        }
        tangent.normalize();
        
        // Bitangent is perpendicular to both normal and tangent
        bitangent.crossVectors(normal, tangent).normalize();

        // Call the callback with hit information
        if (onSurfaceClick) {
          onSurfaceClick({
            point,
            normal,
            tangent,
            bitangent,
            face: hit.face,
            uv: hit.uv,
            object: hit.object,
            distance: hit.distance
          });
        }
      }
    };

    const handleKeyDown = (event) => {
      // Check for 'A' key (case insensitive)
      if (event.key === 'a' || event.key === 'A') {
        isAKeyDown.current = true;
      }
    };

    const handleKeyUp = (event) => {
      if (event.key === 'a' || event.key === 'A') {
        isAKeyDown.current = false;
      }
    };

    const handleMouseMove = (event) => {
      // Only raycast when holding 'A' key
      if (!isAKeyDown.current) return;
      performRaycast(event);
    };

    const handleClick = (event) => {
      // Also support single click to place
      performRaycast(event);
    };

    // Add keyboard and mouse listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    gl.domElement.addEventListener('mousemove', handleMouseMove);
    gl.domElement.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      gl.domElement.removeEventListener('mousemove', handleMouseMove);
      gl.domElement.removeEventListener('click', handleClick);
    };
  }, [enabled, camera, gl, scene, meshRef, raycaster, mouse, onSurfaceClick]);

  return null;
}

/**
 * Surface Text Component - Dot Grid Approach
 * 
 * Creates a grid of dots in UV space (one rectangle per character),
 * then maps them onto the mesh surface using barycentric interpolation.
 */
function SurfaceText({ 
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

/**
 * Surface Text Mesh Component - Font-based approach
 * 
 * Creates actual text geometry from fonts, maps vertices to the curved surface,
 * and extrudes to create a closed mesh suitable for boolean operations.
 */
function SurfaceTextMesh({ 
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
  const [geometry, setGeometry] = useState(null);
  const [font, setFont] = useState(null);
  
  // Load font
  useEffect(() => {
    const loader = new FontLoader();
    loader.load('/fonts/helvetiker_regular.typeface.json', (loadedFont) => {
      setFont(loadedFont);
      console.log('🔤 Font loaded for SurfaceTextMesh');
    }, undefined, (err) => {
      console.error('Failed to load font:', err);
      // Try alternative path
      loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (loadedFont) => {
        setFont(loadedFont);
        console.log('🔤 Font loaded from CDN');
      });
    });
  }, []);
  
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

/**
 * UV Map Visualization Component
 * Shows a checkerboard-textured plane in the local UV space around the click point
 */
function UVMapVisualization({ 
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

// Main exported component
export default function SurfaceInscription({ 
  meshRef, 
  enabled = true,
  inscriptionText = 'Botai',
  textScale = 0.1,
  textRotation = 0,
  textDepth = 0.02,
  clickData = null,
  showMarker = true,
  showText = true,
  showTextMesh = false,
  conformToSurface = true,
  showUVMap = false,
  onInscriptionPlaced = null
}) {
  const handleSurfaceClick = (data) => {
    console.log('📍 Inscription placement point updated');
    
    if (onInscriptionPlaced) {
      onInscriptionPlaced(data);
    }
  };

  return (
    <>
      <SurfaceRaycaster 
        meshRef={meshRef} 
        onSurfaceClick={handleSurfaceClick}
        enabled={enabled}
      />
      
      {/* Marker arrows */}
      {clickData && showMarker && (
        <ClickMarker 
          position={clickData.point}
          normal={clickData.normal}
          tangent={clickData.tangent}
          bitangent={clickData.bitangent}
          textScale={textScale}
          textRotation={textRotation}
          inscriptionText={inscriptionText}
        />
      )}
      
      {/* UV Map Visualization */}
      {clickData && showUVMap && (
        <UVMapVisualization
          position={clickData.point}
          normal={clickData.normal}
          tangent={clickData.tangent}
          bitangent={clickData.bitangent}
          textScale={textScale}
          textRotation={textRotation}
          targetMesh={meshRef}
        />
      )}
      
      {/* Dot Grid Text on surface (original approach) */}
      {clickData && showText && (
        <SurfaceText
          position={clickData.point}
          normal={clickData.normal}
          tangent={clickData.tangent}
          bitangent={clickData.bitangent}
          text={inscriptionText}
          textScale={textScale}
          textRotation={textRotation}
          textDepth={textDepth}
          targetMesh={meshRef}
          conformToSurface={conformToSurface}
        />
      )}
      
      {/* Font-based Text Mesh on surface (new approach) */}
      {clickData && showTextMesh && (
        <SurfaceTextMesh
          position={clickData.point}
          normal={clickData.normal}
          tangent={clickData.tangent}
          bitangent={clickData.bitangent}
          text={inscriptionText}
          textScale={textScale}
          textRotation={textRotation}
          textDepth={textDepth}
          targetMesh={meshRef}
          conformToSurface={conformToSurface}
        />
      )}
    </>
  );
}

// Export the marker component for potential external use
export { ClickMarker, SurfaceRaycaster, SurfaceText, SurfaceTextMesh, UVMapVisualization };
