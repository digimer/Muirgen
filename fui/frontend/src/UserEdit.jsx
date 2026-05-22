/* 
 * Allows for the editing of existing users. It allows editing the general data about the user,
 * with special handling of changing 'is_active' to true/false via action buttons.
 */

import React, { useState, useEffect } from 'react';
import { apiFetch } from './utils/api.js';
import { useLocalStorageState, useSystemStatus } from './utils/hooks.js';
import EntityMedia from './EntityMedia.jsx';
import EntityNotes from './EntityNotes.jsx';

const UserEdit = ({ user, onCancel, onComplete, onSaveSuccess, activeCount, activeVessel, vessels, jumpToNoteId }) => {
  const { triggerHddLed }       = useSystemStatus();
  const [formData, setFormData] = useState({
    handle:       user?.handle      || '',
    name:         user?.name        || '',
    is_admin:     user?.is_admin    || false,
    vesssel_uuid: user?.vessel_uuid || activeVessel?.uuid || 'Unassigned' 
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    currentPasswordConfirm: '',
    existingPasswordVerification: ''
  });
  const [error, setError]                           = useState(null);
  const [saveMessage, setSaveMessage]               = useState(null);
  const [activeTab, setActiveTab]                   = useLocalStorageState('user_edit_active_tab', 'profile');
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);

  // Determine permissions context
  const activeSessionUuid = localStorage.getItem('muirgen_user_uuid');
  const isSelf            = user?.uuid === activeSessionUuid;
  
  // Intercept the tab routing if we are deep-linking to a note. We only want this to run once when the
  // component initially mounts!
  useEffect(() => {
    if (jumpToNoteId === 'optics') {
      setActiveTab('optics');
    } else if (jumpToNoteId) {
       setActiveTab('logs');
    }
  }, [jumpToNoteId,]); // activeTab is deliberately missing so it doesn't loop

  // Handle [Esc] to cancel/close
  useEffect(() => {
    const handleKeyUp = (e) => {
      // Don't override if the user is actively typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        if (onCancel) onCancel();
      }
    };
    
    window.addEventListener('keyup', handleKeyUp);
    return () => window.removeEventListener('keyup', handleKeyUp);
  }, [onCancel]);

  // Save the user's data
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    try {
      const requestBody = {
        ...formData,
        is_active: true
      };

      // Password handling
      if (!user?.uuid) {
        // New User, they have to set their new Access Code
        if (!passwordData.newPassword || !passwordData.currentPasswordConfirm) {
           setError('Security: Access Code and Confirmation Required');
           return;
        }
        if (passwordData.newPassword !== passwordData.currentPasswordConfirm) {
           setError('Security: Access Codes do not match');
           return;
        }
        requestBody.password        = passwordData.newPassword;
        requestBody.password_confirm = passwordData.currentPasswordConfirm;
      } else {
        // Existing User: Did they attempt to type a new password?
        if (passwordData.newPassword) {
          if (passwordData.newPassword !== passwordData.currentPasswordConfirm) {
            setError('Security: New Access Codes do not match');
            return;
          }
          // Did they pass along their current password?
          if (isSelf && !passwordData.existingPasswordVerification) {
            setError('Security: Current Access Code Required to change credentials');
            return;
          }
          // Attach the payload strings needed by the backend
          requestBody.password         = passwordData.newPassword;
          requestBody.current_password = passwordData.existingPasswordVerification;
        }
      }

      // We maintain the /update endpoint for modifications
      const url = user?.uuid ? `/api/users/${user.uuid}/update` : '/api/users/create';
      const res = await apiFetch(url, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      
      if (res.ok) {
        const data = await res.json();
        
        // Fire the global context indicator!
        triggerHddLed(250); // Short pulse instead of the 500ms default
        
        // Show the success ribbon locally
        setSaveMessage('Operator Profile Saved.');
        setTimeout(() => setSaveMessage(null), 6000);
        
        // Tell App.jsx it worked, so it can give us an active UUID if we're a new user
        if (onSaveSuccess) onSaveSuccess(data.uuid || user?.uuid);
        
        // Blank out the password fields so they don't submit again
        setPasswordData({
          newPassword: '',
          currentPasswordConfirm: '',
          existingPasswordVerification: ''
        });
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
  const isFormValid     = (formData.handle?.trim?.() ?? '') !== '' && (formData.name?.trim?.() ?? '') !== '';
  const isLastActive    = formData.is_admin && activeCount <= 1;
  const isLockoutActive = user?.is_active && (isLastActive || isSelf);
  let lockoutMessage    = null;
  if (isLockoutActive) {
      if (isSelf) lockoutMessage = "Locked; No self-revoke";
      else lockoutMessage = "Locked; SysOp Required";
  }

  // Allowed note categories for user profiles
  const userCategories = [
    'Record::Admin',
    'Record::Concern',
    'Record::Background',
    'Record::Medical',
    'Record::Performance',
    'Note::General',
    'Log::Personal'
  ];

  return (
    <div className="setup-mode panel-viewport">
      <div className="task-header-wrapper">
        <h2 className="flicker">VSM // {user?.uuid ? 'OPERATORS' : 'REGISTER'} // [{activeTab.toUpperCase()}]</h2>
      </div>

      {/* The navigation bar */}
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
                <label htmlFor="handle"><span className="label-text">Handle</span></label>
              </div>
              <input type="text" id="handle" value={formData.handle} onChange={(e) => setFormData({ ...formData, handle: e.target.value })} required />
            </div>
            <div className="field-group">
              <div className="setup-field-header">
                <span className="cursor-prompt">◺</span>
                <label htmlFor="name"><span className="label-text">Operator Name</span></label>
              </div>
              <input type="text" id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="field-group">
              <div className="setup-field-header">
                <span className="cursor-prompt">◺</span>
                <label htmlFor="vesssel_uuid"><span className="label-text">Assigned Vessel</span></label>
              </div>
              {vessels && vessels.length > 1 ? (
                <select 
                  id="vesssel_uuid" 
                  value={formData.vesssel_uuid} 
                  onChange={(e) => setFormData({ ...formData, vesssel_uuid: e.target.value })}
                  className="setup-input-select"
                >
                  {vessels.map(v => (
                    <option key={v.uuid} value={v.uuid}>{v.name}</option>
                  ))}
                </select>
              ) : (
                <>
                  <input type="text" id="vesssel_uuid" value={formData.vesssel_uuid} disabled className="disabled-input" />
                  <span className="soft-text operator-subtitles">Single Vessel; Auto-Assigned</span>
                </>
              )}
            </div>
            
            <div className="field-group">
              <div className="setup-field-header checkbox-sysop">
                <span className="cursor-prompt">◺</span>
                <label>Spacer</label> 
              </div>
              
              {/* The actual checkbox container */}
              <div style={{ marginTop: '8px' }}>
                <label className="checkbox-container">
                  <span className="label-text strong-text">Grant SysOp</span>
                  <input type="checkbox" checked={formData.is_admin} onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })} disabled={isSelf} />
                  <span className="retro-checkmark"></span>
                </label>
              </div>
              {isSelf && <span className="soft-text operator-subtitles sysop-lockout-warning">Locked; No self-demote</span>}
            </div>
            
            {/* Security Credentials Block */}
            <div className="field-group">
              <div className="setup-field-header">
                <span className="cursor-prompt">◺</span>
                <label>{user?.uuid ? 'New Access Code' : 'Access Code'}</label>
              </div>
              <input type="password" value={passwordData.newPassword} onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})} placeholder="<secret>" required={!user?.uuid} />
              {user?.uuid && <span className="soft-text operator-subtitles">Blank: No Change</span>}
            </div>
            
            <div className="field-group">
              <div className="setup-field-header">
                <span className="cursor-prompt">◺</span>
                <label>Confirm AC</label>
              </div>
              <input type="password" value={passwordData.currentPasswordConfirm} onChange={e => setPasswordData({...passwordData, currentPasswordConfirm: e.target.value})} placeholder="<verify secret>" required={!user?.uuid || !!passwordData.newPassword} />
            </div>
            
            {/* Only prompt for the current password if the user is editing their own existing profile */}
            {user?.uuid && isSelf ? (
              <div className="field-group">
                <div className="setup-field-header">
                  <span className="cursor-prompt">◺</span>
                  <label>Current AC</label>
                </div>
                <input type="password" value={passwordData.existingPasswordVerification} onChange={e => setPasswordData({...passwordData, existingPasswordVerification: e.target.value})} placeholder="<required for change>" required={!!passwordData.newPassword} />
              </div>
            ) : (
              /* Render an empty div to maintain the two-column grid balance if the third field shouldn't exist */
              <div className="field-group"></div>
            )}

          </form>
        )}

        {/* Optics (images) tab */}
        {activeTab === 'optics' && (
          <EntityMedia entityId={user?.uuid} referenceTable="users" mode="image" />
        )}
        {/* Data (files) tab */}
        {activeTab === 'data' && (
          <EntityMedia entityId={user?.uuid} referenceTable="users" mode="file" />
        )}
        {/* Logs (notes) tab */}
        {activeTab === 'logs' && (
          <EntityNotes 
            entityId={user?.uuid} 
            referenceTable="users" 
            allowedCategories={userCategories} 
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
        {user?.uuid && user?.is_active ? (
          <div className="action-group-vertical">
            <div className="action-group-horizontal">
              <button type="button" 
                className={`touch-button ${isConfirmingAction ? 'button-confirm-state' : ''}`}
                onClick={handleStatusToggle} 
                disabled={isLockoutActive}
              >
                {isConfirmingAction ? 'Confirm' : 'Deactivate'}
              </button>
              <span className="large-icon">⌧</span>
            </div>
            {isLockoutActive && (
              <span className="soft-text operator-subtitles action-lockout-text">
                {lockoutMessage}
              </span>
            )}
          </div>
        ) : (
          <div></div> /* Empty div to push the Update button to the right */
        )}
        
        {/* Right Side: Save Controls */}
        <button type="button" className="touch-button action-submit-button" disabled={!isFormValid} onClick={handleSubmit}>
          {user?.uuid ? 'Update' : 'Register'}
        </button>
      </div>

      {/* Fixed-Height Status Banner */}
      <div className="tab-banner-container">
        {error && <div className="tab-banner error">{error}</div>}
        {saveMessage && <div className="tab-banner success">{saveMessage}</div>}
      </div>
    </div>
  );
}

export default UserEdit;