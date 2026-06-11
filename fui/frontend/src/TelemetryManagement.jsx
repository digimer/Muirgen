import React from 'react';
const TelemetryManagement = ({ pushView }) => {
  const telemetryModules = [
    { id: 'TELEMETRY_SKYVIEW',  label: 'Skyview',   glyph: '🛰' }, 
    { id: 'TELEMETRY_WIND',     label: 'Wind',      glyph: '➠' },
    { id: 'TELEMETRY_HEADING',  label: 'Heading',   glyph: '➢' }
  ];
  return (
    <div className="system-grid-container">
      <h3 className="step-title">🛰 Telemetry Systems</h3>
      <div className="system-grid">
        {telemetryModules.map((mod) => (
          <button 
            key={mod.id} 
            className="system-grid-button-container" 
            onClick={() => pushView(mod.id)}
          >
            <div className="system-grid-button-inner">
              <span className="system-grid-glyph">{mod.glyph}</span>
              <span className="system-grid-label">[{mod.label}]</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
export default TelemetryManagement;
