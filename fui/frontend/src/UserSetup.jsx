import { useState, useEffect } from 'react';
import config from '@shared/config.js';

function UserSetup({ onComplete }) {
  const [formData, setFormData] = useState({
    userHandle: '',
    userName: '',
    userPassword: '',
    userPasswordConfirm: '',
    userIsAdmin: false // Boolean for the checkbox
  });
  
  const [status, setStatus] = useState({ type: '', message: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });
    
    // Password validation
    if (formData.userPassword !== formData.userPasswordConfirm) {
      setStatus({ type: 'error', message: "Security: Password Mismatch" });
      return;
    }
    
    // Read the token.
    const token = localStorage.getItem('muirgen_token');
    
    try {
      const res = await fetch(`/api/save-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          userHandle: formData.userHandle, 
          userName: formData.userName, 
          userPassword: formData.userPassword, 
          userIsAdmin: formData.userIsAdmin
        })
      });
      
      if (res.ok) {
        setStatus({ type: 'success', message: 'Registration Successful.' });
        setTimeout(() => { 
          setStatus({ type: '', message: '' }); // Reset status locally
          onComplete(); 
        }, 2000);
      } else {
        const data = await res.json();
        setStatus({ type: 'error', message: data.error || "User Registration Failed, Unknown Database Error." });
      }
    } catch(err) {
      setStatus({ type: 'error', message: 'User Registration Failed. Unknown API Error.' });
    }
  };
  
  // Check if this is the first user. If so, 'is_admin' will be forced to true.
  const [isFirstUser, setIsFirstUser] = useState(false);
  useEffect(() => {
    fetch(`/api/check-init`)
      .then(res => res.json())
      .then(data => {
        if (data.userRequired) {
          setIsFirstUser(true);
          setFormData(prev => ({ ...prev, userIsAdmin: true}));
        }
      });
  }, []);

  return (
    <div className="vessel-box setup-mode">
      <h2 className="flicker">Security: User Registration</h2>
      <br />
      
      {status.message && (
        <div style={{
          color: 'black',
          backgroundColor: status.type === 'success' ? `var(--neon-red)` : 'transparent', 
          border: `2px solid var(--neon-red)`, 
          padding: '15px', 
          marginBottom: '20px', 
          fontWeight: '900', 
          textTransform: 'uppercase'
        }}>
          {status.message}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="setup-form">
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">&#9722;</span>
            <label htmlFor="userHandle">
              <span className="label-text">Operator Handle</span>
            </label>
          </div>
          <input type="text" 
            id="userHandle"
            required 
            autoComplete="off"
            value={formData.userHandle} 
            onChange={e => setFormData({...formData, userHandle: e.target.value})} 
          />
        </div>
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">&#9722;</span>
            <label htmlFor="userName">
              <span className="label-text">Full Name</span>
            </label>
          </div>
          <input type="text" 
            id="userName"
            required 
            autoComplete="off"
            value={formData.userName} 
            onChange={e => setFormData({...formData, userName: e.target.value})} 
          />
        </div>
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">&#9722;</span>
            <label htmlFor="userPassword">
              <span className="label-text">Access Code</span>
            </label>
          </div>
          <input type="password" 
            id="userPassword"
            required 
            autoComplete="off"
            value={formData.userPassword} 
            onChange={e => setFormData({...formData, userPassword: e.target.value})} 
          />
        </div>
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">&#9722;</span>
            <label htmlFor="userPasswordConfirm">
              <span className="label-text">Repeat AC</span>
            </label>
          </div>
          <input type="password" 
            id="userPasswordConfirm"
            required 
            autoComplete="off"
            value={formData.userPasswordConfirm} 
            onChange={e => setFormData({...formData, userPasswordConfirm: e.target.value})} 
          />
        </div>
        {/* Checkbox for Admin Rights */}
        <div className="field-group checkbox-group">
          <label className={`checkbox-container ${isFirstUser ? 'disabled-logic' : ''}`}>
          
            <div className="setup-field-header">
              <span className="glyph">&#9722;</span>
              <div>
                <span className="label-text">Administrator</span>
                <div className="operator-subtitle">
                  (Operator 1)
                </div>
              </div>
            </div>
            <input type="checkbox" 
              checked={formData.userIsAdmin} 
              disabled={isFirstUser} // Disabled if this is the first user
              onChange={e => setFormData({...formData, userIsAdmin: e.target.checked})} />
            <span className="retro-checkmark"></span>
          </label>
        </div>

        <div className="button-row">
          <button type="submit" 
            className="touch-button" 
            disabled={status.type === 'success'}>
            {status.type === 'success' ? "Recording..." : "Record User"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default UserSetup;
