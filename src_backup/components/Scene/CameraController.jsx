import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

// Component to update camera position based on twist
export default function CameraController({ twist }) {
  const { camera } = useThree();
  
  useEffect(() => {
    // Flat (twist = 0): Front view [0, 0, 5]
    // Botai (twist = 90): Top view [0, 5, 0]
    // Interpolate between positions based on twist angle
    const normalizedTwist = Math.abs(twist) / 90; // 0 to 1+ range
    const factor = Math.min(normalizedTwist, 1); // Clamp to 1
    
    if (twist == 90) {
      // Stay at top view for twist > 90
      camera.position.set(0, 3, 0);
    } 
    if (twist == 0) {
      // For negative twist, stay at front view
      camera.position.set(0, 0, 3);
    }
    
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [twist, camera]);
  
  return null;
}
