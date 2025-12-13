import React, { useRef, useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export default function SurfaceRaycaster({ meshRef, onSurfaceClick, enabled = true }) {
  const { camera, gl, scene } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useMemo(() => new THREE.Vector2(), []);

  useEffect(() => {
    if (!enabled) return;

    const handleClick = (event) => {
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

    // Add event listener for click
    gl.domElement.addEventListener('click', handleClick);

    return () => {
      gl.domElement.removeEventListener('click', handleClick);
    };
  }, [enabled, meshRef, camera, gl, scene, raycaster, mouse, onSurfaceClick]);

  return null;
}
