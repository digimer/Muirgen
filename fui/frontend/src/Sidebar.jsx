import React from 'react';
import { useSystemStatus } from './utils/hooks';

const Sidebar = ({ activeView, setActiveView, onLogout, dataAlarm }) => {
  const { isHddActive } = useSystemStatus();
  const menuItems       = [
    { id: 'VSM',                label: 'VSM',       glyph: '⏍' },
    { id: 'VESSEL_MANAGEMENT',  label: 'Vessels',   glyph: '⏃' },
    { id: 'USER_MANAGEMENT',    label: 'Operators', glyph: '⏿' },
    { id: 'BATTERY_MANAGEMENT', label: 'Batteries', glyph: '⛫' },
    { id: 'MOTOR_MANAGEMENT',   label: 'Motors',    glyph: '⦵' },
    { id: 'POWER_MANAGEMENT',   label: 'Power',     glyph: '⏚' },
    { id: 'SENSOR_MANAGEMENT',  label: 'Sensors',   glyph: '⌖' },

  ];
  
  return (
    <nav className="sidebar-nav">
      
      {/* Header area */}
      <div className="sidebar-header">
        <span className="sidebar-title">Muirgen Alpha</span>
        <div className="sidebar-divider margin-divider-top" />
      </div>
      
      {/* Index buttons */}
      <ul className="sidebar-list">
        {menuItems.map((item) => (
          <li key={item.id}>
            <div className={`sidebar-item-container ${activeView === item.id ? 'is-active' : ''}`} onClick={() => setActiveView(item.id)}>
              <span className={`sidebar-item-glyph glyph-${item.id.toLowerCase()}`}>{item.glyph}</span>
              <button className="sidebar-item-button">
                <span className="sidebar-label-text">{item.label}</span>
              </button>
            </div>
          </li>
        ))}
      </ul>
      
      {/* Footer area */}
      <div className="sidebar-header">
        
        {/* Exit (End Session) Button (always inactive style) */}
        <div className="sidebar-item-container" onClick={onLogout}>
          <span className="sidebar-item-glyph glyph-logout">➠</span>
          <button className="sidebar-item-button" style={{ borderColor: 'var(--soft-red)' }}>
            <span className="sidebar-label-text">Exit</span>
          </button>
        </div>

        {/* Divider over the status activity LEDs */}
        <div className="sidebar-divider margin-divider-bottom" />
      </div>
 
      {/* Divider mirroring the top header spacing */}
      <div className="sidebar-status-led-group" title="Status/Activity Indicators">
        {/* Virtual HDD Activity LED */}
        <span className={`sidebar-hdd-led-indicator ${isHddActive ? 'active' : ''}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" >
            <ellipse cx="12" cy="6" rx="7" ry="3"></ellipse>
            <path d="M5 6v12c0 1.66 3.13 3 7 3s7-1.34 7-3V6"></path>
          </svg>
        </span>

        {/* Data Telemetry Alarm */}
        {dataAlarm && (
          <span className={`${dataAlarm.className} telemetry-sidebar-icon`} title="Data Telemetry Health">
            {dataAlarm.glyph}
          </span>
        )}
      </div>
    </nav>
  );
};

export default Sidebar;
