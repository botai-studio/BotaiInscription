import * as THREE from 'three';
import { SUBTRACTION, ADDITION, Brush, Evaluator } from 'three-bvh-csg';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js';

/**
 * Simplify geometry by collapsing edges in planar areas while preserving sharp features
 * 
 * @param {THREE.BufferGeometry} geometry - The geometry to simplify
 * @param {number} targetReduction - Target reduction ratio (0.3 = keep 30% of triangles)
 * @returns {THREE.BufferGeometry} Simplified geometry
 */
export function simplifyGeometry(geometry, targetReduction = 0.5) {
  if (!geometry || !geometry.attributes.position) {
    return geometry;
  }

  console.log('🔧 Simplifying geometry...');
  
  // First merge very close vertices
  let simplified = mergeVertices(geometry.clone(), 0.0001);
  
  // Ensure we have index
  if (!simplified.index) {
    const posCount = simplified.attributes.position.count;
    const indices = [];
    for (let i = 0; i < posCount; i++) {
      indices.push(i);
    }
    simplified.setIndex(indices);
  }
  
  const startTriangles = simplified.index.count / 3;
  console.log(`   Start: ${startTriangles} triangles`);
  
  // Calculate target triangle count
  const targetCount = Math.floor(startTriangles * targetReduction);
  
  if (targetCount >= startTriangles) {
    console.log('   No simplification needed');
    return simplified;
  }
  
  try {
    // Use Three.js SimplifyModifier
    const modifier = new SimplifyModifier();
    
    // SimplifyModifier takes the number of vertices to REMOVE
    const verticesToRemove = simplified.attributes.position.count - Math.floor(simplified.attributes.position.count * targetReduction);
    
    if (verticesToRemove > 0) {
      simplified = modifier.modify(simplified, verticesToRemove);
    }
    
    const endTriangles = simplified.index ? simplified.index.count / 3 : simplified.attributes.position.count / 3;
    console.log(`   End: ${endTriangles} triangles`);
    console.log(`   Reduction: ${((1 - endTriangles / startTriangles) * 100).toFixed(1)}%`);
  } catch (error) {
    console.warn('⚠️ Simplification failed, using original:', error.message);
    return mergeVertices(geometry.clone(), 0.0001);
  }
  
  // Recompute normals
  if (simplified.attributes.normal) {
    simplified.deleteAttribute('normal');
  }
  simplified.computeVertexNormals();

  return simplified;
}

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
 * Union two geometries using CSG (three-bvh-csg)
 * 
 * @param {THREE.BufferGeometry} geometryA - The first geometry
 * @param {THREE.BufferGeometry} geometryB - The second geometry to union
 * @param {boolean} simplify - Whether to simplify the result (default true)
 * @returns {THREE.BufferGeometry} The resulting geometry after union
 */
export function unionGeometry(geometryA, geometryB, simplify = true) {
  if (!geometryA || !geometryB) {
    console.error('⚠️ unionGeometry: Missing geometry');
    return geometryA || geometryB;
  }

  console.log('🔗 Starting CSG union...');
  console.log(`   A: ${geometryA.attributes.position.count} vertices`);
  console.log(`   B: ${geometryB.attributes.position.count} vertices`);

  // Prepare geometries for CSG
  const cloneA = prepareGeometryForCSG(geometryA);
  const cloneB = prepareGeometryForCSG(geometryB);

  // Create brushes
  const brushA = new Brush(cloneA);
  brushA.updateMatrixWorld();

  const brushB = new Brush(cloneB);
  brushB.updateMatrixWorld();

  console.log('✅ CSG Brushes created');

  // Perform union
  const evaluator = new Evaluator();
  
  let resultBrush;
  try {
    resultBrush = evaluator.evaluate(brushA, brushB, ADDITION);
  } catch (error) {
    console.error('❌ CSG Union failed:', error);
    return geometryA;
  }

  console.log('✅ CSG Union complete');

  // Clean up and optimize result
  let resultGeometry = resultBrush.geometry;
  
  // Merge duplicate vertices
  resultGeometry = mergeVertices(resultGeometry, 0.0001);
  
  // Apply simplification if requested (keep ~70% of triangles)
  if (simplify) {
    resultGeometry = simplifyGeometry(resultGeometry, 0.7);
  }
  
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
