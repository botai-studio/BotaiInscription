import * as THREE from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
import { SUBTRACTION, Brush, Evaluator } from 'three-bvh-csg';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Generic function to subtract one geometry from another using CSG.
 * Both geometries should be in the same coordinate space.
 * 
 * @param {THREE.BufferGeometry} baseGeometry - The geometry to subtract from.
 * @param {THREE.BufferGeometry} subGeometry - The geometry to subtract.
 * @returns {THREE.BufferGeometry} The resulting geometry after subtraction.
 */
export function subtractGeometry(baseGeometry, subGeometry) {
  if (!baseGeometry || !subGeometry) {
    console.error('⚠️ subtractGeometry: Missing geometry');
    return baseGeometry;
  }

  console.log('🔪 Starting geometry subtraction...');

  // Ensure geometries have necessary attributes for CSG
  const ensureAttributes = (geom) => {
    if (!geom.attributes.uv) {
      const count = geom.attributes.position.count;
      const uvs = new Float32Array(count * 2);
      geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    }
    
    // Clean up attributes to ensure only standard ones exist
    const allowedAttributes = ['position', 'normal', 'uv'];
    for (const name in geom.attributes) {
      if (!allowedAttributes.includes(name)) {
        geom.deleteAttribute(name);
      }
    }
  };

  const baseClone = baseGeometry.clone();
  const subClone = subGeometry.clone();
  
  ensureAttributes(baseClone);
  ensureAttributes(subClone);

  // Create brushes
  const baseBrush = new Brush(baseClone);
  baseBrush.updateMatrixWorld();

  const subBrush = new Brush(subClone);
  subBrush.updateMatrixWorld();

  console.log('✅ Brushes created');

  // Perform subtraction
  const evaluator = new Evaluator();
  
  let resultBrush;
  try {
    resultBrush = evaluator.evaluate(baseBrush, subBrush, SUBTRACTION);
  } catch (error) {
    console.error('❌ CSG Evaluation failed:', error);
    return baseGeometry;
  }

  console.log('✅ Subtraction complete');

  // Clean up and optimize result
  let resultGeometry = resultBrush.geometry;
  resultGeometry = mergeVertices(resultGeometry, 0.0001);
  resultGeometry.deleteAttribute('normal');
  resultGeometry.computeVertexNormals();

  return resultGeometry;
}

// Apply boolean subtraction with text meshes using three-bvh-csg
export function applyBooleanSubtraction(geometry, text, font, textScale, textSpacing, textOffsetX, textOffsetY, textDepth, textRotation, setTextMeshesCallback) {
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
  
  // Merge duplicate vertices for smooth normals
  console.log('🔧 Merging vertices...');
  let finalGeometry = result.geometry;
  const vertexCount = finalGeometry.attributes.position.count;
  finalGeometry = mergeVertices(finalGeometry, 0.0001);
  console.log(`✅ Merged vertices: ${vertexCount} → ${finalGeometry.attributes.position.count}`);

  // Recompute normals
  finalGeometry.deleteAttribute('normal');
  finalGeometry.computeVertexNormals();
  
  return finalGeometry;
}

