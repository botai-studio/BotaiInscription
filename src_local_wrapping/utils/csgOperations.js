import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

/**
 * CSG Operations utility for boolean mesh operations
 */

/**
 * Ensure geometry has all required attributes for CSG
 * @param {THREE.BufferGeometry} geometry 
 */
function ensureRequiredAttributes(geometry) {
  const vertexCount = geometry.attributes.position.count;
  
  // Add dummy UVs if not present (required by three-bvh-csg)
  if (!geometry.attributes.uv) {
    console.log('   Adding dummy UV attribute...');
    const uvs = new Float32Array(vertexCount * 2);
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  }
  
  // Compute normals if not present
  if (!geometry.attributes.normal) {
    console.log('   Computing normals...');
    geometry.computeVertexNormals();
  }
}

/**
 * Subtract tool geometry from target geometry
 * @param {THREE.BufferGeometry} targetGeometry - The geometry to subtract from
 * @param {THREE.BufferGeometry} toolGeometry - The geometry to subtract
 * @returns {THREE.BufferGeometry} - The resulting geometry
 */
export function subtractGeometries(targetGeometry, toolGeometry) {
  console.log('🔧 Starting CSG subtraction...');
  
  // Ensure geometries have required attributes
  if (!targetGeometry.attributes.position) {
    throw new Error('Target geometry has no position attribute');
  }
  if (!toolGeometry.attributes.position) {
    throw new Error('Tool geometry has no position attribute');
  }
  
  // Clone geometries to avoid modifying originals
  const targetClone = targetGeometry.clone();
  const toolClone = toolGeometry.clone();
  
  // Ensure geometries are indexed (required by three-bvh-csg)
  if (!targetClone.index) {
    console.log('   Converting target to indexed geometry...');
    targetClone.setIndex([...Array(targetClone.attributes.position.count).keys()]);
  }
  if (!toolClone.index) {
    console.log('   Converting tool to indexed geometry...');
    toolClone.setIndex([...Array(toolClone.attributes.position.count).keys()]);
  }
  
  // Ensure required attributes (UVs, normals)
  ensureRequiredAttributes(targetClone);
  ensureRequiredAttributes(toolClone);
  
  // Compute bounding boxes if not present
  if (!targetClone.boundingBox) targetClone.computeBoundingBox();
  if (!toolClone.boundingBox) toolClone.computeBoundingBox();
  
  console.log(`   Target: ${targetClone.attributes.position.count} vertices`);
  console.log(`   Tool: ${toolClone.attributes.position.count} vertices`);
  
  // Create brushes
  const targetBrush = new Brush(targetClone);
  const toolBrush = new Brush(toolClone);
  
  // Create evaluator and perform subtraction
  const evaluator = new Evaluator();
  
  console.log('   Performing boolean subtraction...');
  const startTime = performance.now();
  
  const resultBrush = evaluator.evaluate(targetBrush, toolBrush, SUBTRACTION);
  
  const endTime = performance.now();
  console.log(`   ✅ CSG completed in ${(endTime - startTime).toFixed(0)}ms`);
  
  // Get the resulting geometry
  const resultGeometry = resultBrush.geometry;
  
  console.log(`   Result: ${resultGeometry.attributes.position.count} vertices`);
  
  // Clean up
  targetBrush.geometry.dispose();
  toolBrush.geometry.dispose();
  
  return resultGeometry;
}

/**
 * Get merged geometry from a Three.js group/object
 * @param {THREE.Object3D} object - The object to extract geometry from
 * @returns {THREE.BufferGeometry} - Merged geometry in world space
 */
export function getMergedGeometry(object) {
  const geometries = [];
  
  object.traverse((child) => {
    if (child.isMesh && child.geometry) {
      // Clone geometry and apply world transform
      const geom = child.geometry.clone();
      
      // Apply the mesh's world matrix to the geometry
      child.updateWorldMatrix(true, false);
      geom.applyMatrix4(child.matrixWorld);
      
      geometries.push(geom);
    }
  });
  
  if (geometries.length === 0) {
    throw new Error('No mesh geometries found in object');
  }
  
  if (geometries.length === 1) {
    return geometries[0];
  }
  
  // Merge multiple geometries
  const merged = mergeBufferGeometries(geometries);
  
  // Dispose temporary geometries
  geometries.forEach(g => g.dispose());
  
  return merged;
}

/**
 * Simple buffer geometry merge (for multiple geometries)
 */
function mergeBufferGeometries(geometries) {
  let totalVertices = 0;
  let totalIndices = 0;
  
  geometries.forEach(geom => {
    totalVertices += geom.attributes.position.count;
    if (geom.index) {
      totalIndices += geom.index.count;
    } else {
      totalIndices += geom.attributes.position.count;
    }
  });
  
  const positions = new Float32Array(totalVertices * 3);
  const indices = [];
  
  let vertexOffset = 0;
  let indexOffset = 0;
  
  geometries.forEach(geom => {
    const posAttr = geom.attributes.position;
    
    // Copy positions
    for (let i = 0; i < posAttr.count; i++) {
      positions[(vertexOffset + i) * 3] = posAttr.getX(i);
      positions[(vertexOffset + i) * 3 + 1] = posAttr.getY(i);
      positions[(vertexOffset + i) * 3 + 2] = posAttr.getZ(i);
    }
    
    // Copy indices
    if (geom.index) {
      for (let i = 0; i < geom.index.count; i++) {
        indices.push(geom.index.getX(i) + vertexOffset);
      }
    } else {
      for (let i = 0; i < posAttr.count; i++) {
        indices.push(i + vertexOffset);
      }
    }
    
    vertexOffset += posAttr.count;
  });
  
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setIndex(indices);
  merged.computeVertexNormals();
  
  return merged;
}
