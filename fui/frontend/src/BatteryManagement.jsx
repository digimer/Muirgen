const BatteryManagement = ({ batteries, onView, onModify, onRegister }) => {
  const sortedBatteries = [...batteries].sort((a, b) => a.name.localeCompare(b.name));
  
  return (
    <div className="management-container vsm-dashboard">
      <div className="task-header-wrapper">
        <h2 className="flicker">VSM // Battery Index</h2>
      </div>
      <h3 className="flicker-subtle">Edit Existing // Register New</h3>
      
      <table className="data-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Name</th>
            <th>Make</th>
            <th>Model</th>
            <th>Voltage</th>
            <th>Capacity</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedBatteries.map((battery, index) => (
            <tr 
              key={battery.uuid} 
              className={`entity-pointer ${battery.is_active ? 'entity-active' : 'entity-inactive'}`}
              onClick={() => onView(sortedBatteries, index)}
            >
              <td className="status-cell">
                {battery.is_active ? <span>╠ Active ╣</span> : <span>╔ Deactivated ╗</span>}
              </td>
              <td>{battery.name}</td>
              <td>{battery.make}</td>
              <td>{battery.model}</td>
              <td>{battery.nominal_voltage} VDC</td>
              <td>{battery.capacity} Ah</td>
              <td className="actions-cell">
                <div className="actions-wrapper">
                  <button className="touch-button" onClick={(e) => { e.stopPropagation(); onModify(battery); }}>
                    Edit
                  </button>
                  <span className="large-icon">⌬</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="action-bar">
        <span className="cursor-prompt">⌲</span>
        <button className="touch-button" onClick={onRegister}>
          Register New Battery
        </button>
      </div>
    </div>
  );
}

export default BatteryManagement;
