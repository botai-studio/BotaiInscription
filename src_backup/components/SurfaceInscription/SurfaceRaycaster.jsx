import React, { useRef, useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Main component that handles raycasting
export default function SurfaceRaycaster({ meshRef, onSurfaceClick, enabled = true }) {
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
