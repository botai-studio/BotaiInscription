import React from 'react';

export default function ControlPanel({
  inscriptionText,
  setInscriptionText,
  textScale,
  setTextScale,
  textRotation,
  setTextRotation,
  gridDensityX,
  setGridDensityX,
  gridDensityY,
  setGridDensityY,
  extrusionDepth,
  setExtrusionDepth,
  showMarker,
  setShowMarker,
  showGrid,
  setShowGrid,
  showText3D,
  setShowText3D,
  showResult,
  setShowResult,
  onInscribe,
  canInscribe,
  isInscribing
}) {
  return (
    <div className="control-panel">
      <img src="./Botai_Logo.svg" alt="Botai" style={{ width: '100px', marginBottom: '16px' }} />
      
      <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
        Surface Inscription Test
      </h3>
      
      <p style={{ fontSize: '11px', color: '#666', marginBottom: '16px' }}>
        Click on the model surface to place an inscription point. The grid will map to the surface.
      </p>
      
      {/* Inscription Text */}
      <div className="control-group">
        <label>
          Inscription Text
        </label>
        <input
          type="text"
          className="text-input"
          value={inscriptionText}
          onChange={(e) => setInscriptionText(e.target.value)}
          placeholder="Enter text..."
        />
      </div>
      
      {/* Text Scale */}
      <div className="control-group">
        <label>
          Text Scale
          <span className="value">{textScale.toFixed(2)}</span>
        </label>
        <input
          type="range"
          className="slider"
          min="1.0"
          max="5.0"
          step="1.0"
          value={textScale}
          onChange={(e) => setTextScale(parseFloat(e.target.value))}
        />
      </div>
      
      {/* Text Rotation */}
      <div className="control-group">
        <label>
          Text Rotation
          <span className="value">{textRotation}°</span>
        </label>
        <input
          type="range"
          className="slider"
          min="0"
          max="360"
          step="1"
          value={textRotation}
          onChange={(e) => setTextRotation(parseInt(e.target.value))}
        />
      </div>
      
      {/* Grid Density X */}
      <div className="control-group">
        <label>
          Grid Density X
          <span className="value">{gridDensityX}</span>
        </label>
        <input
          type="range"
          className="slider"
          min="5"
          max="100"
          step="1"
          value={gridDensityX}
          onChange={(e) => setGridDensityX(parseInt(e.target.value))}
        />
      </div>
      
      {/* Grid Density Y */}
      <div className="control-group">
        <label>
          Grid Density Y
          <span className="value">{gridDensityY}</span>
        </label>
        <input
          type="range"
          className="slider"
          min="5"
          max="100"
          step="1"
          value={gridDensityY}
          onChange={(e) => setGridDensityY(parseInt(e.target.value))}
        />
      </div>
      
      {/* Extrusion Depth */}
      <div className="control-group">
        <label>
          Extrusion Depth
          <span className="value">{extrusionDepth?.toFixed(2) || '0.50'}</span>
        </label>
        <input
          type="range"
          className="slider"
          min="0.2"
          max="0.5"
          step="0.1"
          value={extrusionDepth || 0.5}
          onChange={(e) => setExtrusionDepth(parseFloat(e.target.value))}
        />
      </div>
      
      <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #e0e0e0' }} />
      
      {/* Visibility Toggles */}
      <div className="control-group">
        <label style={{ flexDirection: 'row', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showMarker}
            onChange={(e) => setShowMarker(e.target.checked)}
          />
          Show Marker Arrows
        </label>
      </div>
      
      <div className="control-group">
        <label style={{ flexDirection: 'row', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
          />
          Show 3D Grid Points
        </label>
      </div>
      
      <div className="control-group">
        <label style={{ flexDirection: 'row', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showText3D}
            onChange={(e) => setShowText3D(e.target.checked)}
          />
          Show 3D Text
        </label>
      </div>
      
      <div className="control-group">
        <label style={{ flexDirection: 'row', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showResult}
            onChange={(e) => setShowResult(e.target.checked)}
          />
          Show Result
        </label>
      </div>
      
      <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #e0e0e0' }} />
      
      {/* Inscribe Button */}
      <button
        onClick={onInscribe}
        disabled={!canInscribe || isInscribing}
        style={{
          width: '100%',
          padding: '12px 16px',
          fontSize: '14px',
          fontWeight: '600',
          color: '#fff',
          backgroundColor: canInscribe && !isInscribing ? '#007bff' : '#ccc',
          border: 'none',
          borderRadius: '6px',
          cursor: canInscribe && !isInscribing ? 'pointer' : 'not-allowed',
          transition: 'background-color 0.2s'
        }}
      >
        {isInscribing ? 'Inscribing...' : 'Inscribe Text'}
      </button>
      
      {!canInscribe && (
        <p style={{ fontSize: '10px', color: '#999', marginTop: '8px', textAlign: 'center' }}>
          Click on the model surface first
        </p>
      )}
    </div>
  );
}
