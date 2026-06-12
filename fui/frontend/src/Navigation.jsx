// Navigation menu
import React from 'react';

const Navigation = ({ pushView }) => {
  const navigationModules = [
    { id: 'NAVIGATION_MAPS', label: 'Cartography', glyph: '🌐︎' }
  ];

  return (
    <div className="system-grid-container">
      <h3 className="step-title">⏧ Navigation Systems</h3>
      <div className="system-grid">
        {navigationModules.map((mod) => (
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

export default Navigation;
