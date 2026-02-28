import { useState } from 'react';

// TODO: Now that the user must be linked to a vessel, we need to re-order the creation, and add the vessel 
//       selection to the UserSetup.jsx

const Login = ({ onLoginSuccess }) => {
  const [formData, setFormData] = useState({
    userHandle: '', 
    userPassword: ''
  });
  
  const [status, setStatus] = useState({ type: '', message: '' });
  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });
    
    try {
      const res = await fetch(`/api/auth/login`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Success; Save the token
        localStorage.setItem('muirgen_token', data.token);
        
        setStatus({ type: 'success', message: 'Access Granted, Establishing Connection.' });
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
  
  // Enable the submit button when all fields have data.
  const isFormValid = 
    (formData.userHandle?.trim?.()   ?? '') !== '' && 
    (formData.userPassword?.trim?.() ?? '') !== '';
  
  return (
    <>
      {status.message && (
        <div className={`status-display ${status.type}`}>
          {status.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="login-form login-mode">
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">◺</span>
            <label htmlFor="userHandle">
              <span className="label-text">Handle</span>
            </label>
          </div>
          <input type="text" 
            id="userHandle"
            required 
            autoFocus 
            value={formData.userHandle}
            onChange={e => setFormData({...formData, userHandle: e.target.value})}
          />
        </div>

        <div className="field-group">
           <div className="setup-field-header">
            <span className="cursor-prompt">◺</span>
            <label htmlFor="userPassword">
              <span className="label-text">Access Code</span>
            </label>
          </div>
          <input type="password" 
            id="userPassword"
            required 
            value={formData.userPassword}
            onChange={e => setFormData({...formData, userPassword: e.target.value})}
          />
        </div>
        
        {/* Wrapper to match the vertical footprint of the other groups */}
        <div className="login-button-wrap">
          <div className="setup-field-header">
            <span className="label-text" style={{ visibility: 'hidden' }}>Spacer</span>
          </div>
          <button type="submit" className={`button-icon login-button-adjust ${isFormValid ? 'button-confirm-ready' : ''}`} disabled={!isFormValid}>
            {status.type === 'success' ? "Validating..." : "Login"}
          </button>
        </div>
      </form>
    </>
  );
}

export default Login;
