import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * UVPanel - 2D panel showing the UV map of the model
 * Displays UV triangles, click point, and grid dots in UV space
 */
export default function UVPanel({ uvData, clickData, gridData, textData }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  // Panel position and size state
  const [panelPos, setPanelPos] = useState({ x: 20, y: 20 }); // from bottom-right
  const [panelSize, setPanelSize] = useState({ width: 400, height: 400 });
  
  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Canvas pan and zoom state
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Draw UV map on canvas
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

    // UV space scale (UV is 0-1, we scale to pixels)
    const uvScale = 300;

    // Draw UV coordinate grid
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.5 / canvasZoom;
    
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(t * uvScale, 0);
      ctx.lineTo(t * uvScale, -uvScale);
      ctx.stroke();
      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(0, -t * uvScale);
      ctx.lineTo(uvScale, -t * uvScale);
      ctx.stroke();
    }

    // Draw UV boundary box (0,0) to (1,1)
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1 / canvasZoom;
    ctx.strokeRect(0, -uvScale, uvScale, uvScale);

    // Draw axes
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2 / canvasZoom;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(50, 0);
    ctx.stroke();
    
    // Arrow head for U axis
    ctx.beginPath();
    ctx.moveTo(50, 0);
    ctx.lineTo(45, -3);
    ctx.lineTo(45, 3);
    ctx.closePath();
    ctx.fillStyle = '#ff0000';
    ctx.fill();

    ctx.strokeStyle = '#00cc00';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -50);
    ctx.stroke();
    
    // Arrow head for V axis
    ctx.beginPath();
    ctx.moveTo(0, -50);
    ctx.lineTo(-3, -45);
    ctx.lineTo(3, -45);
    ctx.closePath();
    ctx.fillStyle = '#00cc00';
    ctx.fill();

    // Draw origin
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(0, 0, 3 / canvasZoom, 0, Math.PI * 2);
    ctx.fill();

    // Draw UV triangles from model
    if (uvData && uvData.triangles && uvData.uvs) {
      const { triangles, uvs } = uvData;
      
      ctx.strokeStyle = 'rgba(100, 100, 200, 0.3)';
      ctx.lineWidth = 0.5 / canvasZoom;
      
      triangles.forEach((tri) => {
        const uv0 = uvs[tri[0]];
        const uv1 = uvs[tri[1]];
        const uv2 = uvs[tri[2]];
        
        if (uv0 && uv1 && uv2) {
          ctx.beginPath();
          ctx.moveTo(uv0.u * uvScale, -uv0.v * uvScale);
          ctx.lineTo(uv1.u * uvScale, -uv1.v * uvScale);
          ctx.lineTo(uv2.u * uvScale, -uv2.v * uvScale);
          ctx.closePath();
          ctx.stroke();
        }
      });
    }

    // Draw click point in UV space
    if (clickData && clickData.uv) {
      const { uv, uvTangent } = clickData;
      
      const clickU = uv.x * uvScale;
      const clickV = -uv.y * uvScale;
      
      // Draw UV tangent arrow (red) - X direction in 2D
      if (uvTangent) {
        const tangentLength = 50;
        const tangentEndU = clickU + uvTangent.x * tangentLength;
        const tangentEndV = clickV - uvTangent.y * tangentLength; // Negative because canvas Y is flipped
        
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2.5 / canvasZoom;
        ctx.beginPath();
        ctx.moveTo(clickU, clickV);
        ctx.lineTo(tangentEndU, tangentEndV);
        ctx.stroke();
        
        // Arrow head for tangent
        const arrowSize = 8 / canvasZoom;
        const angle = Math.atan2(tangentEndV - clickV, tangentEndU - clickU);
        ctx.beginPath();
        ctx.moveTo(tangentEndU, tangentEndV);
        ctx.lineTo(
          tangentEndU - arrowSize * Math.cos(angle - Math.PI / 6),
          tangentEndV - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          tangentEndU - arrowSize * Math.cos(angle + Math.PI / 6),
          tangentEndV - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = '#ff0000';
        ctx.fill();
      }
      
      // Draw crosshair at click UV
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 2 / canvasZoom;
      const crossSize = 10 / canvasZoom;
      
      ctx.beginPath();
      ctx.moveTo(clickU - crossSize, clickV);
      ctx.lineTo(clickU + crossSize, clickV);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(clickU, clickV - crossSize);
      ctx.lineTo(clickU, clickV + crossSize);
      ctx.stroke();
      
      // Circle around click point
      ctx.beginPath();
      ctx.arc(clickU, clickV, 8 / canvasZoom, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw grid dots in UV space
    if (gridData && gridData.uvPoints) {
      gridData.uvPoints.forEach((uvPoint, idx) => {
        const dotU = uvPoint.u * uvScale;
        const dotV = -uvPoint.v * uvScale;
        
        // First point (origin) is orange, others are blue
        // Check if this point was successfully mapped to 3D
        const isMapped = gridData.points3D && gridData.points3D[idx];
        
        if (idx === 0) {
          ctx.fillStyle = '#ff6600'; // Orange for origin
        } else if (isMapped) {
          ctx.fillStyle = '#0066ff'; // Blue for mapped points
        } else {
          ctx.fillStyle = '#cccccc'; // Gray for unmapped points
        }
        
        ctx.beginPath();
        ctx.arc(dotU, dotV, 4 / canvasZoom, 0, Math.PI * 2);
        ctx.fill();
        
        // Add small border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5 / canvasZoom;
        ctx.stroke();
      });
    }

    // Draw text triangles in UV space
    if (textData && textData.uvVertices && textData.triangles) {
      const { uvVertices, triangles } = textData;
      
      // Draw filled triangles
      ctx.fillStyle = 'rgba(255, 140, 0, 0.5)'; // Orange fill
      ctx.strokeStyle = 'rgba(180, 80, 0, 0.8)'; // Darker orange stroke
      ctx.lineWidth = 1 / canvasZoom;
      
      triangles.forEach((tri) => {
        const v0 = uvVertices[tri[0]];
        const v1 = uvVertices[tri[1]];
        const v2 = uvVertices[tri[2]];
        
        if (v0 && v1 && v2) {
          ctx.beginPath();
          ctx.moveTo(v0.u * uvScale, -v0.v * uvScale);
          ctx.lineTo(v1.u * uvScale, -v1.v * uvScale);
          ctx.lineTo(v2.u * uvScale, -v2.v * uvScale);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      });
    }

    ctx.restore();

    // Draw axis labels (in screen space)
    ctx.fillStyle = '#ff0000';
    ctx.font = '11px sans-serif';
    ctx.fillText('U', width / 2 + canvasOffset.x + 55 * canvasZoom, height / 2 + canvasOffset.y + 4);
    
    ctx.fillStyle = '#00cc00';
    ctx.fillText('V', width / 2 + canvasOffset.x + 5, height / 2 + canvasOffset.y - 55 * canvasZoom);

    // Info text
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.fillText('UV Map', 10, 15);
    
    if (clickData && clickData.uv) {
      ctx.fillText(`Click UV: (${clickData.uv.x.toFixed(4)}, ${clickData.uv.y.toFixed(4)})`, 10, 30);
      if (clickData.uvTangent) {
        ctx.fillText(`UV Tangent: (${clickData.uvTangent.x.toFixed(4)}, ${clickData.uvTangent.y.toFixed(4)})`, 10, 45);
      }
    }
    
    if (gridData && gridData.uvPoints) {
      const mappedCount = gridData.points3D ? gridData.points3D.filter(p => p).length : 0;
      ctx.fillText(`Grid: ${mappedCount}/${gridData.uvPoints.length} mapped`, 10, 60);
    }
    
    if (textData && textData.uvVertices) {
      const mappedCount = textData.vertices3D ? textData.vertices3D.filter(v => v).length : 0;
      ctx.fillText(`Text: ${mappedCount}/${textData.uvVertices.length} verts, ${textData.triangles.length} tris`, 10, 75);
    }
    
    if (uvData) {
      ctx.fillText(`Triangles: ${uvData.triangles.length}`, 10, height - 10);
    }

  }, [uvData, clickData, gridData, textData, canvasOffset, canvasZoom, panelSize]);

  // Handle panel dragging
  const handleMouseDown = useCallback((e) => {
    if (e.target.classList.contains('panel-header')) {
      setIsDragging(true);
      setDragStart({ x: e.clientX + panelPos.x, y: e.clientY + panelPos.y });
    } else if (e.target.classList.contains('resize-handle')) {
      setIsResizing(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [panelPos]);

  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      setPanelPos({
        x: dragStart.x - e.clientX,
        y: dragStart.y - e.clientY
      });
    } else if (isResizing) {
      const dx = dragStart.x - e.clientX;
      const dy = dragStart.y - e.clientY;
      setPanelSize(prev => ({
        width: Math.max(200, prev.width + dx),
        height: Math.max(200, prev.height + dy)
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [isDragging, isResizing, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  // Canvas pan and zoom handlers
  const handleCanvasMouseDown = useCallback((e) => {
    if (e.button === 0) { // Left click for panning
      setIsPanning(true);
      setPanStart({ x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y });
    }
  }, [canvasOffset]);

  const handleCanvasMouseMove = useCallback((e) => {
    if (isPanning) {
      setCanvasOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  }, [isPanning, panStart]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setCanvasZoom(prev => Math.max(0.1, Math.min(10, prev * zoomFactor)));
  }, []);

  // Reset view
  const resetView = useCallback(() => {
    setCanvasOffset({ x: 0, y: 0 });
    setCanvasZoom(1);
  }, []);

  // Add non-passive wheel listener to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div 
      ref={containerRef}
      className="uv-panel"
      style={{
        position: 'absolute',
        right: panelPos.x,
        bottom: panelPos.y,
        width: panelSize.width,
        height: panelSize.height,
        background: 'white',
        border: '1px solid #ccc',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 100,
      }}
    >
      {/* Header */}
      <div 
        className="panel-header"
        onMouseDown={handleMouseDown}
        style={{
          padding: '8px 12px',
          background: '#f5f5f5',
          borderBottom: '1px solid #ddd',
          cursor: 'move',
          userSelect: 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '12px' }}>UV Map</span>
        <button 
          onClick={resetView}
          style={{
            padding: '2px 8px',
            fontSize: '10px',
            cursor: 'pointer',
            border: '1px solid #ccc',
            borderRadius: '4px',
            background: '#fff',
          }}
        >
          Reset View
        </button>
      </div>
      
      {/* Canvas */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={panelSize.width - 2}
          height={panelSize.height - 40}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          style={{
            cursor: isPanning ? 'grabbing' : 'grab',
          }}
        />
      </div>
      
      {/* Resize handle */}
      <div 
        className="resize-handle"
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '15px',
          height: '15px',
          cursor: 'nw-resize',
          background: 'linear-gradient(135deg, #ccc 50%, transparent 50%)',
        }}
      />
    </div>
  );
}
