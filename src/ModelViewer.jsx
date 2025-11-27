import React, { useRef, useEffect, useState } from 'react';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
import * as THREE from 'three';
import { LoopSubdivision } from 'three-subdivide';
import { SUBTRACTION, Brush, Evaluator } from 'three-bvh-csg';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Apply boolean subtraction with text meshes using three-bvh-csg
function applyBooleanSubtraction(geometry, text, font, textScale, textSpacing, textOffsetX, textOffsetY, textDepth, textRotation, setTextMeshesCallback) {
  if (!text || text.length === 0) {
    console.log('⚠️ No text provided, skipping boolean subtraction');
    if (setTextMeshesCallback) setTextMeshesCallback([]);
    return geometry;
  }

  if (!font) {
    console.log('⚠️ Font not loaded yet, skipping boolean subtraction');
    if (setTextMeshesCallback) setTextMeshesCallback([]);
    return geometry;
  }

  // Calculate bounding box for text placement
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  const center = new THREE.Vector3();
  bbox.getCenter(center);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  
  console.log('🔲 Bounding box:', { center, size });
  
  // Ensure geometry has necessary attributes for CSG
  if (!geometry.attributes.uv) {
    console.log('⚠️ Geometry missing UVs, adding dummy UVs for CSG compatibility');
    const count = geometry.attributes.position.count;
    const uvs = new Float32Array(count * 2);
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }

  // Clean up attributes to ensure only standard ones exist (position, normal, uv)
  // This prevents "undefined is not an object (evaluating 'aAttr.array')" errors in three-bvh-csg
  const allowedAttributes = ['position', 'normal', 'uv'];
  for (const name in geometry.attributes) {
    if (!allowedAttributes.includes(name)) {
      console.log(`⚠️ Removing non-standard attribute '${name}' for CSG compatibility`);
      geometry.deleteAttribute(name);
    }
  }
  
  // Create brush from base geometry
  const baseBrush = new Brush(geometry);
  baseBrush.updateMatrixWorld();
  
  console.log('✅ Base brush created');
  console.log('   Vertices:', geometry.attributes.position.count);
  
  console.log(`📝 Creating text geometry for "${text}"...`);
  
  const textMeshes = [];
  const evaluator = new Evaluator();
  let result = baseBrush;
  
  // Calculate appropriate text size (use textScale parameter)
  const textHeight = size.y * textScale;
  
  // Create the entire text as a single geometry - this preserves proper baseline, kerning, and descenders
  const textGeom = new TextGeometry(text, {
    font: font,
    size: textHeight,
    height: 5, // Extrusion depth for boolean subtraction
    curveSegments: 12,
    bevelEnabled: false,
  });
  
  // Compute bounding box for positioning
  textGeom.computeBoundingBox();
  const textBBox = textGeom.boundingBox;
  const textWidth = textBBox.max.x - textBBox.min.x;
  const textHeightActual = textBBox.max.y - textBBox.min.y;
  
  console.log(`   Text dimensions: width=${textWidth.toFixed(3)}, height=${textHeightActual.toFixed(3)}`);
  
  // Ensure text geometry only has standard attributes
  for (const name in textGeom.attributes) {
    if (!allowedAttributes.includes(name)) {
      textGeom.deleteAttribute(name);
    }
  }
  
  // Calculate position - center the text
  // textOffsetX and textOffsetY are relative adjustments
  const originX = center.x - textWidth / 2 + (textOffsetX * size.x);
  // For Y positioning, we use the baseline (min.y of the text bbox) to ensure proper alignment
  // The text's min.y is at 0 after generation, and descenders go below 0
  const originY = center.y - textHeightActual / 2 + (textOffsetY * size.y);
  const originZ = center.z + (textDepth * size.z);
  
  // Rotation angle in radians
  const rotationRad = (textRotation * Math.PI) / 180;
  
  console.log(`   Position: (${originX.toFixed(2)}, ${originY.toFixed(2)}, ${originZ.toFixed(2)}), rotation: ${textRotation}°`);
  
  try {
    // Translate so left bottom corner is at origin (for proper rotation pivot)
    textGeom.translate(-textBBox.min.x, -textBBox.min.y, -textBBox.min.z);
    
    // Store text mesh info for visualization
    const visualGeom = textGeom.clone();
    textMeshes.push({ 
      x: originX, 
      y: originY, 
      z: originZ, 
      text: text, 
      geometry: visualGeom, 
      rotation: textRotation,
      width: textWidth,
      height: textHeightActual
    });
    
    // Create text brush
    const textBrush = new Brush(textGeom);
    textBrush.position.set(originX, originY, originZ);
    
    // Apply rotation around Z-axis
    textBrush.rotation.z = rotationRad;
    
    textBrush.updateMatrixWorld();
    
    // Perform subtraction
    result = evaluator.evaluate(result, textBrush, SUBTRACTION);
    console.log(`   ✅ Text subtracted - Result has ${result.geometry.attributes.position.count} vertices`);
    
    textGeom.dispose();
  } catch (error) {
    console.error(`   ❌ Failed to subtract text:`, error);
  }
  
  // Pass text meshes to callback for visualization
  console.log(`📦 Storing text mesh for visualization`);
  if (setTextMeshesCallback) {
    setTextMeshesCallback(textMeshes);
  }
  
  console.log('✅ Boolean subtraction complete');
  console.log('   Final vertices:', result.geometry.attributes.position.count);
  
  return result.geometry;
}

