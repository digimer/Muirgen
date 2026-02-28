import React from 'react';
import { useSystemStatus } from './utils/hooks';

const Sidebar = ({ activeView, setActiveView }) => {
  const { isHddActive } = useSystemStatus();
  const menuItems       = [
    { id: 'VSM',               label: 'VSM Root',  glyph: '◫' },
    { id: 'VESSEL_MANAGEMENT', label: 'Vessels',   glyph: '⏃' },
    { id: 'USER_MANAGEMENT',   label: 'Operators', glyph: '⏿' },
  ];
  
  return (
    <nav className="sidebar-nav">
      <div className="sidebar-header">
        <span className="sidebar-title">Muirgen Core</span>
        <div className="sidebar-divider" />
      </div>
      
      <ul className="sidebar-list">
        {menuItems.map((item) => (
          <li key={item.id}>
            <button
              className={`sidebar-button ${activeView === item.id ? 'active-view' : ''}`}
              onClick={() => setActiveView(item.id)}
            >
              <span className="glyph">{item.glyph}</span>
              <span className="label-text">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* System Status Indicators (Bottom of sidebar) */}
      <div className="sidebar-status-indicators">
        <div className="status-led-group" title="Database Activity">
          {/* Virtual HDD Activity LED */}
          <span className={`auto-save-indicator ${isHddActive ? 'active' : ''}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" >
              <ellipse cx="12" cy="6" rx="7" ry="3"></ellipse>
              <path d="M5 6v12c0 1.66 3.13 3 7 3s7-1.34 7-3V6"></path>
            </svg>
          </span>
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;
