import React, { useState, useEffect } from 'react';

const VesselManagement = ({ vessels, onDeactivate, onReactivate, onModify, onRegister }) => {
  // Track the target vessel waiting to have an action confirmed
  const [confirmingUuid, setConfirmingUuid] = useState(null);
  const [timerActive, setTimerActive] = useState(false);
  const activeCount = vessels.filter(v => v.is_active).length;
  
  // Handle 15 second timeout
  useEffect(() => {
    let timeout;
    if (confirmingUuid) {
      setTimerActive(true);
      timeout = setTimeout(() => {
        setConfirmingUuid(null);
        setTimerActive(false);
      }, 15000);
    }
    return () => clearTimeout(timeout);
  }, [confirmingUuid]);
  
  // Action handler
  const handleActionClick = (uuid, actionCallBack) => {
    if (confirmingUuid === uuid) {
      // Second click, confirm
      actionCallBack(uuid);
      setConfirmingUuid(null);
      setTimerActive(false);
    } else {
      // First click, ask for confirmation
      setConfirmingUuid(uuid);
    }
  };
  
  return (
    <div className="management-container">
     <h2 className="flicker-subtle">Terminal ▷ Vessel Index</h2>
      
      <table className="data-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Reg. Name</th>
            <th>Hull ID</th>
            <th>Official Number</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {vessels.map(v => (
            <tr key={v.uuid} className={v.is_active ? 'vessel-active' : 'vessel-inactive'}>
              <td className="status-cell">
                {v.is_active ? (
                  <span>┗ Active ┓</span>
                ) : (
                  <span>╚ Deactivated ╗</span>
                )}
              </td>
              <td>{v.name}</td>
              <td>{v.hull_id_number || '◬ HIN Missing ◬' }</td>
              <td>{v.official_number || '◬ ON Missing ◬' }</td>
              <td className="actions-cell">
                <button className="button-icon" onClick={() => onModify(v)}>
                  ⌬ Edit
                </button>
                {v.is_active ? (
                  <button 
                    className={`button-icon button-danger ${confirmingUuid === v.uuid ? 'button-confirm-state' : ''}`}
                    onClick={() => handleActionClick(v.uuid, onDeactivate)}
                    disabled={activeCount < 2} // Disabled unless there's 2+ active vessels
                    title={activeCount < 2 ? "Can not disable the only active vessel" : ''}
                  >
                    {confirmingUuid === v.uuid ? '◭ Confirm Deactivation ◮' : '⌧ Deactivate ⌧'}
                  </button>
                ) : (
                  <button 
                    className={`button-icon button-secure ${confirmingUuid === v.uuid ? 'button-confirm-state' : ''}`}
                    onClick={() => handleActionClick(v.uuid, onReactivate)}
                  >
                    {confirmingUuid === v.uuid ? '▷ Confirm Reactivation ◁' : '⌗ Activate ⌗'}
                 </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Timer HUD element */}
      {confirmingUuid && (
        <div className="interlock-timer-container">
          <span className="timer-label">⧖ Interlock Timeout:</span>
          <div className="timer-bar-frame">
            <div className={`timer-bar-fill ${timerActive ? 'animate-shrink' : ''}`}></div>
          </div>
        </div>
      )}
      
      {/* Active Footer for adding new vessels */}
      <div className="action-bar">
        <span className="cursor-prompt">⌲</span>
        <button className="touch-button" onClick={onRegister}>
          Register New Vessel
        </button>
      </div>
    </div>
  );
}

export default VesselManagement;
