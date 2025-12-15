import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * SurfaceRaycaster - Handles click detection on 3D mesh surface
 * Returns: point, normal, tangent, bitangent, UV coordinates, UV tangent, and face info
 * Only triggers on true clicks (mouse down and up at same position), not after dragging/rotating
 * Also shows hover preview dot when mouse is over the model
 */
export default function SurfaceRaycaster({ meshRef, onSurfaceClick, onHover, enabled = true }) {
  const { camera, gl, scene } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useMemo(() => new THREE.Vector2(), []);
  const currentMouse = useRef({ x: 0, y: 0 });
  
  // Track mouse down position to detect drag vs click
  const mouseDownPos = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const isMouseDown = useRef(false);
  const DRAG_THRESHOLD = 5; // pixels - if mouse moves more than this, it's a drag

  // Update hover position each frame
  useFrame(() => {
    if (!enabled || !onHover || isMouseDown.current) {
      return;
    }

    // Get canvas bounds
    const rect = gl.domElement.getBoundingClientRect();
    
    // Calculate normalized device coordinates
    mouse.x = ((currentMouse.current.x - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((currentMouse.current.y - rect.top) / rect.height) * 2 + 1;

    // Update raycaster
    raycaster.setFromCamera(mouse, camera);

    // Find intersections with the mesh
    let intersects = [];
    
    if (meshRef && meshRef.current) {
      intersects = raycaster.intersectObject(meshRef.current, true);
    }

    // Filter to only mesh objects
    const meshIntersects = intersects.filter(i => i.object.isMesh);

    if (meshIntersects.length > 0) {
      const hit = meshIntersects[0];
      const point = hit.point.clone();
      const normal = hit.face.normal.clone();
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
      normal.applyMatrix3(normalMatrix).normalize();
      
      onHover({ point, normal });
    } else {
      onHover(null);
    }
  });

  useEffect(() => {
    if (!enabled) return;

    /**
     * Find UV at a 3D point by raycasting from above the surface
     */
    const findUVAtPoint = (point3D, normal, meshGroup) => {
      const tempRaycaster = new THREE.Raycaster();
      // Cast ray from slightly above the point, along negative normal
      const origin = point3D.clone().addScaledVector(normal, 1);
      tempRaycaster.set(origin, normal.clone().negate());
      
      const hits = tempRaycaster.intersectObject(meshGroup, true);
      const meshHits = hits.filter(h => h.object.isMesh);
      
      if (meshHits.length > 0 && meshHits[0].uv) {
        return meshHits[0].uv.clone();
      }
      return null;
    };

    const handleMouseDown = (event) => {
      mouseDownPos.current = { x: event.clientX, y: event.clientY };
      isDragging.current = false;
      isMouseDown.current = true;
    };

    const handleMouseMove = (event) => {
      currentMouse.current = { x: event.clientX, y: event.clientY };
      
      // Check if mouse has moved beyond threshold
      if (isMouseDown.current) {
        const dx = event.clientX - mouseDownPos.current.x;
        const dy = event.clientY - mouseDownPos.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
          isDragging.current = true;
        }
      }
    };

    const handleMouseUp = (event) => {
      isMouseDown.current = false;
      
      // Only process as click if we didn't drag
      if (isDragging.current) {
        return;
      }

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
        intersects = raycaster.intersectObject(meshRef.current, true);
      } else {
        intersects = raycaster.intersectObjects(scene.children, true);
      }

      // Filter to only mesh objects
      const meshIntersects = intersects.filter(i => i.object.isMesh);

      if (meshIntersects.length > 0) {
        const hit = meshIntersects[0];
        
        // Get the intersection point in world coordinates
        const point = hit.point.clone();
        
        // Get the face normal in world coordinates
        const normal = hit.face.normal.clone();
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
        tangent.copy(cameraRight).addScaledVector(normal, -cameraRight.dot(normal));
        
        // If projection is too small, use camera up
        if (tangent.lengthSq() < 0.01) {
          const cameraUp = new THREE.Vector3();
          camera.matrixWorld.extractBasis(new THREE.Vector3(), cameraUp, new THREE.Vector3());
          tangent.copy(cameraUp).addScaledVector(normal, -cameraUp.dot(normal));
        }
        tangent.normalize();
        
        // Bitangent is perpendicular to both normal and tangent
        bitangent.crossVectors(normal, tangent).normalize();

        // Get UV coordinates at hit point
        const uv = hit.uv ? hit.uv.clone() : null;

        // Compute UV tangent by sampling a delta point along 3D tangent
        let uvTangent = null;
        if (uv && meshRef && meshRef.current) {
          const delta = 0.5; // Small step in 3D space
          const deltaPoint = point.clone().addScaledVector(tangent, delta);
          const deltaUV = findUVAtPoint(deltaPoint, normal, meshRef.current);
          
          if (deltaUV) {
            // Compute 2D tangent direction in UV space
            const dU = deltaUV.x - uv.x;
            const dV = deltaUV.y - uv.y;
            const len = Math.sqrt(dU * dU + dV * dV);
            if (len > 0.0001) {
              uvTangent = { x: dU / len, y: dV / len };
              console.log(`   UV Tangent: (${uvTangent.x.toFixed(4)}, ${uvTangent.y.toFixed(4)})`);
            }
          }
        }

        // Call the callback with hit information
        if (onSurfaceClick) {
          onSurfaceClick({
            point,
            normal,
            tangent,
            bitangent,
            face: hit.face,
            faceIndex: hit.faceIndex,
            uv,
            uvTangent,
            object: hit.object,
            distance: hit.distance
          });
        }
      }
    };

    gl.domElement.addEventListener('mousedown', handleMouseDown);
    gl.domElement.addEventListener('mousemove', handleMouseMove);
    gl.domElement.addEventListener('mouseup', handleMouseUp);

    return () => {
      gl.domElement.removeEventListener('mousedown', handleMouseDown);
      gl.domElement.removeEventListener('mousemove', handleMouseMove);
      gl.domElement.removeEventListener('mouseup', handleMouseUp);
    };
  }, [enabled, meshRef, camera, gl, scene, raycaster, mouse, onSurfaceClick]);

  return null;
}
