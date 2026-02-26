/* VesselEdit.jsx
 * Allows for the editing of existing vessels. It allows editing the general data about the vessel,
 * with special handling of changing 'is_active' to true/false via action buttons.
 */

import React, { useState, useEffect } from 'react';
import { apiFetch } from './utils/api.js';
import VesselMedia from './VesselMedia.jsx';
import VesselNotes from './VesselNotes.jsx';
import { useLocalStorageState } from './utils/hooks.js';

const VesselEdit = ({ vessel, onComplete, activeCount }) => {
  // Initialize state with the existing data passed from App.jsx. The '|| {''/0} insured the variables are 
  // never "null" to prevent upsetting react.
  const [formData, setFormData] = useState({
    vesselName: vessel?.name || '',
    vesselOfficialNumber: vessel?.flag_nation || '',
    vesselFlagNation: vessel?.flag_nation || '',
    vesselPortOfRegistry: vessel?.port_of_registry || '',
    vesselBuildDetails: vessel?.build_details || '',
    vesselHullIdentificationNumber: vessel?.hull_id_number || '',
    vesselKeelOffset: vessel?.keel_offset_cm || 0,
    vesselWaterlineOffset: vessel?.waterline_offset_cm || 0
  });
  const [error, setError] = useState(null);
  // Storage the active tab for browser reload/restart persistence
  const [activeTab, setActiveTab] = useLocalStorageState('vessel_edit_active_tab', 'specs');

  // 15-second action confirmation interlock. The user needs to confirm before the activation state is 
  // changed.
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);

  // The effect that handles the 15 second timeout
  useEffect(() => {
    let timeout;
    if (isConfirmingAction) {
      timeout = setTimeout(() => {
        setIsConfirmingAction(false);
      }, 15000);
    }
    return () => clearTimeout(timeout);
  }, [isConfirmingAction]);

  // Update function
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await apiFetch(`/api/vessels/${vessel.uuid}/update`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        // Notify the parent to refresh the list.
        onComplete();
      } else {
        const data = await res.json();
        setError(data.error || 'Update Failed; Unknown Error');
      }
    } catch (err) {
      setError(`Database Link Failure: [${err.message}]`);
    }
  }

  // Activate/Deactivate toggle
  const handleStatusToggle = async () => {
    if (!isConfirmingAction) {
      // Start the confirmation timer
      setIsConfirmingAction(true);
      return;
    }

    // If we are here, the user confirmed the action.
    try {
      // Are we activating or deactivating? The answer will determine the end point to be called.
      const useMethod = vessel.is_active ? 'DELETE' : 'PATCH';
      const endpoint = vessel.is_active ? 'deactivate' : 'reactivate';
      const res = await apiFetch(`/api/vessels/${vessel.uuid}/${endpoint}`, { method: useMethod });
      if (res.ok) {
        // refresh and return
        setIsConfirmingAction(false);
        onComplete();
      }
    } catch (err) {
      setError(`Vessels status change failed: [${err.message}]`);
    }
  }

  // Enable the submit button when all fields have data.
  const isFormValid =
    (formData.vesselName?.trim?.()                     ?? '') !== '' &&
    (formData.vesselOfficialNumber?.trim?.()           ?? '') !== '' &&
    (formData.vesselFlagNation?.trim?.()               ?? '') !== '' &&
    (formData.vesselPortOfRegistry?.trim?.()           ?? '') !== '' &&
    (formData.vesselBuildDetails?.trim?.()             ?? '') !== '' &&
    (formData.vesselHullIdentificationNumber?.trim?.() ?? '') !== '' &&
    formData.vesselKeelOffset                                 !== 0  &&
    formData.vesselWaterlineOffset                            !== 0;

  // Deactivation logic
  const minActiveVessels = 1;
  const isLastActive = activeCount <= minActiveVessels;
  const hasActiveUsers = (vessel.active_user_count || 0) > 0;

  // The button is locked if the is active and either it's the last active vessel, or there are active uses
  // who are assigned to this vessel.
  const isLockoutActive = vessel.is_active && (isLastActive || hasActiveUsers);

  // If the Deactivate button is locked out, choose the message to show.
  let lockoutMessage = null;
  if (vessel.is_active) {
    if (hasActiveUsers && isLastActive) {
      lockoutMessage = "Locked; Last Vessel and Assigned Operator(s)";
    } else if (hasActiveUsers) {
      lockoutMessage = "Locked; Users Assigned to Vessel";
    } else if (isLastActive) {
      lockoutMessage = "Locked; Only Active Vessel";
    }
  }
  
  // Debug logging.
  //console.warn(`Active count: [${activeCount}], is_active: [${vessel.is_active}]`);
  return (
    <div className="setup-mode">

      {/* Display errors if they're activer */}
      {error && <div className="status-display error">{error}</div>}

      {/* The navigation bar */}
      <div className="tab-bar">
        <div className={`tab-pair ${activeTab === 'specs' ? 'active' : ''}`} onClick={() => setActiveTab('specs')}>
          <span class="tab-icon glyph-specifications">⎐</span>
          <button type="button" className="tab-button">Specifications</button>
        </div>
        <div className={`tab-pair ${activeTab === 'optics' ? 'active' : ''}`} onClick={() => setActiveTab('optics')}>
          <span class="tab-icon glyph-optics">⏿</span>
          <button type="button" className="tab-button">Optics</button>
        </div>
        <div className={`tab-pair ${activeTab === 'data' ? 'active' : ''}`} onClick={() => setActiveTab('data')}>
          <span class="tab-icon glyph-data">⌖</span>
          <button type="button" className="tab-button">Data</button>
        </div>
        <div className={`tab-pair ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
          <span className="tab-icon glyph-logs">⧉</span>
          <button type="button" className="tab-button">Logs</button>
        </div>
      </div>

      {activeTab === 'specs' && (
        <form className="setup-form" onSubmit={handleSubmit}>
          {/* Vessel Name */}
          <div className="field-group">
            <div className="setup-field-header">
              <span className="cursor-prompt">◺</span>
              <label htmlFor="vesselName">
                <span className="label-text">Vessel Name</span>
              </label>
            </div>
            <input type="text"
              id="vesselName"
              autoComplete="off"
              value={formData.vesselName}
              onChange={(e) => setFormData({ ...formData, vesselName: e.target.value })}
              required
            />
          </div>
          {/* Official Number */}
          <div className="field-group">
            <div className="setup-field-header">
              <span className="cursor-prompt">◺</span>
              <label htmlFor="vesselOfficialNumber">
                <span className="label-text">Official Number</span>
              </label>
            </div>
            <input type="text"
              id="vesselOfficialNumber"
              autoComplete="off"
              value={formData.vesselOfficialNumber}
              onChange={(e) => setFormData({ ...formData, vesselOfficialNumber: e.target.value })}
              required
            />
          </div>
          {/* Flag Nation */}
          <div className="field-group">
            <div className="setup-field-header">
              <span className="cursor-prompt">◺</span>
              <label htmlFor="vesselFlagNation">
                <span className="label-text">Flag Nation</span>
              </label>
            </div>
            <input type="text"
              id="vesselFlagNation"
              autoComplete="off"
              value={formData.vesselFlagNation}
              onChange={(e) => setFormData({ ...formData, vesselFlagNation: e.target.value })}
              required
            />
          </div>
          {/* Port of Registry */}
          <div className="field-group">
            <div className="setup-field-header">
              <span className="cursor-prompt">◺</span>
              <label htmlFor="vesselPortOfRegistry">
                <span className="label-text">Port of Registry</span>
              </label>
            </div>
            <input type="text"
              id="vesselPortOfRegistry"
              autoComplete="off"
              value={formData.vesselPortOfRegistry}
              onChange={(e) => setFormData({ ...formData, vesselPortOfRegistry: e.target.value })}
              required
            />
          </div>
          {/* Build Details */}
          <div className="field-group">
            <div className="setup-field-header">
              <span className="cursor-prompt">◺</span>
              <label htmlFor="vesselBuildDetails">
                <span className="label-text">Build Details</span>
              </label>
            </div>
            <input type="text"
              id="vesselBuildDetails"
              autoComplete="off"
              value={formData.vesselBuildDetails}
              onChange={(e) => setFormData({ ...formData, vesselBuildDetails: e.target.value })}
              required
            />
          </div>
          {/* Hull ID Number */}
          <div className="field-group">
            <div className="setup-field-header">
              <span className="cursor-prompt">◺</span>
              <label htmlFor="vesselHullIdentificationNumber">
                <span className="label-text">Hull ID Number</span>
              </label>
            </div>
            <input type="text"
              id="vesselHullIdentificationNumber"
              autoComplete="off"
              required
              value={formData.vesselHullIdentificationNumber}
              onChange={(e) => setFormData({ ...formData, vesselHullIdentificationNumber: e.target.value })}
            />
          </div>
          {/* Keel Offset */}
          <div className="field-group">
            <div className="setup-field-header">
              <span className="cursor-prompt">◺</span>
              <label htmlFor="vesselKeelOffset">
                <span className="label-text">Keel Offset (cm)</span>
              </label>
            </div>
            <input type="number"
              id="vesselKeelOffset"
              autoComplete="off"
              step="1"
              inputMode="decimal"
              value={formData.vesselKeelOffset}
              onChange={(e) => setFormData({ ...formData, vesselKeelOffset: parseInt(e.target.value) || 0 })}
              required
            />
            <span className="soft-text operator-subtitles">Transducer to bottom of keel</span>
          </div>
          {/* Waterline Offset */}
          <div className="field-group">
            <div className="setup-field-header">
              <span className="cursor-prompt">◺</span>
              <label htmlFor="vesselWaterlineOffset">
                <span className="label-text">Waterline Offset (cm)</span>
              </label>
            </div>
            <input type="number"
              id="vesselWaterlineOffset"
              step="1"
              inputMode="decimal"
              value={formData.vesselWaterlineOffset}
              onChange={(e) => setFormData({ ...formData, vesselWaterlineOffset: parseInt(e.target.value) || 0 })}
              required
            />
            <span className="soft-text operator-subtitles">Transducer to waterline</span>
          </div>

          {/* The action row */}
          <div className="action-bar-container">
            <div className="action-group-vertical">
              <div className="action-group-horizontal">
                <button type="button" 
                  className={`touch-button ${isConfirmingAction ? 'button-confirm-state' : ''}`}
                  onClick={handleStatusToggle} 
                  disabled={isLockoutActive}
                >
                  {vessel.is_active 
                    ? (isConfirmingAction ? 'Confirm Deactivation' : 'Deactivate Vessel')
                    : (isConfirmingAction ? 'Confirm Reactivation' : 'Reactivate Vessel')
                  }
                </button>
                <span className="large-icon">{vessel.is_active ? '⌧' : '⌗'}</span>
              </div>
              {isLockoutActive && (
                <span className='soft-text operator-subtitles action-lockout-text'>
                  {lockoutMessage}
                </span>
              )}
            </div>
            
            {/* Spacer */}
            <button type="submit" className="touch-button action-submit-button" disabled={!isFormValid}>
              {vessel?.uuid ? 'Update' : 'Register'}
            </button>
          </div>
        </form>
      )}

      {/* Images tab */}
      {activeTab === 'optics' && (
        <VesselMedia vessel={vessel} mode="image" />
      )}

      {/* Files tab */}
      {activeTab === 'data' && (
        <VesselMedia vessel={vessel} mode="file" />
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <VesselNotes vessel={vessel} />
      )}

      {/* Safety timer bar */}
      {isConfirmingAction && (
        <div className="interlock-timer-container">
          <span className="timer-label">⧖ Safety Interlock:</span>
          <div className="timer-bar-frame">
            <div className="timer-bar-fill animate-shrink-long"></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VesselEdit;