// Apply boolean subtraction with test mode inscriptions
// Each inscription has: { text, scale, rotation, depth, clickData }
// clickData has: { point, normal, tangent, bitangent } in world coordinates
export function applyInscriptionSubtraction(geometry, inscriptions, normalizedScale, font) {
  if (!inscriptions || inscriptions.length === 0) {
    console.log('⚠️ No inscriptions to apply');
    return geometry;
  }

  if (!font) {
    console.log('⚠️ Font not loaded yet, skipping inscription subtraction');
    return geometry;
  }

  // Filter inscriptions that have valid clickData
  const validInscriptions = inscriptions.filter(i => i.clickData);
  if (validInscriptions.length === 0) {
    console.log('⚠️ No inscriptions with valid positions');
    return geometry;
  }

  console.log(`🔲 Applying ${validInscriptions.length} inscriptions...`);

  // Ensure geometry has necessary attributes for CSG
  if (!geometry.attributes.uv) {
    console.log('⚠️ Geometry missing UVs, adding dummy UVs for CSG compatibility');
    const count = geometry.attributes.position.count;
    const uvs = new Float32Array(count * 2);
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }

  // Clean up attributes to ensure only standard ones exist
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

  const evaluator = new Evaluator();
  let result = baseBrush;

  // Process each inscription
  for (const inscription of validInscriptions) {
    const { text, scale, rotation, depth, clickData } = inscription;
    
    if (!clickData || !clickData.point) {
      console.log(`⚠️ Skipping inscription "${text}" - no click position`);
      continue;
    }

    console.log(`📝 Processing inscription "${text}"...`);

    try {
      // The clickData is in world coordinates (after normalizedScale is applied)
      // We need to convert to local coordinates (before scale)
      const localPoint = clickData.point.clone().divideScalar(normalizedScale);
      const localNormal = clickData.normal.clone(); // Normal direction doesn't change with scale
      const localTangent = clickData.tangent.clone();
      const localBitangent = clickData.bitangent.clone();

      // Create text geometry
      // Use scale relative to mesh size
      geometry.computeBoundingBox();
      const bbox = geometry.boundingBox;
      const size = new THREE.Vector3();
      bbox.getSize(size);
      
      // Text height based on inscription scale parameter and mesh size
      const textHeight = size.y * scale;
      
      const textGeom = new TextGeometry(text, {
        font: font,
        size: textHeight,
        height: depth * size.y * 10, // Extrusion depth - multiply by 10 for sufficient depth
        curveSegments: 12,
        bevelEnabled: false,
      });

      // Compute bounding box for positioning
      textGeom.computeBoundingBox();
      const textBBox = textGeom.boundingBox;
      const textWidth = textBBox.max.x - textBBox.min.x;
      const textHeightActual = textBBox.max.y - textBBox.min.y;

      // Clean up text geometry attributes
      for (const name in textGeom.attributes) {
        if (!allowedAttributes.includes(name)) {
          textGeom.deleteAttribute(name);
        }
      }

      // Center the text at origin first
      textGeom.translate(-textWidth / 2, -textHeightActual / 2, 0);

      // Create text brush
      const textBrush = new Brush(textGeom);
      
      // Position at the click point
      textBrush.position.copy(localPoint);
      
      // Create rotation matrix to align text with surface
      // Z-axis should point along normal (into the surface for subtraction)
      // X-axis along tangent (text direction)
      // Y-axis along bitangent
      const rotMatrix = new THREE.Matrix4();
      rotMatrix.makeBasis(localTangent, localBitangent, localNormal.clone().negate());
      
      // Extract euler angles from rotation matrix
      const euler = new THREE.Euler();
      euler.setFromRotationMatrix(rotMatrix);
      textBrush.rotation.copy(euler);
      
      // Apply additional rotation around the normal (Z in local text space)
      textBrush.rotateZ((rotation * Math.PI) / 180);
      
      // Move text slightly along normal for proper intersection
      const offsetAlongNormal = depth * size.y * 5;
      textBrush.position.add(localNormal.clone().multiplyScalar(offsetAlongNormal));
      
      textBrush.updateMatrixWorld();

      // Perform subtraction
      result = evaluator.evaluate(result, textBrush, SUBTRACTION);
      console.log(`   ✅ "${text}" subtracted - Result has ${result.geometry.attributes.position.count} vertices`);

      textGeom.dispose();
    } catch (error) {
      console.error(`   ❌ Failed to subtract "${text}":`, error);
    }
  }

  // Merge duplicate vertices for smooth normals
  console.log('🔧 Merging vertices...');
  let finalGeometry = result.geometry;
  const vertexCount = finalGeometry.attributes.position.count;
  finalGeometry = mergeVertices(finalGeometry, 0.0001);
  console.log(`✅ Merged vertices: ${vertexCount} → ${finalGeometry.attributes.position.count}`);

  // Recompute normals
  finalGeometry.deleteAttribute('normal');
  finalGeometry.computeVertexNormals();
  console.log('✅ Recomputed normals');

  console.log('✅ Inscription subtraction complete');
  return finalGeometry;
}
