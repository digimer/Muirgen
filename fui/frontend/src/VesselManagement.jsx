import React, { useState, useEffect } from 'react';

const VesselManagement = ({ vessels, onDeactivate, onReactivate, onModify, onRegister }) => {
  // Track the target vessel waiting to have an action confirmed
  const [confirmingUuid, setConfirmingUuid] = useState(null);
  const [timerActive, setTimerActive] = useState(false);
  
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
      actionCallback(uuid);
      setConfirmingUuid(null);
      setTimerActive(false);
    } else {
      // First click, ask for confirmation
      setConfirmingUuid(uuid);
    }
  };
  
  return (
    <div className="management-container">
       {/* 
        Category Divider - &#9655; - ▷
        Active           - lead-in: ┗ &#9495;, lead-out: ┓ - &#9491;
        Inactive         - lead-in: ╚ &#9562;, lead-out: ╗ - &#9559;
        Unknown          - ◬ - &#9708; 
        Edit             - ⌬ - &#9004;
        Activate         - ⌗ - &#8983;
        Deactivate       - ⌧ - &#8999;
        Prompt           - ⌲ = &#9010;
        Confirm Risky    - lead-in: ◭ - &#9709;, lead-out: ◮ - &#9710;
        Confirm Safe     - lead-in: ▷ - &#9655;, lead-out: ◁ - &#9665;
        Timer            - ⧖ - &#10710;
      */}
     <h2 className="flicker-subtle">Terminal &#9655; Vessel Index</h2>
      
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
            <tr key={v.uuid} className={v.active ? 'vessel-active' : 'vessel-inactive'}>
              <td className="status-cell">
                {v.active ? (
                  <span>&#9495; Active &#9491;</span>
                ) : (
                  <span>&#9562; Deactivated &#9559;</span>
                )}
              </td>
              <td>{v.name}</td>
              <td>{v.hull_id_number || '&#9708; HIN Missing &#9708;' }</td>
              <td>{v.official_number || '&#9708; ON Missing &#9708;' }</td>
              <td className="actions-cell">
                <button className="button-icon" onClick={() => onModify(v)}>
                  &#9004; Edit
                </button>
                {v.active ? (
                  <button 
                    className={`button-icon button-danger ${confirmingUuid === v.uuid ? 'button-confirm-state' : ''}`}
                    onClick={() => handleActionClick(v.uuid, onDeactivate)}
                  >
                    {confirmingUuid === v.uuid ? '&#9709; Confirm Deactivation &#9710;' : '&#8999; Deactivate'}
                  </button>
                ) : (
                  <button 
                    className={`button-icon button-secure ${confirmingUuid === v.uuid ? 'button-confirm-state' : ''}`}
                    onClick={() => handleActionClick(v.uuid, onReactivate)}
                  >
                    {confirmingUuid === v.uuid ? '&#8983; Confirm Reactivation &#9665;' : '&#8983; Activate'}
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
          <span className="timer-label">&#10710; Interlock Timeout:</span>
          <div className="timer-bar-frame">
            <div className={`timer-bar-fill ${timerActive ? 'animate-shrink' : ''}`}></div>
          </div>
        </div>
      )}
      
      {/* Active Footer for adding new vessels */}
      <div className="command-line">
        <span className="cursor-prompt">&#9010;</span>
        <button className="button-primary" onClick={onRegister}>
          Register New Vessel
        </button>
      </div>
    </div>
  );
}

export default VesselManagement;
