import React, { useState, useEffect } from 'react';
import { apiFetch } from './utils/api.js';
import { useLocalStorageState, useSystemStatus } from './utils/hooks.js';
import EntityMedia from './EntityMedia.jsx';
import EntityNotes from './EntityNotes.jsx';

const BatteryEdit = ({ battery, activeVessel, onCancel, onComplete, onSaveSuccess, jumpToNoteId }) => {
  const { triggerHddLed } = useSystemStatus();
  
  const [formData, setFormData] = useState({
    name:            battery?.name            || '',
    make:            battery?.make            || '',
    model:           battery?.model           || '',
    serial_number:   battery?.serial_number   || '',
    nominal_voltage: battery?.nominal_voltage || '',
    capacity:        battery?.capacity        || '',
    last_capacity:   battery?.last_capacity   || '',
    chemistry:       battery?.chemistry       || 'LiFePO4',
    vessel_uuid:     battery?.vessel_uuid     || activeVessel?.uuid
  });

  const [error, setError]                           = useState(null);
  const [saveMessage, setSaveMessage]               = useState(null);
  const [activeTab, setActiveTab]                   = useLocalStorageState('battery_edit_active_tab', 'profile');
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);

  useEffect(() => {
    if (jumpToNoteId === 'optics') {
      setActiveTab('optics');
    } else if (jumpToNoteId) {
      setActiveTab('logs');
    }
  }, [jumpToNoteId, setActiveTab]);

  useEffect(() => {
    const handleKeyUp = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape' && onCancel) onCancel();
    };
    window.addEventListener('keyup', handleKeyUp);
    return () => window.removeEventListener('keyup', handleKeyUp);
  }, [onCancel]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    try {
      const requestBody = { ...formData, is_active: true };
      const url         = battery?.uuid ? `/api/batteries/${battery.uuid}/update` : '/api/batteries/create';
      
      const res = await apiFetch(url, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      
      if (res.ok) {
        const data = await res.json();
        triggerHddLed(250);
        setSaveMessage('Battery Profile Saved.');
        setTimeout(() => setSaveMessage(null), 6000);
        
        if (onSaveSuccess) onSaveSuccess(data.uuid || battery?.uuid);
      } else {
        const data = await res.json();
        setError(data.error || 'Update Failed; comms error?');
      }
    } catch (err) {
      setError(`Database Link Failure. Error: [${err.message}]`);
    }
  };

  const handleStatusToggle = async () => {
    if (!isConfirmingAction) {
      setIsConfirmingAction(true);
      return;
    }
    try {
      const res = await apiFetch(`/api/batteries/${battery.uuid}/delete`, { method: 'POST' });
      if (res.ok) {
        setIsConfirmingAction(false);
        onComplete();
      } else {
        const data = await res.json();
        setError(data.error || 'Deactivation Failed: Unknown error.');
      }
    } catch (err) {
      setError(`Battery Update failed. Error: [${err.message}]`);
    }
  };

  const isFormValid = formData.name.trim() !== '' && formData.nominal_voltage !== '' && formData.capacity !== '';

  const batteryCategories = [
    'Record::Maintenance',
    'Record::Inspection',
    'Record::Replacement',
    'Note::General',
    'Log::Degradation'
  ];

  return (
    <div className="setup-mode panel-viewport">
      <div className="task-header-wrapper">
        <h2 className="flicker">VSM // {battery?.uuid ? 'BATTERIES' : 'REGISTER'} // [{activeTab.toUpperCase()}]</h2>
      </div>

      <div className="tab-bar">
        <div className={`tab-pair ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
          <span className="tab-icon glyph-specifications">⧲</span>
          <button type="button" className="tab-button">Profile</button>
        </div>
        <div className={`tab-pair ${activeTab === 'optics' ? 'active' : ''}`} onClick={() => setActiveTab('optics')}>
          <span className="tab-icon glyph-optics">⏿</span>
          <button type="button" className="tab-button">Optics</button>
        </div>
        <div className={`tab-pair ${activeTab === 'data' ? 'active' : ''}`} onClick={() => setActiveTab('data')}>
          <span className="tab-icon glyph-data">⌖</span>
          <button type="button" className="tab-button">Data</button>
        </div>
        <div className={`tab-pair ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
          <span className="tab-icon glyph-logs">⧉</span>
          <button type="button" className="tab-button">Logs</button>
        </div>
      </div>

      <div className="panel-body">
        {activeTab === 'profile' && (
          <form className="setup-form" onSubmit={handleSubmit}>
            <div className="field-group">
              <div className="setup-field-header">
                <span className="cursor-prompt">◺</span>
                <label>Battery Name</label>
              </div>
              <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Descriptive Name" required />
            </div>
            
            <div className="field-group">
              <div className="setup-field-header">
                <span className="cursor-prompt">◺</span>
                <label>Chemistry</label>
              </div>
              <input type="text" value={formData.chemistry} onChange={e => setFormData({ ...formData, chemistry: e.target.value })} required />
            </div>

            <div className="field-group">
              <div className="setup-field-header">
                <span className="cursor-prompt">◺</span>
                <label>Make</label>
              </div>
              <input type="text" value={formData.make} onChange={e => setFormData({ ...formData, make: e.target.value })} placeholder="Pack or BMS" required />
            </div>

            <div className="field-group">
              <div className="setup-field-header">
                <span className="cursor-prompt">◺</span>
                <label>Model</label>
              </div>
              <input type="text" value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })} required />
            </div>
            
            <div className="field-group">
              <div className="setup-field-header">
                <span className="cursor-prompt">◺</span>
                <label>Serial Number</label>
              </div>
              <input type="text" value={formData.serial_number} onChange={e => setFormData({ ...formData, serial_number: e.target.value })} placeholder="Optional" />
            </div>

            <div className="field-group">
              <div className="setup-field-header">
                <span className="cursor-prompt">◺</span>
                <label>Nominal Voltage</label>
              </div>
              <input type="number" step="0.1" value={formData.nominal_voltage} onChange={e => setFormData({ ...formData, nominal_voltage: e.target.value })} placeholder="VDC" required />
            </div>
            
            <div className="field-group">
              <div className="setup-field-header">
                <span className="cursor-prompt">◺</span>
                <label>Label Capacity</label>
              </div>
              <input type="number" step="0.1" value={formData.capacity} onBlur={e => {
                const newCap = e.target.value;
                setFormData(prev => ({
                  ...prev,
                  capacity: newCap, 
                  // Set last_capacity to match if empty
                  last_capacity: prev.last_capacity === '' ? newCap : prev.last_capacity
                }))
              }} placeholder="Ah" required />
            </div>

            <div className="field-group">
              <div className="setup-field-header">
                <span className="cursor-prompt">◺</span>
                <label>Last Tested Capacity</label>
              </div>
              <input type="number" step="0.1" value={formData.last_capacity} onChange={e => setFormData({ ...formData, last_capacity: e.target.value })} required />
            </div>
          </form>
        )}

        {activeTab === 'optics' && (
          <EntityMedia entityId={battery?.uuid} referenceTable="batteries" mode="image" />
        )}
        {activeTab === 'data' && (
          <EntityMedia entityId={battery?.uuid} referenceTable="batteries" mode="file" />
        )}
        {activeTab === 'logs' && (
          <EntityNotes 
            entityId={battery?.uuid} 
            referenceTable="batteries" 
            allowedCategories={batteryCategories} 
            deepLinkNoteId={jumpToNoteId} 
            onExitEdit={(noteId) => { if (onCancel) onCancel(noteId); }}
          />
        )}
      </div>

      <div className="panel-footer">
        {battery?.uuid && battery?.is_active ? (
          <div className="action-group-vertical">
            <div className="action-group-horizontal">
              <button type="button" 
                className={`touch-button ${isConfirmingAction ? 'button-confirm-state' : ''}`}
                onClick={handleStatusToggle} 
              >
                {isConfirmingAction ? 'Confirm' : 'Deactivate'}
              </button>
              <span className="large-icon">⌧</span>
            </div>
          </div>
        ) : (
          <div></div>
        )}
        
        <button type="button" className="touch-button action-submit-button" disabled={!isFormValid} onClick={handleSubmit}>
          {battery?.uuid ? 'Update' : 'Register'}
        </button>
      </div>

      <div className="tab-banner-container">
        {error && <div className="tab-banner error">{error}</div>}
        {saveMessage && <div className="tab-banner success">{saveMessage}</div>}
      </div>
    </div>
  );
}

export default BatteryEdit;
