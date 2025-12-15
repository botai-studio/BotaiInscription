import React, { useState, useRef, useEffect } from 'react';

// Available fonts (Three.js built-in + Google Fonts via @compai)
// minSize: minimum font size (1-5), where 1=0.015, 5=0.035
const AVAILABLE_FONTS = [
  // Three.js built-in fonts
  { id: 'helvetiker', name: 'Helvetica', minSize: 1 },
  { id: 'optimer', name: 'Optimer', minSize: 4 },
  { id: 'gentilis', name: 'Gentilis', minSize: 4 },
  // Google Fonts via @compai
  { id: 'roboto', name: 'Roboto', minSize: 1 },
  { id: 'open-sans', name: 'Open Sans', minSize: 1 },
  { id: 'merriweather', name: 'Merriweather', minSize: 2 }
];

// Helper to convert scale to font size (1-5)
const scaleToFontSize = (scale) => Math.round((scale - 0.015) / 0.005) + 1;
// Helper to convert font size (1-5) to scale
const fontSizeToScale = (size) => 0.015 + (size - 1) * 0.005;

/**
 * TextInput - Input that only updates parent on blur or Enter
 */
function DeferredTextInput({ value, onChange, ...props }) {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);
  
  // Sync local value when external value changes (e.g., switching inscriptions)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  const hasChanges = localValue !== value;
  
  const handleConfirm = () => {
    if (hasChanges) {
      onChange(localValue);
    }
    setIsFocused(false);
    inputRef.current?.blur();
  };
  
  const handleBlur = (e) => {
    // Don't trigger blur if clicking the confirm button
    if (e.relatedTarget?.classList?.contains('text-confirm-btn')) {
      return;
    }
    if (hasChanges) {
      onChange(localValue);
    }
    setIsFocused(false);
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleConfirm();
    }
  };
  
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      <input
        {...props}
        ref={inputRef}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={{ flex: 1 }}
      />
      {(isFocused || hasChanges) && (
        <button
          className="text-confirm-btn"
          onClick={handleConfirm}
          title="Confirm text"
          style={{
            padding: '4px 8px',
            background: hasChanges ? '#000' : '#ccc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            minWidth: '28px'
          }}
        >
          ✓
        </button>
      )}
    </div>
  );
}

/**
 * ControlPanel - Left sidebar for inscription controls
 */
