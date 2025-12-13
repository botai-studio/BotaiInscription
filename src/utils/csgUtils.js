import * as THREE from 'three';
import { SUBTRACTION, Brush, Evaluator } from 'three-bvh-csg';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Subtract one geometry from another using CSG (three-bvh-csg)
 * 
 * @param {THREE.BufferGeometry} baseGeometry - The geometry to subtract from
 * @param {THREE.BufferGeometry} toolGeometry - The geometry to subtract
 * @returns {THREE.BufferGeometry} The resulting geometry after subtraction
 */
export function subtractGeometry(baseGeometry, toolGeometry) {
  if (!baseGeometry || !toolGeometry) {
    console.error('⚠️ subtractGeometry: Missing geometry');
    return baseGeometry;
  }

  console.log('🔪 Starting CSG subtraction...');
  console.log(`   Base: ${baseGeometry.attributes.position.count} vertices`);
  console.log(`   Tool: ${toolGeometry.attributes.position.count} vertices`);

  // Prepare geometries for CSG
  const baseClone = prepareGeometryForCSG(baseGeometry);
  const toolClone = prepareGeometryForCSG(toolGeometry);

  // Create brushes
  const baseBrush = new Brush(baseClone);
  baseBrush.updateMatrixWorld();

  const toolBrush = new Brush(toolClone);
  toolBrush.updateMatrixWorld();

  console.log('✅ CSG Brushes created');

  // Perform subtraction
  const evaluator = new Evaluator();
  
  let resultBrush;
  try {
    resultBrush = evaluator.evaluate(baseBrush, toolBrush, SUBTRACTION);
  } catch (error) {
    console.error('❌ CSG Evaluation failed:', error);
    return baseGeometry;
  }

  console.log('✅ CSG Subtraction complete');

  // Clean up and optimize result
  let resultGeometry = resultBrush.geometry;
  
  // Merge duplicate vertices
  resultGeometry = mergeVertices(resultGeometry, 0.0001);
  
  // Recompute normals
  resultGeometry.deleteAttribute('normal');
  resultGeometry.computeVertexNormals();

  console.log(`   Result: ${resultGeometry.attributes.position.count} vertices`);

  return resultGeometry;
}

/**
 * Prepare geometry for CSG operations
 * Ensures required attributes exist and removes problematic ones
 */
function prepareGeometryForCSG(geometry) {
  const clone = geometry.clone();
  
  // Ensure index exists
  if (!clone.index) {
    const posCount = clone.attributes.position.count;
    const indices = [];
    for (let i = 0; i < posCount; i++) {
      indices.push(i);
    }
    clone.setIndex(indices);
  }

  // Ensure UV exists
  if (!clone.attributes.uv) {
    const count = clone.attributes.position.count;
    const uvs = new Float32Array(count * 2);
    clone.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }

  // Ensure normals exist
  if (!clone.attributes.normal) {
    clone.computeVertexNormals();
  }

  // Remove non-standard attributes that might cause issues
  const allowedAttributes = ['position', 'normal', 'uv'];
  const attrNames = Object.keys(clone.attributes);
  for (const name of attrNames) {
    if (!allowedAttributes.includes(name)) {
      clone.deleteAttribute(name);
    }
  }

  return clone;
}

/**
 * Apply text carving to a mesh
 * 
 * @param {THREE.Mesh} targetMesh - The mesh to carve into
 * @param {THREE.BufferGeometry} textGeometry - The text geometry to subtract
 * @returns {THREE.BufferGeometry} The carved geometry
 */
export function carveTextIntoMesh(targetMesh, textGeometry) {
  if (!targetMesh || !textGeometry) {
    console.error('⚠️ carveTextIntoMesh: Missing mesh or text geometry');
    return targetMesh?.geometry;
  }

  // Get the base geometry in world space
  const baseGeometry = targetMesh.geometry.clone();
  
  // Apply mesh's world transform to geometry
  baseGeometry.applyMatrix4(targetMesh.matrixWorld);

  // Perform subtraction
  const result = subtractGeometry(baseGeometry, textGeometry);

  // Transform back to local space
  const inverseMatrix = new THREE.Matrix4().copy(targetMesh.matrixWorld).invert();
  result.applyMatrix4(inverseMatrix);

  return result;
}
