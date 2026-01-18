import { useState } from 'react';
import config from '@shared/config.js';

function Login ({ onLoginSuccess }) {
  const [formData, setFormData] = useState({
    userHandle: '', 
    userPassword: ''
  });
  
  const [status, setStatus] = useState({ type: '', message: '' });
  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });
    
    try {
      const res = await fetch(`/api/login`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Success; Save the token
        localStorage.setItem('muirgen_token', data.token);
        
        setStatus({ type: 'success', message: 'ACCESS GRANTED' });
        setTimeout(() => {
          onLoginSuccess();
        }, 2000);
      } else {
        setStatus({ type: 'error', message: data.error || 'ACCESS DENIED' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Access Failed. Unknown API Error.' });
    }
  };
  
  return (
    <div className="vessel-box login-mode">
      <h2 className="flicker">Operator Authentication</h2>
      <br />
      
      {status.message && (
        <div className={`status-display ${status.type}`}>
          {status.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="login-form">
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">&#9722;</span>
            <label htmlFor="userPassword">
              <span className="label-text">Handle</span>
            </label>
          </div>
          <input type="text" 
            id="userHandle"
            required 
            autoFocus 
            autoComplete="off"
            value={formData.userHandle}
            onChange={e => setFormData({...formData, userHandle: e.target.value})}
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

        <div className="button-group">
          <button type="submit" className="touch-button" disabled={status.type === 'success'}>
            Login
          </button>
        </div>
      </form>
    </div>
  );
}

export default Login;
