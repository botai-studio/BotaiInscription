import React, { useState } from 'react';

// Available fonts
const AVAILABLE_FONTS = [
  { id: 'helvetiker', name: 'Helvetica' },
  { id: 'gentilis', name: 'Garamond' },
  { id: 'optimer', name: 'Optimer' },
  { id: 'droid_sans', name: 'Droid Sans' },
  { id: 'droid_serif', name: 'Droid Serif' }
];

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
  onDownloadSTL,
  email,
  setEmail,
  onOrder,
  isOrdering
}) {
  const [instructionsCollapsed, setInstructionsCollapsed] = useState(false);
  const [settingsCollapsed, setSettingsCollapsed] = useState(true);
  const hasPlacedInscriptions = inscriptions.some(i => i.clickData);
  
  // Check if any inscription has out of bounds warning
  const hasAnyWarning = Object.values(uvWarnings).some(w => w && w.outOfBounds);

  return (
    <div className="control-panel">
      {/* Logo */}
      <div style={{ marginBottom: '16px' }}>
        <img src="./Botai_Logo.svg" alt="Botai" style={{ width: '100px' }} />
      </div>

      {/* Inscription Cards Section */}
      <div>
        <p className="section-title">Inscriptions</p>
        
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
                <input
                  type="text"
                  value={inscription.text}
                  onChange={(e) => updateInscription(inscription.id, { text: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Enter text"
                  maxLength="30"
                  className="card-input"
                />
              </div>
              
              {/* Scale Slider */}
              <div className="form-field">
                <label className="form-field__label">
                  <span>Scale</span>
                  <span>{inscription.scale.toFixed(3)}</span>
                </label>
                <input
                  type="range"
                  min="0.005"
                  max="0.03"
                  step="0.001"
                  value={inscription.scale}
                  onChange={(e) => updateInscription(inscription.id, { scale: parseFloat(e.target.value) })}
                  onClick={(e) => e.stopPropagation()}
                  className="slider"
                />
              </div>
              
              {/* Depth Slider */}
              <div className="form-field">
                <label className="form-field__label">
                  <span>Depth</span>
                  <span>{inscription.depth.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
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
                  min="0"
                  max="360"
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
                  onChange={(e) => updateInscription(inscription.id, { font: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  className="card-select"
                >
                  {AVAILABLE_FONTS.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              
              {/* Position Info (if placed) */}
              {inscription.clickData && (
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
            <div onClick={addInscription} className="add-card">
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
          className="btn btn--primary"
        >
          Inscribe
        </button>
        
        <button onClick={onReset} className="btn btn--secondary">
          ↺ Reset
        </button>
        
        <button 
          onClick={onDownloadSTL} 
          className="btn btn--secondary"
          title="Download the current model as STL file"
        >
          📥 Download STL
        </button>
      </div>

      <div> </div>

      {/* Instructions */}
      <div className={`collapsible ${instructionsCollapsed ? 'collapsible--collapsed' : ''}`}>
        <div 
          className="collapsible__header"
          onClick={() => setInstructionsCollapsed(!instructionsCollapsed)}
        >
          <span>Instructions</span>
          <span className="collapsible__icon">{instructionsCollapsed ? '+' : '−'}</span>
        </div>
        {!instructionsCollapsed && (
          <div className="collapsible__content">
            <p>
              1. Select an inscription card<br/>
              2. Click on the model to place text<br/>
              3. Adjust text, scale, rotation, depth<br/>
              4. Click "Inscribe" to carve
            </p>
          </div>
        )}
      </div>


      {/* Display Settings */}
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
          </div>
        )}
      </div>

      {/* Status */}
      {isCarved && (
        <div className="info-box info-box--success" style={{ marginTop: '16px', marginBottom: 0 }}>
          <p>✓ Inscriptions applied successfully</p>
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }}></div>

      {/* Email Input */}
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

      {/* Price Display */}
      <div className="price-display">
        <h2>$58</h2>
        <p className="price-note">Base price for custom inscription</p>
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
  );
}
