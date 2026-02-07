import { useState, useEffect } from 'react';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [currentPasswordConfirm, setCurrentPasswordConfirm] = useState('');
  
  // Fetch all users on load.
  const fetchUsers = async () => {
    try {
      const res = await apiFetch('/api/users/list');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("API Error; User Manifest Not Loaded!");
    }
  };
  useEffect(() => { fetchUsers(); }, []);
  
  // Save changes
  const handleSave = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });
    
    const activeSessionUuid = localStorage.getItem('muirgen_user_uuid');
    const isSelf = editingUser.uuid === activeSessionUuid;
    
    // When saving the active user's account, extra checks are needed and disabling the account or admin 
    // status is disabled.
    if (isSelf) {
      if(!currentPasswordConfirm) {
        setStatus({ type: 'error', message: 'Current Password Required For Self-Update.' });
        return;
      }
      
      // We can't edit both the handle and password at the same time.
      const originalRecord = users.find(u => u.uuid === editingUser.uuid);
      
      // If the record exists, sanity check it
      if (originalRecord) {
        if ((editingUser.handle !== originalRecord.handle) && (editingUser.password)) {
          setStatus({ type: 'error', message: 'Change either the handle or the password, not both..' });
          return;
        }
      }
    }
    
    // Determine if we're updating (put) or inserting (post)
    const isUpdate = !!editingUser.uuid;
    const url = isUpdate ? `/api/users/update/${editingUser.uuid}` : '/api/users/save';
    const method = isUpdate ? 'PUT' : 'POST';
    const vesselUuid = users[0]?.vessel_uuid;
    
    try {
      const res = await apiFetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('muirgen_token')}`
        },
        body: JSON.stringify({
          userName: editingUser.name,
          userIsAdmin: editingUser.is_admin,
          userHandle: editingUser.handle,
          userPassword: editingUser.password, 
          userCurrentPassword: currentPasswordConfirm, 
          userVesselUuid: vesselUuid, 
          userIsActive: true
        })
      });
      
      if (res.ok) {
        setStatus({ type: 'success', message: 'Operator Record Updated' });
        fetchUsers(); // Refresh post save
        setEditingUser(null);
        setCurrentPasswordConfirm('');
      } else {
        const data = await res.json();
        setStatus({ type: 'error', message: `Operator Update Failed: ${data.error || 'Operator Update Failed: Line Noise?' }`});
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Backend Comms Error' });
    }
  };
  
  const handleDeactivate = async () => {
    if (!window.confirm(`Revoke access for ${editingUser.handle}?`)) return;
        
    try {
      const res = await apiFetch(`/api/users/delete/${editingUser.uuid}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('muirgen_token')}` }
      });
      
      if (res.ok) {
        setStatus({ type: 'success', message: 'Credentials Revoked' });
        fetchUsers();
        setEditingUser(null);
      } else {
        setStatus({ type: 'error', message: 'Revocation Failed!' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Backend Comms Error' });
    }
  };
  
  return(
    <div className="vessel-box setup-mode">
      <div className="setup-display">
        
        {/* Section 1: Operator Directory */}
        <div className="directory-column">
          <h3 className="flicker">Active SysOps</h3>
          <div className="user-list">
            {users.map(user => (
              <div
                key={user.uuid}
                className={`user-card ${editingUser?.uuid === user.uuid ? 'active-selection' : ''}`}
                onClick={() => {
                  setEditingUser(user);
                  setCurrentPasswordConfirm('');
                  setStatus({ type: '', message: '' });
                }}
              >
                <span className="glyph">{user.is_admin ? '◈': '🞜'}</span>
                <span className="label-text">{user.handle}</span>
                <span className="operator-subtitles">{user.name}</span>
              </div>
            )}
          </div>
          <button 
            className="touch-button" 
            style={{marginTop: '20px'}} 
            onClick={() => {
              setEditingUser({ handle: '', name: '', is_admin: false });
              setCurrentPasswordConfirm('');
              setStatus({ type: '', message: '' });
            }}
            >
            ◇ Add SysOp
          </button>
        </div>
        
        {/* Section 2: Edit/Create terminal */}
        <div className="terminal-column">
          {editingUser ? (
            <>
              <h3 className="flicker">Modify Operator</h3>
              <form className="setup-form" style={{display: 'block'}} onSubmit={handleSave}>
                
                <div className="field-group">
                  <label>Operator Handle</label>
                  <input 
                    value={editingUser.handle || ''} 
                    onChange={e => setEditingUser({...editingUser, handle: e.target.value })}
                    placeholder="<nick name>"
                  />
                </div>
                
                <div className="field-group">
                  <label>Full Name</label>
                  <input 
                    value={editingUser.name || ''}
                    onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                    placeholder="<Given/Chosen Name>"
                  />
                </div>
                
                <div className="field-group">
                  <label>New Access Code (Blank = Unchanged)</label>
                  <input 
                    type="password" 
                    value={editingUser.password || ''}
                    onChange={e => setEditingUser({...editingUser, password: e.target.value})}
                    placeholder="<secret>"
                  />
                </div>
                
                {/* Appears when the user is editing their own account */}
                {editingUser.uuid === localStorage.getItem('muirgen_user_uuid') && (
                  <div className="field-group security-verify">
                    <label style={{color: 'var(--neon-red)'}}>Confirm ID (Current Access Code)</label>
                      <input
                        type="password"
                        value={currentPasswordConfirm}
                        onChange={e => setCurrentPasswordConfirm(e.target.value)}
                        placeholder="<Current AC Required>"
                        required
                      />
                  </div>
                )}
                
                <div className="field-group">
                  <label>System Operator Level</label>
                  <label className="checkbox-container">
                    <span className="label-text">Administrator Level</span>
                    <input 
                      type="checkbox" 
                      checked={editingUser.is_admin || false} 
                      onChange={e => setEditingUser({...editingUser, is_admin: e.target.checked})}
                      disabled={isSelf}
                    />
                    <span className="retro-checkmark"></span>
                  </label>
                </div>
                
                <div className="button-row">
                  <button type="submit" className="touch-button">Update Records</button>
                  {editingUser.uuid && editingUser.uuid !== localStorage.getItem('muirgen_user_uuid') && (
                    <button type="button" className="touch-button danger" onClick={handleDeactivate} style={{marginLeft: '10px' }}>
                      Revoke
                    </button>
                  )}
                </div>
                {status.message && <p className={`status-text ${status.type}`}>{status.message}</p>}
              </form>
            </>
          ) : (
            <div className="setup-field-value-static" style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              Select Sytem Operator
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserManagement;
