/* 
 * Allows for the editing of existing users. It allows editing the general data about the user,
 * with special handling of changing 'is_active' to true/false via action buttons.
 */

import React, { useState, useEffect } from 'react';
import { apiFetch } from './utils/api.js';
import { useLocalStorageState } from './utils/hooks.js';
// import EntityMedia from './EntityMedia.jsx';
// import EntityNotes from './EntityNotes.jsx';

const UserEdit = ({ user, onComplete, activeCount, activeVessel, vessels }) => {
  const [formData, setFormData] = useState({
    userHandle: user?.handle || '',
    userName: user?.name || '',
    userIsAdmin: user?.is_admin || false,
    userVesselUuid: activeVessel?.uuid || user?.vessel_uuid || 'Unassigned' 
  });
  
  // Isolated state for the password modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordData, setPasswordData]               = useState({
    newPassword: '',
    currentPasswordConfirm: ''
  });
  const [error, setError]                             = useState(null);
  const [activeTab, setActiveTab]                     = useLocalStorageState('user_edit_active_tab', 'profile');
  const [isConfirmingAction, setIsConfirmingAction]   = useState(false);

  // Determine permissions context
  const activeSessionUuid = localStorage.getItem('muirgen_user_uuid');
  const isSelf = user?.uuid === activeSessionUuid;

  // Save the user's data
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    // Only process the password if the modal window is actively open
    if (isPasswordModalOpen && isSelf && !passwordData.currentPasswordConfirm) {
      setError('Security: Current Access Code Required');
      return;
    }
    try {
      const requestBody = {
        ...formData,
        userIsActive: true
      };

      // Only attach password fields if the user actually opened the modal to update them
      if (isPasswordModalOpen && passwordData.newPassword) {
         requestBody.userPassword        = passwordData.newPassword;
         requestBody.userCurrentPassword = passwordData.currentPasswordConfirm;
      }

      // We maintain the /update endpoint for modifications
      const url = user?.uuid ? `/api/users/${user.uuid}/update` : '/api/users/create';
      const res = await apiFetch(url, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      
      if (res.ok) {
        onComplete();
      } else {
        const data = await res.json();
        setError(data.error || 'Update Failed; comms error?');
      }
    } catch (err) {
      setError(`Database Link Failure. Error: [${err.message}]`);
    }
  }

  const handleStatusToggle = async () => {
    if (!isConfirmingAction) {
      setIsConfirmingAction(true);
      return;
    }
    try {
      const res = await apiFetch(`/api/users/${user.uuid}/delete`, { method: 'POST' });
      if (res.ok) {
        setIsConfirmingAction(false);
        onComplete();
      } else {
        const data = await res.json();
        setError(data.error || 'Deactivation Failed: Unknown error.');
      }
    } catch (err) {
      setError(`Operator Update failed. Error: [${err.message}]`);
    }
  }

  // Prevent an SysOp from locking themselves out. Another SysOp needs to exist and demote a user to enable 
  // this. 
  const isFormValid     = (formData.userHandle?.trim?.() ?? '') !== '' && (formData.userName?.trim?.() ?? '') !== '';
  const isLastActive    = formData.userIsAdmin && activeCount <= 1;
  const isLockoutActive = user?.is_active && (isLastActive || isSelf);
  let lockoutMessage    = null;
  if (isLockoutActive) {
      if (isSelf) lockoutMessage = "Locked; No self-revoke";
      else lockoutMessage = "Locked; SysOp Required";
  }
  
  return (
    <div className="setup-mode">
      {error && <div className="status-display error">{error}</div>}
      <div className="tab-bar">
        <div className={`tab-pair ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
          <span className="tab-icon glyph-specifications">⍾</span>
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
      {activeTab === 'profile' && (
        <form className="setup-form" onSubmit={handleSubmit}>
          
          <div className="field-group">
            <div className="setup-field-header">
              <span className="cursor-prompt">◺</span>
              <label htmlFor="userHandle"><span className="label-text">Handle</span></label>
            </div>
            <input type="text" id="userHandle" value={formData.userHandle} onChange={(e) => setFormData({ ...formData, userHandle: e.target.value })} required />
          </div>
          <div className="field-group">
             <div className="setup-field-header">
              <span className="cursor-prompt">◺</span>
              <label htmlFor="userName"><span className="label-text">Operator Name</span></label>
             </div>
             <input type="text" id="userName" value={formData.userName} onChange={(e) => setFormData({ ...formData, userName: e.target.value })} required />
          </div>
          <div className="field-group">
             <div className="setup-field-header">
               <span className="cursor-prompt">◺</span>
               <label htmlFor="userVesselUuid"><span className="label-text">Assigned Vessel</span></label>
             </div>
            {vessels && vessels.length > 1 ? (
               <select 
                 id="userVesselUuid" 
                 value={formData.userVesselUuid} 
                 onChange={(e) => setFormData({ ...formData, userVesselUuid: e.target.value })}
                 className="retro-select"
               >
                 {vessels.map(v => (
                   <option key={v.uuid} value={v.uuid}>{v.name}</option>
                 ))}
               </select>
             ) : (
               <>
                 <input type="text" id="userVesselUuid" value={formData.userVesselUuid} disabled className="disabled-input" />
                 <span className="soft-text operator-subtitles">Single Vessel; Auto-Assigned</span>
               </>
             )}
          </div>
          
          <div className="field-group" style={{ marginTop: '10px' }}>
            <label className="checkbox-container">
              <span className="label-text" style={{ color: 'var(--neon-green)' }}>Grant SysOp</span>
              <input type="checkbox" checked={formData.userIsAdmin} onChange={(e) => setFormData({ ...formData, userIsAdmin: e.target.checked })} disabled={isSelf} />
              <span className="retro-checkmark"></span>
            </label>
          </div>
          
          {/* Security Credentials Block */}
          <div className="field-group" style={{ marginTop: '20px', borderTop: '1px solid var(--mid-red)', paddingTop: '20px' }}>
            {!isPasswordModalOpen ? (
               <button type="button" className="touch-button" onClick={() => setIsPasswordModalOpen(true)}>
                 Update Access Code
               </button>
            ) : (
              <div className="security-modal-inline">
                 <h4 className="flicker-subtle" style={{ margin: '0 0 10px 0', color: 'var(--neon-red)'}}>Security Override</h4>
                 
                 <div className="field-group">
                   <label>New Access Code</label>
                   <input type="password" value={passwordData.newPassword} onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})} placeholder="<secret>" />
                   <span className="soft-text operator-subtitles">Blank: Unchanged</span>
                 </div>
                 
                 {isSelf && (
                   <div className="field-group security-verify">
                     <label style={{color: 'var(--neon-red)'}}>Current AC</label>
                     <input type="password" value={passwordData.currentPasswordConfirm} onChange={e => setPasswordData({...passwordData, currentPasswordConfirm: e.target.value})} placeholder="<Current AC Required>" />
                   </div>
                 )}
                 <button type="button" className="touch-button" onClick={() => { setIsPasswordModalOpen(false); setPasswordData({newPassword: '', currentPasswordConfirm: ''}); }}>
                   Abort
                 </button>
              </div>
            )}
          </div>

          {/* The action row */}
          <div className="action-bar-container" style={{ marginTop: '30px' }}>
            {user?.uuid && user?.is_active && (
              <div className="action-group-vertical">
                <div className="action-group-horizontal">
                  <button type="button" 
                    className={`touch-button ${isConfirmingAction ? 'button-confirm-state' : ''}`}
                    onClick={handleStatusToggle} 
                    disabled={isLockoutActive}
                  >
                    {isConfirmingAction ? 'Confirm' : 'Deactivate'}
                  </button>
                  
                </div>
                {isLockoutActive && (
                  <span className='soft-text operator-subtitles' style={{ marginLeft: 0, marginTop: '8px' }}>
                    {lockoutMessage}
                  </span>
                )}
              </div>
            )}
            
            <div style={{ flex: 1 }}></div>
            <span className="large-icon">⌧</span>
            <button type="submit" className="touch-button" disabled={!isFormValid}>
              {user?.uuid ? 'Update' : 'Register'}
            </button>
          </div>
        </form>
      )}

      {/* Placeholder Tabs */}
      {activeTab === 'optics' && (
        <div style={{ padding: '20px', color: 'var(--neon-red)' }}>Optics (Offline)</div>
      )}
      {activeTab === 'data' && (
        <div style={{ padding: '20px', color: 'var(--neon-red)' }}>Data (Offline)</div>
      )}
      {activeTab === 'logs' && (
        <div style={{ padding: '20px', color: 'var(--neon-red)' }}>Logs (Offline)</div>
      )}
    </div>
  );
}

export default UserEdit;