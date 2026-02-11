import React, { useState, useEffect } from 'react';

const VesselManagement = ({ vessels, onDeactivate, onReactivate, onModify, onRegister }) => {
  // Track the target vessel waiting to have an action confirmed
  const [confirmingUuid, setConfirmingUuid] = useState(null);
  const [timerActive, setTimerActive] = useState(false);
  const activeCount = vessels.filter(v => v.is_active).length;
  const sortedVessels = [...vessels].sort((a, b) => a.name.localeCompare(b.name));
  
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
     <h3 className="flicker-subtle">Edit Existing // Register New</h3>
      
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
          {sortedVessels.map((vessel) => (
            <tr key={vessel.uuid} className={vessel.is_active ? 'vessel-active' : 'vessel-inactive'}>
              <td className="status-cell">
                {vessel.is_active ? (
                  <span>┗ Active ┓</span>
                ) : (
                  <span>╚ Deactivated ╗</span>
                )}
              </td>
              <td>{vessel.name}</td>
              <td>{vessel.hull_id_number || '◬ HIN Missing ◬' }</td>
              <td>{vessel.official_number || '◬ ON Missing ◬' }</td>
              <td className="actions-cell">
                <button className="button-icon" onClick={() => onModify(v)}>
                  ⌬ Edit
                </button>
                {vessel.is_active ? (
                  <button 
                    className={`button-icon button-danger ${confirmingUuid === vessel.uuid ? 'button-confirm-state' : ''}`}
                    onClick={() => handleActionClick(vessel.uuid, onDeactivate)}
                    disabled={activeCount < 2} // Disabled unless there's 2+ active vessels
                    title={activeCount < 2 ? "Can not disable the only active vessel" : ''}
                  >
                    {confirmingUuid === vessel.uuid ? '◭ Confirm Deactivation ◮' : '⌧ Deactivate ⌧'}
                  </button>
                ) : (
                  <button 
                    className={`button-icon button-danger ${confirmingUuid === vessel.uuid ? 'button-confirm-state' : ''}`}
                    onClick={() => handleActionClick(vessel.uuid, onReactivate)}
                  >
                    {confirmingUuid === vessel.uuid ? '▷ Confirm Reactivation ◁' : '⌗ Activate ⌗'}
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
