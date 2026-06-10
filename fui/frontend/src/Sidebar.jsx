import React from 'react';
import { useSystemStatus } from './utils/hooks';

const Sidebar = ({ activeView, setActiveView, onLogout, dataAlarm }) => {
  const { isHddActive } = useSystemStatus();
  
  // Root level menu
  const menuItems = [
    { id: 'VSM',        label: 'VSM',        glyph: '⏍' },
    { id: 'CONFIG',     label: 'CONFIG',     glyph: '⌥' },
    { id: 'TELEMETRY',  label: 'TELEMETRY',  glyph: '🛰' },
    { id: 'STATUS',     label: 'STATUS',     glyph: '⏦' },
    { id: 'NAVIGATION', label: 'NAVIGATION', glyph: '⏧' },
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
        {menuItems.map((item) => {
          // Offset VSM to act as the master root visual anchor
          const isVsm = item.id === 'VSM';

          // Map any deep views back to their root for contextual anchoring
          const getRootForView = (viewId) => {
            if (!viewId) return 'VSM';
            if (viewId.startsWith('TELEMETRY')) return 'TELEMETRY';
            if (viewId.endsWith('_MANAGEMENT') || viewId === 'CONFIG') return 'CONFIG';
            if (viewId.startsWith('STATUS') || viewId.startsWith('STATE')) return 'STATUS';
            if (viewId.startsWith('NAVIGATION')) return 'NAVIGATION';
            return 'VSM';
          };
          const isActive = getRootForView(activeView) === item.id;

          return (
            <li key={item.id}>
              <div className={`sidebar-item-container ${isActive ? 'is-active' : ''}`} onClick={() => setActiveView(item.id)}>
                <span className={`sidebar-item-glyph glyph-${item.id.toLowerCase()}`}>{item.glyph}</span>
                <button className="sidebar-item-button">
                  <span className="sidebar-label-text">{item.label}</span>
                </button>
              </div>
              {isVsm && <div className="sidebar-divider margin-divider-bottom vsm-root-separator" />}
            </li>
          );
        })}
      </ul>
      
      {/* Footer area */}
      <div className="sidebar-header">
        
        {/* Exit (End Session) Button (always inactive style) */}
        <div className="sidebar-item-container" onClick={onLogout}>
          <span className="sidebar-item-glyph glyph-logout">➠</span>
          <button className="sidebar-item-button sidebar-exit-button">
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
          <span 
            className={`${dataAlarm.className} telemetry-sidebar-icon glyph-data-alarm telemetry-clickable`} 
            title="Data Telemetry Health"
            onClick={() => setActiveView('STATUS')}
          >
            {dataAlarm.glyph}
          </span>
        )}
      </div>
    </nav>
  );
};

export default Sidebar;
