import React from 'react';

const Sidebar = ({ currentView, setCurrentView }) => {
  const menuItems = [
    { id: 'HUD',               label: 'System HUD',   glyph: '&#9707;' },
    { id: 'VESSEL_MANAGEMENT', label: 'Vessel Index', glyph: '&#9655;' },
    { id: 'USER_MANAGEMENT',   label: 'User Index',   glyph: '&#9004;' },
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
              className={`sidebar-button ${currentView === item.id ? 'active-view' : ''}`}
              onClick={() => setCurrentView(item.id)}
            >
              <span className="glyph" dangerouslySetInnerHTML= {{ __html: item.glyph }} />
              <span className="label-text">{item.label}</span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
} ;

export default Sidebar;