function ModelViewer({ 
  objUrl, 
  scaleX = 1.0,
  scaleY = 1.0,
  scaleZ = 1.0,
  twist = 0, 
  booleanSubtract = false, 
  subtractText = 'HELLO',
  textFont = 'helvetiker',
  textScale = 0.3,
  textSpacing = 1.0,
  textOffsetX = 0,
  textOffsetY = 0,
  textDepth = 0,
  textRotation = 0,
  showText = true,
  subdivisionLevel = 0,
  fixedScale = null, // Optional: use fixed scale instead of auto-calculated
  onGeometryReady = null 
}) {
  const groupRef = useRef();
  const [obj, setObj] = useState(null);
  const [normalizedScale, setNormalizedScale] = useState(1);
  const [originalGeometry, setOriginalGeometry] = useState(null);
  const [baseGeometry, setBaseGeometry] = useState(null); // Geometry after subdivision
  const [scaledGeometry, setScaledGeometry] = useState(null); // Geometry after X/Y/Z scale
  const [inscribedGeometry, setInscribedGeometry] = useState(null); // Geometry after boolean subtraction
  const [textMeshes, setTextMeshes] = useState([]); // Store text meshes for visualization
  const [font, setFont] = useState(null); // Loaded font
  const onGeometryReadyRef = useRef(onGeometryReady);

  // Font URLs mapping - mapped to closest available Three.js fonts
  const fontUrls = {
    helvetiker: 'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', // Helvetica
    gentilis: 'https://threejs.org/examples/fonts/gentilis_bold.typeface.json', // Garamond
    droid_sans: 'https://threejs.org/examples/fonts/droid/droid_sans_bold.typeface.json', // Inter
    optimer: 'https://threejs.org/examples/fonts/optimer_bold.typeface.json', // Caveat
    droid_serif: 'https://threejs.org/examples/fonts/droid/droid_serif_bold.typeface.json', // Pacifico
  };

  // Load font when textFont changes
  useEffect(() => {
    // Clear font first to prevent using old font
    setFont(null);
    
    const fontLoader = new FontLoader();
    const fontUrl = fontUrls[textFont] || fontUrls.helvetiker;
    
    console.log(`🔤 Loading font: ${textFont}`);
    fontLoader.load(
      fontUrl,
      (loadedFont) => {
        console.log(`✅ Font "${textFont}" loaded successfully`);
        setFont(loadedFont);
      },
      undefined,
      (error) => {
        console.error(`❌ Failed to load font "${textFont}":`, error);
      }
    );
  }, [textFont]);

  // Update ref when callback changes
  useEffect(() => {
    onGeometryReadyRef.current = onGeometryReady;
  }, [onGeometryReady]);

  // 手动加载 OBJ 模型
  useEffect(() => {
    if (!objUrl) return;

    const objLoader = new OBJLoader();

    objLoader.load(
      objUrl,
      (loadedObject) => {
        // Store original geometry for subdivision
        const geometries = [];
        
        // 预处理模型
        loadedObject.traverse((child) => {
          if (child.isMesh) {
            // Store original geometry clone
            geometries.push(child.geometry.clone());
            
            // 确保正确的光照法线（smooth shading 需要）
            child.geometry.computeVertexNormals();

            // 设置默认材质
            child.material = new THREE.MeshStandardMaterial({
              color: 0xd0d0d0,
              metalness: 0.1,
              roughness: 0.8,
              flatShading: false,
            });

            // 双面渲染
            child.material.side = THREE.DoubleSide;
            child.material.needsUpdate = true;
          }
        });
        
        // Store first geometry for export callback
        if (geometries.length > 0) {
          setOriginalGeometry(geometries[0]);
        }

        // 计算包围盒并居中
        const box = new THREE.Box3().setFromObject(loadedObject);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        console.log('📦 Bounding Box Center:', center);
        console.log('📦 Bounding Box Size:', size);

        // 将模型移到原点（居中）
        loadedObject.position.set(-center.x, -center.y, -center.z);

        // 计算合适的缩放比例，使模型适合视口（目标大小 2 个单位）
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetSize = 2;
        const scale = targetSize / maxDim;
        
        console.log('📏 Max Dimension:', maxDim);
        console.log('📏 Normalized Scale:', scale);

        // Use fixedScale if provided, otherwise use calculated scale
        const finalScale = fixedScale !== null ? fixedScale : scale;
        console.log('📏 Final Scale (fixedScale applied):', finalScale);

        // 保存归一化缩放比例
        setNormalizedScale(finalScale);
        setObj(loadedObject);
      },
      (progress) => {
        console.log('Loading:', Math.round((progress.loaded / progress.total) + '%'));
      },
      (err) => {
        console.error('OBJ 加载失败:', err);
      }
    );

    // 清理函数
    return () => {
      setObj(null);
      setOriginalGeometry(null);
    };
  }, [objUrl]);

  // Step 1: Apply subdivision only
  useEffect(() => {
    if (!obj || !originalGeometry) return;

    console.log(`🔄 Applying subdivision level ${subdivisionLevel}...`);
    const startTime = performance.now();

    obj.traverse((child) => {
      if (child.isMesh) {
        try {
          // Start with original geometry clone
          let geometry = originalGeometry.clone();

          if (subdivisionLevel > 0) {
            for (let i = 0; i < subdivisionLevel; i++) {
              geometry = LoopSubdivision.modify(geometry, 1);
            }
            console.log(`✅ Subdivision complete: ${geometry.attributes.position.count} vertices`);
          }

          geometry.computeVertexNormals();
          
          // Store as base geometry for scaling
          setBaseGeometry(geometry.clone());

          const elapsed = performance.now() - startTime;
          console.log(`⏱️ Subdivision took ${elapsed.toFixed(2)}ms`);
        } catch (error) {
          console.error('❌ Subdivision failed:', error);
        }
      }
    });
  }, [obj, originalGeometry, subdivisionLevel]);

  // Step 2: Apply X/Y/Z scaling (before inscription)
  useEffect(() => {
    if (!obj || !baseGeometry) return;

    console.log(`📏 Applying scales: X=${scaleX}, Y=${scaleY}, Z=${scaleZ}`);

    obj.traverse((child) => {
      if (child.isMesh) {
        try {
          // Clone base geometry
          const geometry = baseGeometry.clone();
          const positions = geometry.attributes.position;

          // Apply scaling to each vertex
          for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);

            positions.setXYZ(i, x * scaleX, y * scaleY, z * scaleZ);
          }

          positions.needsUpdate = true;
          
          // Recompute normals after scaling
          geometry.deleteAttribute('normal');
          geometry.computeVertexNormals();

          // Store as scaled geometry for inscription
          setScaledGeometry(geometry.clone());

          console.log('✅ Applied X/Y/Z scaling to geometry');
        } catch (error) {
          console.error('❌ Scaling failed:', error);
        }
      }
    });
  }, [obj, baseGeometry, scaleX, scaleY, scaleZ]);

  // Step 3: Apply boolean subtraction (inscription) after scaling
  useEffect(() => {
    if (!obj || !scaledGeometry) return;
    
    // If boolean subtraction is enabled, wait for font to load
    if (booleanSubtract && !font) {
      console.log('⏳ Waiting for font to load before applying boolean subtraction...');
      return;
    }

    console.log(`🔲 Boolean subtract enabled: ${booleanSubtract}`);
    const startTime = performance.now();

    obj.traverse((child) => {
      if (child.isMesh) {
        try {
          // Start with scaled geometry
          let geometry = scaledGeometry.clone();

          // Apply boolean subtraction if enabled
          if (booleanSubtract) {
            console.log('🔲 Applying boolean subtraction...');
            try {
              geometry = applyBooleanSubtraction(geometry, subtractText, font, textScale, textSpacing, textOffsetX, textOffsetY, textDepth, textRotation, setTextMeshes);
              console.log('✅ Boolean subtraction complete');
              
              // Merge duplicate vertices created by boolean operations
              // This is crucial for smooth normals to work properly
              console.log('🔧 Merging vertices...');
              const vertexCount = geometry.attributes.position.count;
              geometry = mergeVertices(geometry, 0.0001); // Merge vertices within 0.0001 units
              console.log(`✅ Merged vertices: ${vertexCount} → ${geometry.attributes.position.count}`);
              
              // Recompute normals for smooth shading after merging
              geometry.deleteAttribute('normal');
              geometry.computeVertexNormals();
              console.log('✅ Recomputed normals for smooth shading');
              
            } catch (error) {
              console.error('❌ Boolean subtraction failed:', error);
              setTextMeshes([]); // Clear text meshes on error
            }
          } else {
            setTextMeshes([]); // Clear text meshes when disabled
          }
          
          // Store as inscribed geometry for twist
          setInscribedGeometry(geometry.clone());
          
          // Replace geometry
          child.geometry.dispose();
          child.geometry = geometry;
          
          // Update material - always use smooth shading for final mesh
          child.material.flatShading = false;
          child.material.side = THREE.DoubleSide;
          child.material.needsUpdate = true;

          // Notify parent with geometry (will be overridden by twist if applied)
          if (onGeometryReadyRef.current) {
            onGeometryReadyRef.current(geometry);
          }

          const elapsed = performance.now() - startTime;
          console.log(`⏱️ Boolean subtraction took ${elapsed.toFixed(2)}ms`);
        } catch (error) {
          console.error('❌ Processing failed:', error);
        }
      }
    });
  }, [obj, scaledGeometry, booleanSubtract, subtractText, font, textScale, textSpacing, textOffsetX, textOffsetY, textDepth, textRotation, textFont]);

  // Step 4: Apply twist effect
  useEffect(() => {
    if (!obj || !inscribedGeometry) return;

    console.log(`🌀 Applying twist: ${twist}°`);

    obj.traverse((child) => {
      if (child.isMesh) {
        try {
          // Clone inscribed geometry (after inscription, before twist)
          const geometry = inscribedGeometry.clone();
          const positions = geometry.attributes.position;
          
          // Calculate bounding box to get X range (horizontal axis)
          geometry.computeBoundingBox();
          const minX = geometry.boundingBox.min.x;
          const maxX = geometry.boundingBox.max.x;
          const centerX = (minX + maxX) / 2;
          const xRange = maxX - minX;

          const minY = geometry.boundingBox.min.y;
          const maxY = geometry.boundingBox.max.y;
          const centerY = (minY + maxY) / 2;
          const yRange = maxY - minY;

          const minZ = geometry.boundingBox.min.z;
          const maxZ = geometry.boundingBox.max.z;
          const centerZ = (minZ + maxZ) / 2;
          const zRange = maxZ - minZ;

          const center = new THREE.Vector3(centerX, centerY, centerZ);

          if (xRange > 0 && twist !== 0) {
            // Convert twist angle to radians per unit distance
            const twistRadians = (twist * Math.PI) / 180;

            // Apply twist to each vertex
            for (let i = 0; i < positions.count; i++) {
              const x = positions.getX(i);
              const y = positions.getY(i);
              const z = positions.getZ(i);

              const dx = x - centerX;
              const dy = y - centerY;
              const dz = z - centerZ;

              // Calculate normalized distance from center X axis
              const distanceFromCenter = (x - centerX) / (xRange / 2);

              // Calculate radius from X-axis (distance in YZ plane)
              const radius = Math.sqrt(dy * dy + dz * dz);

              // Calculate current angle in YZ plane
              const currentAngle = Math.atan2(dz, dy);

              // Use a smoothstep-like function: twist increases then tapers off
              // At center (0): twist = 0
              // Increases as distance grows, but rate of increase decreases at edges
              const absDist = Math.abs(distanceFromCenter);
              const smoothFactor = absDist * (2 - absDist); // Parabolic curve: peaks at distance=1
              const twistAmount = twistRadians * Math.sign(distanceFromCenter) * smoothFactor;


              const newAngle = currentAngle + twistAmount;
              

              // Convert back to Cartesian coordinates
              // X stays the same, only Y and Z change
              const newY = radius * Math.cos(newAngle) + centerY;
              const newZ = radius * Math.sin(newAngle) + centerZ;

              positions.setXYZ(i, x, newY, newZ);
            }

            positions.needsUpdate = true;
            
            // Delete and recompute normals for smooth shading after twist
            geometry.deleteAttribute('normal');
            geometry.computeVertexNormals();
            console.log('✅ Recomputed normals after twist');
          }

          // Replace geometry
          child.geometry.dispose();
          child.geometry = geometry;
          
          // Ensure smooth shading
          child.material.flatShading = false;
          child.material.needsUpdate = true;

          // Notify parent with the final geometry
          if (onGeometryReadyRef.current) {
            onGeometryReadyRef.current(geometry);
          }
        } catch (error) {
          console.error('❌ Twist failed:', error);
        }
      }
    });
  }, [obj, inscribedGeometry, twist]);

  // Apply normalized scale only (X/Y/Z scales already applied to geometry)
  useEffect(() => {
    if (groupRef.current && obj) {
      // Apply only normalized scale (X/Y/Z scales are already in the geometry)
      groupRef.current.scale.set(
        normalizedScale,
        normalizedScale,
        normalizedScale
      );
    }
  }, [normalizedScale, obj]);

  // Debug: log textMeshes whenever it changes
  useEffect(() => {
    console.log('📦 Text meshes state:', textMeshes);
    console.log('📦 Number of characters:', textMeshes.length);
    console.log('📦 Normalized scale:', normalizedScale);
  }, [textMeshes, normalizedScale]);

  if (!obj) {
    return null; // 加载中或还没有模型
  }

  return (
    <>
      <group ref={groupRef}>
        <primitive object={obj} />
        
        {/* Visualize subtract text meshes - inside the same group to receive same transformations */}
        {showText && textMeshes.map((textMesh, index) => {
          // The text positions are in geometry's local space, but the object has been translated
          // We need to add the object's position offset to align them
          const objOffset = obj ? obj.position : new THREE.Vector3();
          
          // Apply twist transformation to text position if twist is enabled
          let displayX = textMesh.x + objOffset.x;
          let displayY = textMesh.y + objOffset.y;
          let displayZ = textMesh.z + objOffset.z;
          
          if (twist !== 0 && baseGeometry) {
            // Calculate twist transformation for text position
            baseGeometry.computeBoundingBox();
            const minX = baseGeometry.boundingBox.min.x;
            const maxX = baseGeometry.boundingBox.max.x;
            const centerX = (minX + maxX) / 2;
            const xRange = maxX - minX;
            
            const minY = baseGeometry.boundingBox.min.y;
            const maxY = baseGeometry.boundingBox.max.y;
            const centerY = (minY + maxY) / 2;
            
            const minZ = baseGeometry.boundingBox.min.z;
            const maxZ = baseGeometry.boundingBox.max.z;
            const centerZ = (minZ + maxZ) / 2;
            
            if (xRange > 0) {
              const twistRadians = (twist * Math.PI) / 180;
              const distanceFromCenter = (textMesh.x - centerX) / (xRange / 2);
              const parabolicFactor = distanceFromCenter * distanceFromCenter;
              const angle = twistRadians * parabolicFactor;
              
              const dy = textMesh.y - centerY;
              const dz = textMesh.z - centerZ;
              
              const cosAngle = Math.cos(angle);
              const sinAngle = Math.sin(angle);
              
              displayY = centerY + (dy * cosAngle - dz * sinAngle) + objOffset.y;
              displayZ = centerZ + (dy * sinAngle + dz * cosAngle) + objOffset.z;
            }
          }
          
          return (
            <mesh 
              key={index} 
              position={[displayX, displayY, displayZ]}
              rotation={[0, 0, ((textMesh.rotation || 0) * Math.PI) / 180]}
              geometry={textMesh.geometry}
            >
              <meshStandardMaterial 
                color="#00ff00" 
                transparent 
                opacity={0.3} 
              />
            </mesh>
          );
        })}
      </group>
    </>
  );
}

export default ModelViewer;
