import React from 'react';

const ConfigPanel = ({ pushView }) => {
  const configModules = [
    { id: 'VESSEL_MANAGEMENT',  label: 'Vessels',   glyph: '⏃' },
    { id: 'USER_MANAGEMENT',    label: 'Operators', glyph: '⏿' },
    { id: 'BATTERY_MANAGEMENT', label: 'Batteries', glyph: '⛫' },
    { id: 'MOTOR_MANAGEMENT',   label: 'Motors',    glyph: '⦵' },
    { id: 'POWER_MANAGEMENT',   label: 'Power',     glyph: '⏚' },
    { id: 'SENSOR_MANAGEMENT',  label: 'Sensors',   glyph: '⌖' }
  ];

  return (
    <div className="system-grid-container">
      <h3 className="step-title">⌥ Configuration & Systems</h3>
      <div className="system-grid">
        {configModules.map((mod) => (
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

export default ConfigPanel;
