import React from 'react';

const ControlPanel = ({
  debugMode,
  mode,
  setMode,
  objFile,
  setObjFile,
  twist,
  setTwist,
  inscriptions,
  selectedInscriptionId,
  setSelectedInscriptionId,
  deleteInscription,
  updateInscription,
  addInscription,
  showMarker,
  setShowMarker,
  showTestText,
  setShowTestText,
  showTextMesh,
  setShowTextMesh,
  conformToSurface,
  setConformToSurface,
  showUVMap,
  setShowUVMap,
  useAdvancedRendering,
  setUseAdvancedRendering,
  subdivisionLevel,
  setSubdivisionLevel,
  scaleX,
  setScaleX,
  scaleY,
  setScaleY,
  scaleZ,
  setScaleZ,
  booleanSubtract,
  setBooleanSubtract,
  localSubtractText,
  setLocalSubtractText,
  setSubtractText,
  textFont,
  setTextFont,
  textScale,
  setTextScale,
  textDepth,
  setTextDepth,
  textOffsetX,
  setTextOffsetX,
  textOffsetY,
  setTextOffsetY,
  textRotation,
  setTextRotation,
  showText,
  setShowText,
  offlineMode,
  email,
  setEmail,
  price,
  fileInputRef,
  handleLoadJson,
  confirmationNumber,
  handleOrder,
  isOrdering,
  onApplyInscriptions // NEW: callback to apply inscriptions
}) => {
  return (
    <div className="control-panel">
      <img src="./Botai_Logo.svg" alt="Botai" style={{ width: '100px', marginBottom: '16px' }} />
      
      {/* 选择模式按钮 */}
      <div className="control-group">
        <label style={{ fontSize: '13px', fontWeight: '600' }}>Select Mode:</label>
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
          {debugMode && (
            <>
              <button
                type="button"
                className="sample-button"
                onClick={() => setMode('graph')}
                style={{
                  background: mode === 'graph' ? '#000' : '#f5f5f5',
                  color: mode === 'graph' ? '#fff' : '#000',
                  flex: '1 1 45%'
                }}
              >
                Random Graph
              </button>
              <button
                type="button"
                className="sample-button"
                onClick={() => setMode('manifold')}
                style={{
                  background: mode === 'manifold' ? '#000' : '#f5f5f5',
                  color: mode === 'manifold' ? '#fff' : '#000',
                  flex: '1 1 45%'
                }}
              >
                Cube
              </button>
            </>
          )}
          <button
            type="button"
            className="sample-button"
            onClick={() => { setObjFile('./bow_tie_small.obj'); setMode('original'); }}
            style={{
              background: mode === 'original' && objFile.includes('bow_tie_small') ? '#000' : '#f5f5f5',
              color: mode === 'original' && objFile.includes('bow_tie_small') ? '#fff' : '#000',
              flex: '1 1 45%'
            }}
          >
            Bow Tie
          </button>
          <button
            type="button"
            className="sample-button"
            onClick={() => { setObjFile('./trinity.obj'); setMode('original'); }}
            style={{
              background: mode === 'original' && objFile.includes('trinity') ? '#000' : '#f5f5f5',
              color: mode === 'original' && objFile.includes('trinity') ? '#fff' : '#000',
              flex: '1 1 45%'
            }}
          >
            Trinity
          </button>
          <button
            type="button"
            className="sample-button"
            onClick={() => { setObjFile('./Morpheus.obj'); setMode('original'); }}
            style={{
              background: mode === 'original' && objFile.includes('Morpheus') ? '#000' : '#f5f5f5',
              color: mode === 'original' && objFile.includes('Morpheus') ? '#fff' : '#000',
              flex: '1 1 45%'
            }}
          >
            Morpheus
          </button>
          <button
            type="button"
            className="sample-button"
            onClick={() => { setObjFile('./Webber Edge.obj'); setMode('original'); }}
            style={{
              background: mode === 'original' && objFile.includes('Webber Edge') ? '#000' : '#f5f5f5',
              color: mode === 'original' && objFile.includes('Webber Edge') ? '#fff' : '#000',
              flex: '1 1 45%'
            }}
          >
            Webber Edge
          </button>
          <button
            type="button"
            className="sample-button"
            onClick={() => { setObjFile('./Morpheus.obj'); setMode('test'); setTwist(90); }}
            style={{
                background: mode === 'test' ? '#000' : '#f5f5f5',
                color: mode === 'test' ? '#fff' : '#000',
                flex: '1 1 45%',
                border: mode === 'test' ? '1px solid #000' : '1px solid #e0e0e0'
              }}
            >
              Test Mode
            </button>
        </div>
        {mode === 'original' && objFile && <p className="file-status">✓ {objFile.split('/').pop()}</p>}
        {mode === 'test' && <p className="file-status">Test Mode Active</p>}
      </div>

      {/* TEST MODE UI */}
      {mode === 'test' ? (
        <>
          {/* Style Toggle: Flat / Botai */}
          <div className="control-group" style={{ marginTop: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600' }}>Style:</label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="sample-button"
                onClick={() => setTwist(0)}
                style={{
                  background: twist === 0 ? '#000' : '#f5f5f5',
                  color: twist === 0 ? '#fff' : '#000',
                  flex: '1 1 45%'
                }}
              >
                Flat
              </button>
              <button
                type="button"
                className="sample-button"
                onClick={() => setTwist(90)}
                style={{
                  background: twist === 90 ? '#000' : '#f5f5f5',
                  color: twist === 90 ? '#fff' : '#000',
                  flex: '1 1 45%'
                }}
              >
                Botai
              </button>
            </div>
          </div>

          {/* Twist Slider */}
          <div className="control-group">
            <label>
              Twist: <span className="value">{twist}°</span>
            </label>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={twist}
              onChange={(e) => setTwist(parseInt(e.target.value))}
              className="slider"
            />
            <div className="slider-labels">
              <span>-180°</span>
              <span>0°</span>
              <span>180°</span>
            </div>
          </div>

          {/* Inscription Cards Section */}
          <div style={{ marginTop: '16px' }}>
            <p style={{ fontSize: '11px', color: '#333', margin: '0 0 10px 0' }}>
              <strong>Inscriptions</strong> — Click on mesh or hold 'A' + move
            </p>
            
            {/* Inscription Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {inscriptions.map((inscription, index) => (
                <div
                  key={inscription.id}
                  onClick={() => setSelectedInscriptionId(inscription.id)}
                  style={{
                    padding: '10px',
                    border: selectedInscriptionId === inscription.id ? '2px solid #000' : '1px solid #e0e0e0',
                    background: selectedInscriptionId === inscription.id ? '#f0f0f0' : '#fff',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#333' }}>
                      #{index + 1} {inscription.clickData ? '✓' : '○'}
                    </span>
                    {inscriptions.length > 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteInscription(inscription.id); }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: '#999',
                          padding: '0 4px'
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  
                  {/* Text Input */}
                  <div style={{ marginBottom: '6px' }}>
                    <input
                      type="text"
                      value={inscription.text}
                      onChange={(e) => updateInscription(inscription.id, { text: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Enter text"
                      maxLength="20"
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        fontSize: '11px',
                        border: '1px solid #ddd',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  
                  {/* Scale Slider */}
                  <div style={{ marginBottom: '4px' }}>
                    <label style={{ fontSize: '10px', color: '#666' }}>
                      Scale: {inscription.scale.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0.02"
                      max="0.2"
                      step="0.01"
                      value={inscription.scale}
                      onChange={(e) => updateInscription(inscription.id, { scale: parseFloat(e.target.value) })}
                      onClick={(e) => e.stopPropagation()}
                      className="slider"
                      style={{ marginTop: '2px' }}
                    />
                  </div>
                  
                  {/* Rotation Slider */}
                  <div style={{ marginBottom: '4px' }}>
                    <label style={{ fontSize: '10px', color: '#666' }}>
                      Rotation: {inscription.rotation}°
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="5"
                      value={inscription.rotation}
                      onChange={(e) => updateInscription(inscription.id, { rotation: parseInt(e.target.value) })}
                      onClick={(e) => e.stopPropagation()}
                      className="slider"
                      style={{ marginTop: '2px' }}
                    />
                  </div>
                  
                  {/* Depth Slider */}
                  <div>
                    <label style={{ fontSize: '10px', color: '#666' }}>
                      Depth: {inscription.depth.toFixed(3)}
                    </label>
                    <input
                      type="range"
                      min="0.005"
                      max="0.05"
                      step="0.005"
                      value={inscription.depth}
                      onChange={(e) => updateInscription(inscription.id, { depth: parseFloat(e.target.value) })}
                      onClick={(e) => e.stopPropagation()}
                      className="slider"
                      style={{ marginTop: '2px' }}
                    />
                  </div>
                  
                  {/* Position Info (if placed) */}
                  {inscription.clickData && (
                    <div style={{ marginTop: '6px', fontSize: '9px', color: '#888' }}>
                      Position: ({inscription.clickData.point.x.toFixed(2)}, {inscription.clickData.point.y.toFixed(2)}, {inscription.clickData.point.z.toFixed(2)})
                    </div>
                  )}
                </div>
              ))}
              
              {/* Add New Inscription Card */}
              <div
                onClick={addInscription}
                style={{
                  padding: '20px',
                  border: '2px dashed #ccc',
                  background: '#fafafa',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'border-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#999'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#ccc'}
              >
                <span style={{ fontSize: '24px', color: '#999' }}>+</span>
              </div>
              
              {/* Apply Inscriptions Button */}
              <button
                onClick={onApplyInscriptions}
                disabled={!inscriptions.some(i => i.clickData)}
                style={{
                  marginTop: '12px',
                  padding: '12px 16px',
                  background: inscriptions.some(i => i.clickData) ? '#000' : '#ccc',
                  color: '#fff',
                  border: 'none',
                  cursor: inscriptions.some(i => i.clickData) ? 'pointer' : 'not-allowed',
                  fontWeight: '600',
                  fontSize: '12px',
                  width: '100%'
                }}
              >
                🔪 Apply Inscriptions (Carve)
              </button>
            </div>
          </div>

          {/* Global Settings Card */}
          <div style={{ marginTop: '16px', padding: '10px', background: '#f5f5f5', border: '1px solid #e0e0e0' }}>
            <p style={{ fontSize: '11px', fontWeight: '600', color: '#333', margin: '0 0 8px 0' }}>
              Display Settings
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '10px', color: '#333' }}>
                <input
                  type="checkbox"
                  checked={showMarker}
                  onChange={(e) => setShowMarker(e.target.checked)}
                  style={{ width: '12px', height: '12px', cursor: 'pointer' }}
                />
                <span>Marker</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '10px', color: '#333' }}>
                <input
                  type="checkbox"
                  checked={showTestText}
                  onChange={(e) => setShowTestText(e.target.checked)}
                  style={{ width: '12px', height: '12px', cursor: 'pointer' }}
                />
                <span>Dots</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '10px', color: '#333' }}>
                <input
                  type="checkbox"
                  checked={showTextMesh}
                  onChange={(e) => setShowTextMesh(e.target.checked)}
                  style={{ width: '12px', height: '12px', cursor: 'pointer' }}
                />
                <span>Text Mesh</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '10px', color: '#333' }}>
                <input
                  type="checkbox"
                  checked={conformToSurface}
                  onChange={(e) => setConformToSurface(e.target.checked)}
                  style={{ width: '12px', height: '12px', cursor: 'pointer' }}
                />
                <span>Conform</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '10px', color: '#333' }}>
                <input
                  type="checkbox"
                  checked={showUVMap}
                  onChange={(e) => setShowUVMap(e.target.checked)}
                  style={{ width: '12px', height: '12px', cursor: 'pointer' }}
                />
                <span>UV Map</span>
              </label>
            </div>
          </div>

          {/* Advanced Rendering Toggle */}
          <div className="control-group" style={{ marginTop: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useAdvancedRendering}
                onChange={(e) => setUseAdvancedRendering(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '12px', fontWeight: '600' }}>Advanced Rendering</span>
            </label>
          </div>
        </>
      ) : mode === 'original' ? (
        <>
          {/* Subdivision Level - Only show for Trinity or in debug mode or offline mode */}
          {(debugMode || offlineMode || objFile === './trinity.obj') && (
            <div className="control-group" style={{ marginTop: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600' }}>
                Subdivision Level: <span className="value">{subdivisionLevel}</span>
              </label>
              <input
                type="range"
                min="0"
                max="3"
                step="1"
                value={subdivisionLevel}
                onChange={(e) => setSubdivisionLevel(parseInt(e.target.value))}
                className="slider"
              />
              <div className="slider-labels">
                <span>0</span>
                <span>1</span>
                <span>2</span>
                <span>3</span>
              </div>
            </div>
          )}

          {/* Scale X Slider */}
          <div className="control-group">
            <label>
              Scale X: <span className="value">{scaleX.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.01"
              value={scaleX}
              onChange={(e) => setScaleX(parseFloat(e.target.value))}
              className="slider"
            />
            <div className="slider-labels">
              <span>0.5</span>
              <span>1.0</span>
              <span>1.5</span>
            </div>
          </div>

          {/* Scale Y Slider */}
          <div className="control-group">
            <label>
              Scale Y: <span className="value">{scaleY.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.01"
              value={scaleY}
              onChange={(e) => setScaleY(parseFloat(e.target.value))}
              className="slider"
            />
            <div className="slider-labels">
              <span>0.5</span>
              <span>1.0</span>
              <span>1.5</span>
            </div>
          </div>

          {/* Scale Z Slider */}
          <div className="control-group">
            <label>
              Scale Z: <span className="value">{scaleZ.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.01"
              value={scaleZ}
              onChange={(e) => setScaleZ(parseFloat(e.target.value))}
              className="slider"
            />
            <div className="slider-labels">
              <span>0.5</span>
              <span>1.0</span>
              <span>1.5</span>
            </div>
          </div>

          {/* Flat/Botai Toggle - Only show for Morpheus in non-debug mode */}
          {!debugMode && objFile && objFile.includes('Morpheus') && (
            <div className="control-group" style={{ marginTop: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600' }}>Style:</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="sample-button"
                  onClick={() => setTwist(0)}
                  style={{
                    background: twist === 0 ? '#000' : '#f5f5f5',
                    color: twist === 0 ? '#fff' : '#000',
                    flex: '1 1 45%'
                  }}
                >
                  Flat
                </button>
                <button
                  type="button"
                  className="sample-button"
                  onClick={() => setTwist(90)}
                  style={{
                    background: twist === 90 ? '#000' : '#f5f5f5',
                    color: twist === 90 ? '#fff' : '#000',
                    flex: '1 1 45%'
                  }}
                >
                  Botai
                </button>
              </div>
            </div>
          )}

          {/* Twist Slider - Always visible */}
          <div className="control-group">
            <label>
              Twist: <span className="value">{twist}°</span>
            </label>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={twist}
              onChange={(e) => setTwist(parseInt(e.target.value))}
              className="slider"
            />
            <div className="slider-labels">
              <span>-180°</span>
              <span>0°</span>
              <span>180°</span>
            </div>
          </div>

          {/* Inscription - Only show for Morpheus or in debug mode */}
          {(debugMode || (objFile && objFile.includes('Morpheus'))) && (
            <>
              <div className="control-group" style={{ marginTop: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={booleanSubtract}
                    onChange={(e) => setBooleanSubtract(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '12px', fontWeight: '600' }}>Inscription</span>
                </label>
              </div>

          {/* Text Input for Inscription */}
          {booleanSubtract && (
            <>
              <div className="control-group">
                <label style={{ fontSize: '12px', fontWeight: '600' }}>
                  Inscription Text:
                </label>
                <input
                  type="text"
                  value={localSubtractText}
                  onChange={(e) => setLocalSubtractText(e.target.value)}
                  onBlur={() => setSubtractText(localSubtractText)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setSubtractText(localSubtractText);
                      e.target.blur();
                    }
                  }}
                  placeholder="Enter text (e.g., Botai)"
                  maxLength="50"
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '13px',
                    border: '2px solid #ddd',
                    borderRadius: '4px',
                    marginTop: '4px',
                  }}
                />
              </div>

              {/* Font Selection */}
              <div className="control-group">
                <label style={{ fontSize: '12px', fontWeight: '600' }}>
                  Font:
                </label>
                <select
                  value={textFont}
                  onChange={(e) => setTextFont(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '13px',
                    border: '2px solid #ddd',
                    borderRadius: '4px',
                    marginTop: '4px',
                  }}
                >
                  <option value="helvetiker">Helvetica</option>
                  <option value="gentilis">Garamond</option>
                  <option value="droid_sans">Inter</option>
                  <option value="optimer">Caveat</option>
                  <option value="droid_serif">Pacifico</option>
                </select>
              </div>

              {/* Text Scale Buttons - Small/Medium/Large */}
              <div className="control-group">
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Text Size:</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className="sample-button"
                    onClick={() => setTextScale(0.05)}
                    style={{
                      background: textScale === 0.05 ? '#000' : '#f5f5f5',
                      color: textScale === 0.05 ? '#fff' : '#000',
                      flex: 1
                    }}
                  >
                    Small
                  </button>
                  <button
                    type="button"
                    className="sample-button"
                    onClick={() => setTextScale(0.10)}
                    style={{
                      background: textScale === 0.10 ? '#000' : '#f5f5f5',
                      color: textScale === 0.10 ? '#fff' : '#000',
                      flex: 1
                    }}
                  >
                    Medium
                  </button>
                  <button
                    type="button"
                    className="sample-button"
                    onClick={() => setTextScale(0.15)}
                    style={{
                      background: textScale === 0.15 ? '#000' : '#f5f5f5',
                      color: textScale === 0.15 ? '#fff' : '#000',
                      flex: 1
                    }}
                  >
                    Large
                  </button>
                </div>
              </div>

              {/* Text Depth Buttons - Deep/Shallow */}
              <div className="control-group">
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Text Depth:</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className="sample-button"
                    onClick={() => setTextDepth(-0.05)}
                    style={{
                      background: textDepth === -0.05 ? '#000' : '#f5f5f5',
                      color: textDepth === -0.05 ? '#fff' : '#000',
                      flex: 1
                    }}
                  >
                    Deep
                  </button>
                  <button
                    type="button"
                    className="sample-button"
                    onClick={() => setTextDepth(0.25)}
                    style={{
                      background: textDepth === 0.25 ? '#000' : '#f5f5f5',
                      color: textDepth === 0.25 ? '#fff' : '#000',
                      flex: 1
                    }}
                  >
                    Shallow
                  </button>
                </div>
              </div>

              {/* Text X Offset Slider */}
              <div className="control-group">
                <label>
                  Text X Offset: <span className="value">{textOffsetX.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min="-0.5"
                  max="0.5"
                  step="0.01"
                  value={textOffsetX}
                  onChange={(e) => setTextOffsetX(parseFloat(e.target.value))}
                  className="slider"
                />
                <div className="slider-labels">
                  <span>-0.5</span>
                  <span>0</span>
                  <span>0.5</span>
                </div>
              </div>

              {/* Text Y Offset Slider */}
              <div className="control-group">
                <label>
                  Text Y Offset: <span className="value">{textOffsetY.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min="-0.45"
                  max="0.45"
                  step="0.01"
                  value={textOffsetY}
                  onChange={(e) => setTextOffsetY(parseFloat(e.target.value))}
                  className="slider"
                />
                <div className="slider-labels">
                  <span>-0.45</span>
                  <span>0</span>
                  <span>0.45</span>
                </div>
              </div>

              {/* Text Rotation Slider */}
              <div className="control-group">
                <label>
                  Text Rotation: <span className="value">{textRotation.toFixed(0)}°</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={textRotation}
                  onChange={(e) => setTextRotation(parseFloat(e.target.value))}
                  className="slider"
                />
                <div className="slider-labels">
                  <span>0°</span>
                  <span>180°</span>
                  <span>360°</span>
                </div>
              </div>

              {/* Show Inscription Preview - Only show in debug mode */}
              {debugMode && (
                <div className="control-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showText}
                      onChange={(e) => setShowText(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: '600' }}>Show Inscription Preview</span>
                  </label>
                </div>
              )}
            </>
          )}
            </>
          )}

          {/* Advanced Rendering Toggle */}
          <div className="control-group" style={{ marginTop: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useAdvancedRendering}
                onChange={(e) => setUseAdvancedRendering(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '12px', fontWeight: '600' }}>Advanced Rendering</span>
            </label>
          </div>
        </>
      ) : (
        <>
          {/* Subdivision Level */}
          <div className="control-group" style={{ marginTop: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600' }}>
              Subdivision Level: <span className="value">{subdivisionLevel}</span>
            </label>
            <input
              type="range"
              min="0"
              max="3"
              step="1"
              value={subdivisionLevel}
              onChange={(e) => setSubdivisionLevel(parseInt(e.target.value))}
              className="slider"
            />
            <div className="slider-labels">
              <span>0</span>
              <span>1</span>
              <span>2</span>
              <span>3</span>
            </div>
          </div>
        </>
      )}

      {/* Spacer to push bottom content down */}
      <div style={{ flex: 1 }}></div>

      {/* 邮箱输入 */}
      {!offlineMode && (
      <div className="control-group" style={{ marginTop: '20px' }}>
        <label style={{ fontSize: '12px', fontWeight: '600' }}>Email Address:</label>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="email-input"
        />
      </div>
      )}

      {/* 价格显示 */}
      <div className="price-display">
        <h2>Price: ${price}</h2>
        <p className="price-note">
          {scaleX === 1.0 && scaleY === 1.0 && scaleZ === 1.0
            ? 'Standard Size (1.0×1.0×1.0) - Base Price' 
            : `Volume: ${(scaleX * scaleY * scaleZ).toFixed(2)} (${scaleX.toFixed(2)}×${scaleY.toFixed(2)}×${scaleZ.toFixed(2)})`
          }
        </p>
      </div>

      {/* Offline Mode Controls */}
      {offlineMode && (
          <div className="control-group" style={{ marginTop: '10px' }}>
              <input
                  type="file"
                  accept=".json"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleLoadJson}
              />
              <button
                  className="sample-button"
                  onClick={() => fileInputRef.current.click()}
                  style={{ width: '100%', marginBottom: '10px', background: '#333', color: 'white' }}
              >
                  Load Settings JSON
              </button>
              {confirmationNumber && (
                  <div style={{ fontSize: '12px', marginBottom: '10px', color: 'green' }}>
                      Loaded Order: {confirmationNumber}
                  </div>
              )}
          </div>
      )}

      {/* Order/Upload 按钮 */}
      <button
        className="order-button"
        onClick={handleOrder}
        disabled={isOrdering || (!offlineMode && !email)}
      >
        {isOrdering ? 'Processing & Uploading...' : (offlineMode ? 'Upload Mesh' : 'Order Now ')}
      </button>

      {/* Load JSON Settings - Only show in debug mode */}
      {debugMode && (
        <div className="control-group" style={{ marginTop: '20px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600' }}>Load Settings (JSON):</label>
          <input
            type="file"
            accept=".json"
            onChange={handleLoadJson}
            ref={fileInputRef}
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '13px',
              border: '2px solid #ddd',
              borderRadius: '4px',
              marginTop: '4px',
            }}
          />
        </div>
      )}
    </div>
  );
};

export default ControlPanel;
