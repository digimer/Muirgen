/* VesselEdit.jsx
 * Allows for the editing of existing vessels. It allows editing the general data about the vessel,
 * with special handling of changing 'is_active' to true/false via action buttons.
 */

import React, { useState, useEffect } from 'react';
import { apiFetch } from './utils/api.js';
import EntityMedia from './EntityMedia.jsx';
import EntityNotes from './EntityNotes.jsx';
import { useLocalStorageState } from './utils/hooks.js';

const VesselEdit = ({ vessel, onComplete, onCancel, jumpToNoteId, activeCount }) => {
  // Initialize state with the existing data passed from App.jsx. The '|| {''/0} insured the variables are 
  // never "null" to prevent upsetting react.
  const [formData, setFormData] = useState({
    name:                vessel?.name                || '',
    official_number:     vessel?.official_number     || '',
    flag_nation:         vessel?.flag_nation         || '',
    port_of_registry:    vessel?.port_of_registry    || '',
    build_details:       vessel?.build_details       || '',
    hull_id_number:      vessel?.hull_id_number      || '',
    keel_offset_cm:      vessel?.keel_offset_cm      || 0,
    waterline_offset_cm: vessel?.waterline_offset_cm || 0
  });
  
  const [error, setError]     = useState(null);
  const [success, setSuccess] = useState(null);
  /* const [error, setError] = useState("Test: This is a test of the error broadcast system."); */

  // Storage the active tab for browser reload/restart persistence
  const [activeTab, setActiveTab]                   = useLocalStorageState('vessel_edit_active_tab', 'specs');
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);

  // Intercept the tab routing if we are deep-linking to a note. We only want this to run once when the
  // component initially mounts!
  useEffect(() => {
    if (jumpToNoteId === 'optics') {
      setActiveTab('optics');
    } else if (jumpToNoteId) {
       setActiveTab('logs');
    }
  }, [jumpToNoteId,]); // activeTab is deliberately missing so it doesn't loop

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
    setSuccess(null);
    try {
      const res = await apiFetch(`/api/vessels/${vessel.uuid}/update`, {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        // Notify the parent to refresh the list.
        //onComplete();
        setSuccess("Updated parameters recorded successfully.");
        setTimeout(() => setSuccess(null), 6000);
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
      const endpoint = vessel.is_active ? 'deactivate' : 'reactivate';
      const res = await apiFetch(`/api/vessels/${vessel.uuid}/${endpoint}`, { method: 'POST' });
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
    (formData.name?.trim?.()             ?? '') !== '' &&
    (formData.official_number?.trim?.()  ?? '') !== '' &&
    (formData.flag_nation?.trim?.()      ?? '') !== '' &&
    (formData.port_of_registry?.trim?.() ?? '') !== '' &&
    (formData.build_details?.trim?.()    ?? '') !== '' &&
    (formData.hull_id_number?.trim?.()   ?? '') !== '' &&
    formData.keel_offset_cm                     !== 0  &&
    formData.waterline_offset_cm                !== 0;

  // Deactivation logic
  const minActiveVessels = 1;
  const isLastActive     = activeCount <= minActiveVessels;
  const hasActiveUsers   = (vessel.active_user_count || 0) > 0;

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
  
  // Allowed note categories for vessels
  const vesselCategories = [
    'Log::Crew',
    'Log::Incident',
    'Log::Maintenance',
    'Log::Private',
    'Log::Voyage',
    'Log::Weather',
    'Note::General'
  ];

  return (
    <div className="setup-mode panel-viewport">
      <div className="task-header-wrapper">
        <h2 className="flicker">VSM // {vessel?.uuid ? 'VESSELS' : 'REGISTER'} // [{activeTab.toUpperCase()}]</h2>
      </div>
      
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

      <div className="panel-body">
        {activeTab === 'specs' && (
          <form className="setup-form" onSubmit={handleSubmit}>
            {/* Vessel Name */}
            <div className="field-group">
              <div className="setup-field-header">
                <span className="cursor-prompt">◺</span>
                <label htmlFor="name">
                  <span className="label-text">Vessel Name</span>
                </label>
              </div>
              <input type="text"
                id="name"
                autoComplete="off"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            {/* Official Number */}
            <div className="field-group">
              <div className="setup-field-header">
                <span className="cursor-prompt">◺</span>
                <label htmlFor="official_number">
                  <span className="label-text">Official Number</span>
                </label>
              </div>
              <input type="text"
                id="official_number"
                autoComplete="off"
                value={formData.official_number}
                onChange={(e) => setFormData({ ...formData, official_number: e.target.value })}
                required
              />
            </div>
            {/* Flag Nation */}
            <div className="field-group">
              <div className="setup-field-header">
                <span className="cursor-prompt">◺</span>
                <label htmlFor="flag_nation">
                  <span className="label-text">Flag Nation</span>
                </label>
              </div>
              <input type="text"
                id="flag_nation"
                autoComplete="off"
                value={formData.flag_nation}
                onChange={(e) => setFormData({ ...formData, flag_nation: e.target.value })}
                required
              />
            </div>
            {/* Port of Registry */}
            <div className="field-group">
              <div className="setup-field-header">
                <span className="cursor-prompt">◺</span>
                <label htmlFor="port_of_registry">
                  <span className="label-text">Port of Registry</span>
                </label>
              </div>
              <input type="text"
                id="port_of_registry"
                autoComplete="off"
                value={formData.port_of_registry}
                onChange={(e) => setFormData({ ...formData, port_of_registry: e.target.value })}
                required
              />
            </div>
            {/* Build Details */}
            <div className="field-group">
              <div className="setup-field-header">
                <span className="cursor-prompt">◺</span>
                <label htmlFor="build_details">
                  <span className="label-text">Build Details</span>
                </label>
              </div>
              <input type="text"
                id="build_details"
                autoComplete="off"
                value={formData.build_details}
                onChange={(e) => setFormData({ ...formData, build_details: e.target.value })}
                required
              />
            </div>
            {/* Hull ID Number */}
            <div className="field-group">
              <div className="setup-field-header">
                <span className="cursor-prompt">◺</span>
                <label htmlFor="hull_id_number">
                  <span className="label-text">Hull ID Number</span>
                </label>
              </div>
              <input type="text"
                id="hull_id_number"
                autoComplete="off"
                required
                value={formData.hull_id_number}
                onChange={(e) => setFormData({ ...formData, hull_id_number: e.target.value })}
              />
            </div>
            {/* Keel Offset */}
            <div className="field-group">
              <div className="setup-field-header">
                <span className="cursor-prompt">◺</span>
                <label htmlFor="keel_offset_cm">
                  <span className="label-text">Keel Offset (cm)</span>
                </label>
              </div>
              <input type="number"
                id="keel_offset_cm"
                autoComplete="off"
                step="1"
                inputMode="decimal"
                value={formData.keel_offset_cm}
                onChange={(e) => setFormData({ ...formData, keel_offset_cm: parseInt(e.target.value) || 0 })}
                required
              />
              <span className="soft-text operator-subtitles">Transducer to bottom of keel</span>
            </div>
            {/* Waterline Offset */}
            <div className="field-group">
              <div className="setup-field-header">
                <span className="cursor-prompt">◺</span>
                <label htmlFor="waterline_offset_cm">
                  <span className="label-text">Waterline Offset (cm)</span>
                </label>
              </div>
              <input type="number"
                id="waterline_offset_cm"
                step="1"
                inputMode="decimal"
                value={formData.waterline_offset_cm}
                onChange={(e) => setFormData({ ...formData, waterline_offset_cm: parseInt(e.target.value) || 0 })}
                required
              />
              <span className="soft-text operator-subtitles">Transducer to waterline</span>
            </div>
          </form>
        )}
        
        {/* Images tab */}
        {activeTab === 'optics' && (
          <EntityMedia entityId={vessel?.uuid} referenceTable="vessels" mode="image" />
        )}

        {/* Files tab */}
        {activeTab === 'data' && (
          <EntityMedia entityId={vessel?.uuid} referenceTable="vessels" mode="file" />
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <EntityNotes 
            entityId={vessel?.uuid} 
            referenceTable="vessels" 
            allowedCategories={vesselCategories} 
            deepLinkNoteId={jumpToNoteId}
            onExitEdit={(noteId) => {
              if (onCancel) onCancel(noteId);
            }}
          />
        )}
      </div>
      
      {/* Pinned Footer */}
      <div className="panel-footer">
        {/* Left Side: Deactivation Controls */}
        <div className="action-group-vertical">
          <div className="action-group-horizontal">
            <button type="button" 
              className={`touch-button ${isConfirmingAction ? 'button-confirm-state' : ''}`}
              onClick={handleStatusToggle} 
            >
              {vessel?.is_active 
                ? (isConfirmingAction ? 'Confirm Deactivation' : 'Deactivate Vessel')
                : (isConfirmingAction ? 'Confirm Reactivation' : 'Reactivate Vessel')
              }
            </button>
            <span className="large-icon">{vessel?.is_active ? '⌧' : '⌗'}</span>
          </div>
          {/* Safety timer bar injects here right under the Deactivate button */}
          {isConfirmingAction && (
            <div className="interlock-timer-container" style={{ marginTop: '10px' }}>
              <span className="timer-label">⧖ Safety Interlock:</span>
              <div className="timer-bar-frame">
                <div className="timer-bar-fill animate-shrink-long"></div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Save Controls */}
        <button type="button" className="touch-button action-submit-button" disabled={!isFormValid} onClick={handleSubmit}>
          {vessel?.uuid ? 'Update' : 'Register'}
        </button>
      </div>

      {/* Fixed-Height Status Banner */}
      {(error || success) && (
        <div className="tab-banner-container">
          {error && <div className="tab-banner error">{error}</div>}
          {success && <div className="tab-banner success">{success}</div>}
        </div>
      )}
    </div>
  );
}

export default VesselEdit;