export default function ControlPanel({
  inscriptions,
  selectedInscriptionId,
  setSelectedInscriptionId,
  updateInscription,
  deleteInscription,
  addInscription,
  onApplyInscriptions,
  onReset,
  isCarved,
  uvWarnings = {},
  showMarker,
  setShowMarker,
  showArrows,
  setShowArrows,
  showTextMesh,
  setShowTextMesh,
  showUVPanel,
  setShowUVPanel,
  showClipModel,
  setShowClipModel,
  maxTriangleEdge,
  setMaxTriangleEdge,
  onDownloadSTL,
  onDownloadJSON,
  onLoadJSON,
  email,
  setEmail,
  onOrder,
  isOrdering,
  devMode = false
}) {
  const [settingsCollapsed, setSettingsCollapsed] = useState(true);
  const fileInputRef = useRef(null);
  const hasPlacedInscriptions = inscriptions.some(i => i.clickData);
  
  // Check if any inscription has out of bounds warning
  const hasAnyWarning = Object.values(uvWarnings).some(w => w && w.outOfBounds);

  return (
    <div className="control-panel">
      {/* Logo - hidden on mobile */}
      <div className="logo-container">
        <img src="./Botai_Logo.svg" alt="Botai" style={{ width: '100px' }} />
      </div>

      {/* Scrollable Content Area */}
      <div className="control-panel-scroll">
        {/* Inscription Cards Section */}
        <div>
          <p className="section-title"><b>Botai</b> Inscriptions</p>
          
          {/* Inscription Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {inscriptions.map((inscription, index) => (
            <div
              key={inscription.id}
              onClick={() => setSelectedInscriptionId(inscription.id)}
              className={`inscription-card ${selectedInscriptionId === inscription.id ? 'inscription-card--selected' : ''}`}
            >
              {/* Card Header */}
              <div className="inscription-card__header">
                <span className="inscription-card__title">
                  #{index + 1} {inscription.clickData ? '✓ Placed' : '○ Not placed'}
                </span>
                {inscriptions.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteInscription(inscription.id); }}
                    className="inscription-card__delete"
                    title="Delete inscription"
                  >
                    ×
                  </button>
                )}
              </div>
              
              {/* Text Input */}
              <div style={{ marginBottom: '8px' }}>
                <DeferredTextInput
                  type="text"
                  value={inscription.text}
                  onChange={(newText) => updateInscription(inscription.id, { text: newText })}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Enter text"
                  maxLength="30"
                  className="card-input"
                />
              </div>
              
              {/* Font Size Slider */}
              {(() => {
                const fontConfig = AVAILABLE_FONTS.find(f => f.id === inscription.font) || AVAILABLE_FONTS[0];
                const minSize = fontConfig.minSize || 1;
                const currentSize = scaleToFontSize(inscription.scale);
                return (
                  <div className="form-field">
                    <label className="form-field__label">
                      <span>Font Size</span>
                      <span>{currentSize}</span>
                    </label>
                    <input
                      type="range"
                      min={minSize}
                      max="5"
                      step="1"
                      value={Math.max(currentSize, minSize)}
                      onChange={(e) => updateInscription(inscription.id, { scale: fontSizeToScale(parseInt(e.target.value)) })}
                      onClick={(e) => e.stopPropagation()}
                      className="slider"
                    />
                    {minSize > 1 && (
                      <div className="form-field__hint">Min size {minSize} for this font</div>
                    )}
                  </div>
                );
              })()}
              
              {/* Depth Slider */}
              <div className="form-field">
                <label className="form-field__label">
                  <span>Depth</span>
                  <span>{inscription.depth.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.3"
                  value={inscription.depth}
                  onChange={(e) => updateInscription(inscription.id, { depth: parseFloat(e.target.value) })}
                  onClick={(e) => e.stopPropagation()}
                  className="slider"
                />
              </div>
              
              {/* Rotation Slider */}
              <div className="form-field">
                <label className="form-field__label">
                  <span>Rotation</span>
                  <span>{inscription.rotation}°</span>
                </label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={inscription.rotation}
                  onChange={(e) => updateInscription(inscription.id, { rotation: parseFloat(e.target.value) })}
                  onClick={(e) => e.stopPropagation()}
                  className="slider"
                />
              </div>
              
              {/* Font Selection */}
              <div className="form-field">
                <label className="form-field__label form-field__label--block">Font</label>
                <select
                  value={inscription.font}
                  onChange={(e) => {
                    const newFont = e.target.value;
                    const fontConfig = AVAILABLE_FONTS.find(f => f.id === newFont);
                    const minSize = fontConfig?.minSize || 1;
                    const currentSize = scaleToFontSize(inscription.scale);
                    // Auto-adjust scale if below minimum for new font
                    if (currentSize < minSize) {
                      updateInscription(inscription.id, { font: newFont, scale: fontSizeToScale(minSize) });
                    } else {
                      updateInscription(inscription.id, { font: newFont });
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="card-select"
                >
                  {AVAILABLE_FONTS.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              
              {/* Position Info (if placed) - only in dev mode */}
              {devMode && inscription.clickData && (
                <div className="inscription-card__uv-info">
                  UV: ({inscription.clickData.uv.x.toFixed(3)}, {inscription.clickData.uv.y.toFixed(3)})
                </div>
              )}
              
              {/* Warning if out of UV bounds */}
              {uvWarnings[inscription.id]?.outOfBounds && (
                <div className="info-box info-box--warning" style={{ marginTop: '8px', marginBottom: 0 }}>
                  <p>⚠️ {uvWarnings[inscription.id]?.reverted 
                    ? 'Click was outside UV map. Reverted to previous position.' 
                    : 'Text extends outside UV map. Try reducing scale or repositioning.'}</p>
                </div>
              )}
            </div>
          ))}
          
          {/* Add New Inscription Card */}
          {!isCarved && (
            <div onClick={addInscription} className="add-card add-inscription-btn">
              <span className="add-card__icon">+</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={onApplyInscriptions}
          disabled={!hasPlacedInscriptions || isCarved || hasAnyWarning}
          className="btn btn--primary inscribe-btn"
        >
          Inscribe
        </button>
        
        <button onClick={onReset} className="btn btn--secondary">
          ↺ Reset
        </button>
        
        {devMode && (
          <>
            <button 
              onClick={onDownloadSTL} 
              className="btn btn--secondary"
              title="Download the current model as STL file"
            >
              📥 Download STL
            </button>
            <button 
              onClick={onDownloadJSON} 
              className="btn btn--secondary"
              title="Download inscription settings as JSON"
            >
              📄 Download JSON
            </button>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={onLoadJSON}
            />
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="btn btn--secondary"
              title="Load inscription settings from JSON"
            >
              📂 Load JSON
            </button>
          </>
        )}
      </div>

      {/* Display Settings - only in dev mode */}
      {devMode && (
        <div className={`collapsible ${settingsCollapsed ? 'collapsible--collapsed' : ''}`}>
          <div 
            className="collapsible__header"
            onClick={() => setSettingsCollapsed(!settingsCollapsed)}
          >
            <span>Display Settings</span>
            <span className="collapsible__icon">{settingsCollapsed ? '+' : '−'}</span>
          </div>
          {!settingsCollapsed && (
            <div className="collapsible__content">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showMarker}
                  onChange={(e) => setShowMarker(e.target.checked)}
                />
                <span>Show Click Points</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showArrows}
                  onChange={(e) => setShowArrows(e.target.checked)}
                />
                <span>Show Arrows</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showTextMesh}
                  onChange={(e) => setShowTextMesh(e.target.checked)}
                />
                <span>Show Text Meshes</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showUVPanel}
                  onChange={(e) => setShowUVPanel(e.target.checked)}
                />
                <span>Show UV Panel</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showClipModel}
                  onChange={(e) => setShowClipModel(e.target.checked)}
                />
                <span>Show Clip Model</span>
              </label>
              
              {/* Max Triangle Edge Slider */}
              <div style={{ marginTop: '12px' }}>
                <label className="slider-label">
                  <span>Max Triangle Edge: {maxTriangleEdge.toFixed(2)}</span>
                  <input
                    type="range"
                    min="0.05"
                    max="2.0"
                    step="0.05"
                    value={maxTriangleEdge}
                    onChange={(e) => setMaxTriangleEdge(parseFloat(e.target.value))}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </label>
                <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                  Lower = more subdivisions, smoother curves
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status */}
      {isCarved && (
        <div className="info-box info-box--success" style={{ marginTop: '16px', marginBottom: 0 }}>
          <p>✓ Inscriptions applied successfully</p>
        </div>
      )}

      {/* Order Section - Mobile (inside scroll) */}
      <div className="order-section order-section--mobile">
        {/* Email Input */}
        <div className="control-group">
          <label style={{ fontSize: '12px', fontWeight: '600' }}>Email Address:</label>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="email-input"
          />
        </div>

        {/* Price Display */}
        <div className="price-display">
          <h2>${88 + inscriptions.reduce((sum, i) => sum + (i.text?.length || 0), 0)}</h2>
          <p className="price-note">$88 base + $1 per character ({inscriptions.reduce((sum, i) => sum + (i.text?.length || 0), 0)} chars)</p>
        </div>

        {/* Order Button */}
        <button
          className="order-button"
          onClick={onOrder}
          disabled={isOrdering || !email}
        >
          {isOrdering ? 'Processing...' : 'Order Now'}
        </button>
      </div>
      </div>{/* End Scrollable Content Area */}

      {/* Order Section - Desktop (fixed bottom) */}
      <div className="order-section order-section--desktop" id="order-section">
        {/* Email Input */}
        <div className="control-group">
          <label style={{ fontSize: '12px', fontWeight: '600' }}>Email Address:</label>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="email-input"
          />
        </div>

        {/* Price Display */}
        <div className="price-display">
          <h2>${88 + inscriptions.reduce((sum, i) => sum + (i.text?.length || 0), 0)}</h2>
          <p className="price-note">$88 base + $1 per character ({inscriptions.reduce((sum, i) => sum + (i.text?.length || 0), 0)} chars)</p>
        </div>

        {/* Order Button */}
        <button
          className="order-button"
          onClick={onOrder}
          disabled={isOrdering || !email}
        >
          {isOrdering ? 'Processing...' : 'Order Now'}
        </button>
      </div>
    </div>
  );
}
