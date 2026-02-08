import React from 'react';

const Sidebar = ({ activeView, setActiveView }) => {
  const menuItems = [
    { id: 'HUD',               label: 'System HUD',   glyph: '◫' },
    { id: 'VESSEL_MANAGEMENT', label: 'Vessel Index', glyph: '⏃' },
    { id: 'USER_MANAGEMENT',   label: 'User Index',   glyph: '⏿' },
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
              <span className="glyph" dangerouslySetInnerHTML= {{ __html: item.glyph }} />
              <span className="label-text">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Sidebar;
