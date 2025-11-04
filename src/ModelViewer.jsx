import React, { useRef, useEffect, useState } from 'react';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import * as THREE from 'three';

function ModelViewer({ objUrl, ratio }) {
  const groupRef = useRef();
  const [obj, setObj] = useState(null);
  const [normalizedScale, setNormalizedScale] = useState(1);

  // 手动加载 OBJ 模型
  useEffect(() => {
    if (!objUrl) return;

    const objLoader = new OBJLoader();

    objLoader.load(
      objUrl,
      (loadedObject) => {
        // 预处理模型
        loadedObject.traverse((child) => {
          if (child.isMesh) {
            // 确保正确的光照法线（smooth shading 需要）
            child.geometry.computeVertexNormals();

            // 设置默认材质

            console.warn('No material found, using default.');
            child.material = new THREE.MeshStandardMaterial({
            color: 0x888888,
            metalness: 0.3,
            roughness: 0.5,
            flatShading: false, // 启用 smooth shading（默认值）
            });


            // 双面渲染
            child.material.side = THREE.DoubleSide;
            child.material.needsUpdate = true;
          }
        });

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

        // 保存归一化缩放比例
        setNormalizedScale(scale);
        setObj(loadedObject);
      },
      (progress) => {
        console.log('Loading:', Math.round((progress.loaded / progress.total) * 100) + '%');
      },
      (err) => {
        console.error('OBJ 加载失败:', err);
      }
    );

    // 清理函数
    return () => {
      setObj(null);
    };
  }, [objUrl]);

  // 应用归一化缩放和 ratio 缩放
  useEffect(() => {
    if (groupRef.current && obj) {
      // 先应用归一化缩放，再应用 ratio 缩放
      // ratio < 1: 横向压缩 (更瘦更高)
      // ratio > 1: 横向拉伸 (更宽更矮)
      groupRef.current.scale.set(
        normalizedScale * Math.sqrt(ratio),
        normalizedScale / Math.sqrt(ratio),
        normalizedScale
      );
    }
  }, [ratio, normalizedScale, obj]);

  if (!obj) {
    return null; // 加载中或还没有模型
  }

  return (
    <group ref={groupRef}>
      <primitive object={obj} />
    </group>
  );
}

export default ModelViewer;
