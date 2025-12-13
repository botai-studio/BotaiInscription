import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import * as THREE from 'three';

export default function GridTestPanel({ clickData, inscriptionText = 'Botai', textScale, textRotation, gridDensityX, gridDensityY, gridSize = 10 }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  // Panel position and size state
  const [panelPos, setPanelPos] = useState({ x: 20, y: 20 }); // from bottom-right
  const [panelSize, setPanelSize] = useState({ width: 400, height: 350 });
  
  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Canvas pan and zoom state
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // Font state for 2D text mesh
  const [font, setFont] = useState(null);
  const [textMesh2D, setTextMesh2D] = useState(null); // { vertices: [], triangles: [] }

  // Load font
  useEffect(() => {
    const loader = new FontLoader();
    loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (loadedFont) => {
      setFont(loadedFont);
      console.log('🔤 Font loaded for 2D panel');
    });
  }, []);

  // Generate triangulated 2D mesh from text when font or text changes
  useEffect(() => {
    if (!font || !inscriptionText) {
      setTextMesh2D(null);
      return;
    }

    // Generate shapes from font
    const shapes = font.generateShapes(inscriptionText, 1); // Size 1, we'll scale later
    
    // Create ShapeGeometry - this triangulates the shapes
    const geometry = new THREE.ShapeGeometry(shapes);
    
    // Extract vertices (2D positions)
    const posAttr = geometry.attributes.position;
    const vertices = [];
    for (let i = 0; i < posAttr.count; i++) {
      vertices.push({
        x: posAttr.getX(i),
        y: posAttr.getY(i)
      });
    }
    
    // Extract triangles (indices)
    const indexAttr = geometry.index;
    const triangles = [];
    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i += 3) {
        triangles.push([
          indexAttr.getX(i),
          indexAttr.getX(i + 1),
          indexAttr.getX(i + 2)
        ]);
      }
    } else {
      // Non-indexed geometry
      for (let i = 0; i < posAttr.count; i += 3) {
        triangles.push([i, i + 1, i + 2]);
      }
    }

    console.log(`📐 2D Text Mesh: ${vertices.length} vertices, ${triangles.length} triangles`);
    
    setTextMesh2D({ vertices, triangles });
    
    // Cleanup
    geometry.dispose();
  }, [font, inscriptionText]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Apply zoom and pan transformation
    ctx.save();
    ctx.translate(width / 2 + canvasOffset.x, height / 2 + canvasOffset.y);
    ctx.scale(canvasZoom, canvasZoom);

    // Draw coordinate grid (light)
    const gridStep = 50;
    const gridExtent = 500;
    
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.5 / canvasZoom;
    
    for (let i = -gridExtent; i <= gridExtent; i += gridStep) {
      ctx.beginPath();
      ctx.moveTo(i, -gridExtent);
      ctx.lineTo(i, gridExtent);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(-gridExtent, i);
      ctx.lineTo(gridExtent, i);
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2 / canvasZoom;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(100, 0);
    ctx.stroke();
    
    // Arrow head for X
    ctx.beginPath();
    ctx.moveTo(100, 0);
    ctx.lineTo(90, -5);
    ctx.lineTo(90, 5);
    ctx.closePath();
    ctx.fillStyle = '#ff0000';
    ctx.fill();

    ctx.strokeStyle = '#00cc00';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -100); // Negative because canvas Y is flipped
    ctx.stroke();
    
    // Arrow head for Y
    ctx.beginPath();
    ctx.moveTo(0, -100);
    ctx.lineTo(-5, -90);
    ctx.lineTo(5, -90);
    ctx.closePath();
    ctx.fillStyle = '#00cc00';
    ctx.fill();

    // Draw origin
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(0, 0, 4 / canvasZoom, 0, Math.PI * 2);
    ctx.fill();

    // Draw 2D text mesh (triangulated)
    if (textMesh2D && textMesh2D.vertices.length > 0) {
      const { vertices, triangles } = textMesh2D;
      
      // Apply text scale for display (same as 3D mapping)
      const displayScale = textScale;

      // Draw triangles (filled)
      ctx.fillStyle = 'rgba(0, 100, 255, 0.2)';
      ctx.strokeStyle = 'rgba(0, 100, 255, 0.5)';
      ctx.lineWidth = 0.5 / canvasZoom;

      triangles.forEach((tri) => {
        const v0 = vertices[tri[0]];
        const v1 = vertices[tri[1]];
        const v2 = vertices[tri[2]];
        
        ctx.beginPath();
        ctx.moveTo(v0.x * displayScale, -v0.y * displayScale);
        ctx.lineTo(v1.x * displayScale, -v1.y * displayScale);
        ctx.lineTo(v2.x * displayScale, -v2.y * displayScale);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });

      // Draw vertices as points
      ctx.fillStyle = '#0066ff';
      vertices.forEach((v) => {
        ctx.beginPath();
        ctx.arc(v.x * displayScale, -v.y * displayScale, 2 / canvasZoom, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Draw grid overlay if clickData exists
    if (clickData) {
      // Grid uses centralized gridSize from App
      const gridSizeX = gridSize;
      const gridSizeY = gridSize * (gridDensityY / gridDensityX);
      const cellSizeX = gridSizeX / gridDensityX;
      const cellSizeY = gridSizeY / gridDensityY;
      
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = 0.5 / canvasZoom;
      
      // Vertical lines
      for (let i = 0; i <= gridDensityX; i++) {
        const u = i * cellSizeX;
        ctx.beginPath();
        ctx.moveTo(u, 0);
        ctx.lineTo(u, -gridSizeY);
        ctx.stroke();
      }
      
      // Horizontal lines
      for (let j = 0; j <= gridDensityY; j++) {
        const v = j * cellSizeY;
        ctx.beginPath();
        ctx.moveTo(0, -v);
        ctx.lineTo(gridSizeX, -v);
        ctx.stroke();
      }
      
      // Grid points
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      for (let i = 0; i <= gridDensityX; i++) {
        for (let j = 0; j <= gridDensityY; j++) {
          const u = i * cellSizeX;
          const v = j * cellSizeY;
          ctx.beginPath();
          ctx.arc(u, -v, 2 / canvasZoom, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();

    // Draw axis labels (in screen space)
    ctx.fillStyle = '#ff0000';
    ctx.font = '11px sans-serif';
    ctx.fillText('X (U)', width / 2 + canvasOffset.x + 100 * canvasZoom + 5, height / 2 + canvasOffset.y + 4);
    
    ctx.fillStyle = '#00cc00';
    ctx.fillText('Y (V)', width / 2 + canvasOffset.x + 5, height / 2 + canvasOffset.y - 100 * canvasZoom - 5);

    // Info overlay
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Zoom: ${canvasZoom.toFixed(2)}x`, width - 10, height - 10);
    ctx.fillText(`Text: "${inscriptionText}"`, width - 10, height - 24);
    ctx.fillText(`Grid: ${gridDensityX}×${gridDensityY}`, width - 10, height - 38);
    if (textMesh2D) {
      ctx.fillText(`Mesh: ${textMesh2D.vertices.length} verts, ${textMesh2D.triangles.length} tris`, width - 10, height - 52);
    }
    ctx.textAlign = 'left';

  }, [clickData, inscriptionText, textScale, textRotation, gridDensityX, gridDensityY, gridSize, canvasOffset, canvasZoom, textMesh2D]);

  // Handle panel dragging (header)
  const handleHeaderMouseDown = useCallback((e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    e.preventDefault();
  }, []);

  // Handle panel resizing (corner)
  const handleResizeMouseDown = useCallback((e) => {
    setIsResizing(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Handle canvas panning
  const handleCanvasMouseDown = useCallback((e) => {
    if (e.button === 0) { // Left click
      setIsPanning(true);
      setPanStart({ x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y });
    }
  }, [canvasOffset]);



  // Global mouse move handler
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        setPanelPos((prev) => ({
          x: prev.x - dx,
          y: prev.y - dy
        }));
        setDragStart({ x: e.clientX, y: e.clientY });
      }
      
      if (isResizing) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        setPanelSize((prev) => ({
          width: Math.max(200, prev.width - dx),
          height: Math.max(150, prev.height - dy)
        }));
        setDragStart({ x: e.clientX, y: e.clientY });
      }
      
      if (isPanning) {
        setCanvasOffset({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, isPanning, dragStart, panStart]);

  // Update canvas size when panel resizes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = panelSize.width;
      canvas.height = panelSize.height - 40; // Subtract header height
    }
  }, [panelSize]);

  // Add wheel event listener with passive: false to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setCanvasZoom((prev) => Math.max(0.1, Math.min(10, prev * delta)));
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="grid-test-panel"
      style={{
        right: panelPos.x,
        bottom: panelPos.y,
        width: panelSize.width,
        height: panelSize.height
      }}
    >
      <div 
        className="grid-test-header"
        onMouseDown={handleHeaderMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        2D UV Space
        <span style={{ float: 'right', fontSize: '10px', color: '#999' }}>
          drag to move
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="grid-test-canvas"
        width={panelSize.width}
        height={panelSize.height - 40}
        onMouseDown={handleCanvasMouseDown}
        style={{ cursor: isPanning ? 'grabbing' : 'crosshair' }}
      />
      {/* Resize handle */}
      <div
        className="grid-test-resize"
        onMouseDown={handleResizeMouseDown}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 16,
          height: 16,
          cursor: 'nw-resize',
          background: 'linear-gradient(135deg, #ccc 50%, transparent 50%)'
        }}
      />
    </div>
  );
}
