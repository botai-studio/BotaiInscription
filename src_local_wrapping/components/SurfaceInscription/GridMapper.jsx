import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';

/**
 * GridMapper - Maps a 2D grid to 3D surface using the walking algorithm
 * 
 * Algorithm:
 * 1. Walk along U direction (horizontal baseline) from click point
 * 2. For each U position, walk along V direction (vertical lines)
 * 3. At each step: project trial point back to surface, update tangent vectors
 */
export default function GridMapper({ 
  clickData, 
  textScale, 
  textRotation,
  gridDensityX,
  gridDensityY,
  gridSize = 10, // Centralized grid size from App
  targetMesh,
  onGridReady, // Callback to pass grid data to parent
  showPoints = true // Whether to render the grid points
}) {
  
  // Calculate the 3D grid points using the walking algorithm
  const { gridPoints3D, gridData } = useMemo(() => {
    if (!clickData || !targetMesh?.current) return { gridPoints3D: [], gridData: null };
    
    const { point, normal, tangent, bitangent } = clickData;
    
    // Apply rotation to tangent and bitangent
    const rotAngle = (textRotation * Math.PI) / 180;
    const rotatedTangent = tangent.clone().applyAxisAngle(normal, rotAngle);
    const rotatedBitangent = bitangent.clone().applyAxisAngle(normal, rotAngle);
    
    console.log('🗺️ Starting grid mapping...');
    console.log(`   Grid density: ${gridDensityX}×${gridDensityY}`);
    console.log(`   Text scale: ${textScale}`);
    
    // Grid parameters - uses centralized gridSize from App
    // Grid covers a fixed area, text is scaled within it
    const gridSizeX = gridSize; // Grid size in 3D units
    const gridSizeY = gridSize * (gridDensityY / gridDensityX); // Proportional Y size
    const stepSizeX = gridSizeX / gridDensityX;
    const stepSizeY = gridSizeY / gridDensityY;
    
    console.log(`   Grid size: ${gridSizeX.toFixed(3)} x ${gridSizeY.toFixed(3)}`);
    console.log(`   Step size: ${stepSizeX.toFixed(4)} x ${stepSizeY.toFixed(4)}`);
    
    
    // Collect all mesh triangles for raycasting
    const raycaster = new THREE.Raycaster();
    const meshObjects = [];
    
    targetMesh.current.traverse((child) => {
      if (child.isMesh) {
        meshObjects.push(child);
      }
    });
    
    console.log(`   Found ${meshObjects.length} mesh objects for raycasting`);
    
    // Helper function: project a point back to the surface
    const projectToSurface = (trialPoint, currentNormal) => {
      // Cast ray from trial point in direction of negative normal
      const rayOrigin = trialPoint.clone().add(currentNormal.clone().multiplyScalar(0.1));
      const rayDirection = currentNormal.clone().negate();
      
      raycaster.set(rayOrigin, rayDirection);
      const intersects = raycaster.intersectObjects(meshObjects, false);
      
      if (intersects.length > 0) {
        const hit = intersects[0];
        const projectedPoint = hit.point.clone();
        
        // Get surface normal at hit point
        const hitNormal = hit.face.normal.clone();
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
        hitNormal.applyMatrix3(normalMatrix).normalize();
        
        return { point: projectedPoint, normal: hitNormal, success: true };
      }
      
      // Fallback: try reverse direction
      raycaster.set(rayOrigin, rayDirection.negate());
      const reverseIntersects = raycaster.intersectObjects(meshObjects, false);
      
      if (reverseIntersects.length > 0) {
        const hit = reverseIntersects[0];
        const projectedPoint = hit.point.clone();
        const hitNormal = hit.face.normal.clone();
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
        hitNormal.applyMatrix3(normalMatrix).normalize();
        
        return { point: projectedPoint, normal: hitNormal, success: true };
      }
      
      return { point: trialPoint, normal: currentNormal, success: false };
    };
    
    // Helper function: update tangent vector using Gram-Schmidt
    const updateTangent = (tangentVec, normalVec) => {
      // T' = T - (T·N) * N
      const projection = tangentVec.dot(normalVec);
      const updated = tangentVec.clone().addScaledVector(normalVec, -projection);
      return updated.normalize();
    };
    
    // Storage: grid[i][j] = { point, normal, tangentU, tangentV }
    const grid = [];
    
    // STEP 1: Walk along U direction (baseline at v=0)
    console.log('   Step 1: Walking U direction baseline...');
    
    const baselineRow = [];
    let currentPoint = point.clone();
    let currentNormal = normal.clone();
    let currentTangentU = rotatedTangent.clone();
    let currentTangentV = rotatedBitangent.clone();
    
    // First point (i=0, j=0)
    baselineRow.push({
      point: currentPoint.clone(),
      normal: currentNormal.clone(),
      tangentU: currentTangentU.clone(),
      tangentV: currentTangentV.clone()
    });
    
    // Walk positive U direction
    for (let i = 1; i <= gridDensityX; i++) {
      // Trial point: move along current tangent U
      const trialPoint = currentPoint.clone().add(currentTangentU.clone().multiplyScalar(stepSizeX));
      
      // Project back to surface
      const projected = projectToSurface(trialPoint, currentNormal);
      
      if (!projected.success && i > 1) {
        console.warn(`   Failed to project at U step ${i}, stopping baseline`);
        break;
      }
      
      // Update position and normal
      currentPoint = projected.point;
      currentNormal = projected.normal;
      
      // Update tangent U (Gram-Schmidt)
      currentTangentU = updateTangent(currentTangentU, currentNormal);
      
      // Update tangent V (perpendicular to U and N)
      currentTangentV = new THREE.Vector3().crossVectors(currentNormal, currentTangentU).normalize();
      
      baselineRow.push({
        point: currentPoint.clone(),
        normal: currentNormal.clone(),
        tangentU: currentTangentU.clone(),
        tangentV: currentTangentV.clone()
      });
    }
    
    console.log(`   Baseline complete: ${baselineRow.length} points`);
    grid.push(baselineRow);
    
    // STEP 2: For each column, walk V direction
    console.log('   Step 2: Walking V direction for each column...');
    
    const numUSteps = baselineRow.length;
    
    for (let i = 0; i < numUSteps; i++) {
      const columnData = [baselineRow[i]]; // Start with baseline point
      
      // Walk positive V direction (upward)
      let currentPoint = baselineRow[i].point.clone();
      let currentNormal = baselineRow[i].normal.clone();
      let currentTangentU = baselineRow[i].tangentU.clone();
      let currentTangentV = baselineRow[i].tangentV.clone();
      
      for (let j = 1; j <= gridDensityY; j++) {
        // Trial point: move along current tangent V
        const trialPoint = currentPoint.clone().add(currentTangentV.clone().multiplyScalar(stepSizeY));
        
        // Project back to surface
        const projected = projectToSurface(trialPoint, currentNormal);
        
        if (!projected.success && j > 1) {
          // Can't continue this column
          break;
        }
        
        // Update position and normal
        currentPoint = projected.point;
        currentNormal = projected.normal;
        
        // Update tangent V (Gram-Schmidt)
        currentTangentV = updateTangent(currentTangentV, currentNormal);
        
        // Update tangent U to maintain orthogonality
        currentTangentU = updateTangent(currentTangentU, currentNormal);
        
        // Recalculate U to ensure orthogonality: U = V × N
        currentTangentU = new THREE.Vector3().crossVectors(currentTangentV, currentNormal).normalize();
        
        columnData.push({
          point: currentPoint.clone(),
          normal: currentNormal.clone(),
          tangentU: currentTangentU.clone(),
          tangentV: currentTangentV.clone()
        });
      }
      
      // Store column (note: this creates grid[j][i] layout)
      for (let j = 0; j < columnData.length; j++) {
        if (!grid[j]) grid[j] = [];
        grid[j][i] = columnData[j];
      }
    }
    
    console.log(`   Grid complete: ${grid.length} rows × ${grid[0]?.length || 0} columns`);
    
    // Flatten grid to array of points for visualization
    const points = [];
    for (let j = 0; j < grid.length; j++) {
      for (let i = 0; i < (grid[j]?.length || 0); i++) {
        if (grid[j][i]) {
          points.push(grid[j][i].point);
        }
      }
    }
    
    console.log(`   Total points: ${points.length}`);
    
    // Grid data for mapping 2D points to 3D (reuse gridSizeX/Y and stepSizeX/Y from above)
    const gridDataOutput = {
      grid,
      stepSizeX,
      stepSizeY,
      gridSizeX,
      gridSizeY,
      gridDensityX,
      gridDensityY
    };
    
    return { gridPoints3D: points, gridData: gridDataOutput };
    
  }, [clickData, textScale, textRotation, gridDensityX, gridDensityY, gridSize, targetMesh]);
  
  // Notify parent when grid is ready
  useEffect(() => {
    if (onGridReady && gridData) {
      onGridReady(gridData);
    }
  }, [gridData, onGridReady]);
  
  // Render grid points as small spheres (only if showPoints is true)
  if (!showPoints) return null;
  
  return (
    <group>
      {gridPoints3D.map((point, index) => (
        <mesh key={index} position={point}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color={index === 0 ? 0xff0000 : 0x000000} />
        </mesh>
      ))}
    </group>
  );
}
