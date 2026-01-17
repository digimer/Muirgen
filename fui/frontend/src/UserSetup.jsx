import { useState, useEffect } from 'react';

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
      const res = await fetch('http://mr-scifi-ui:5000/api/save-user', {
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
        setTimeout(() => { onComplete(); }, 2000);
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
    fetch('http://mr-scifi-ui:5000/api/check-init')
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
          <label>Operator Handle</label>
          <input type="text" required 
            value={formData.userHandle} 
            onChange={e => setFormData({...formData, userHandle: e.target.value})} 
          />
        </div>
        <div className="field-group">
          <label>Full Name</label>
          <input type="text" required 
            value={formData.userName} 
            onChange={e => setFormData({...formData, userName: e.target.value})} 
          />
        </div>
        <div className="field-group">
          <label>Access Code</label>
          <input type="password" required 
            value={formData.userPassword} 
            onChange={e => setFormData({...formData, userPassword: e.target.value})} 
          />
        </div>
        <div className="field-group">
          <label>Re-enter AC</label>
          <input type="password" 
            required 
            value={formData.userPasswordConfirm} 
            onChange={e => setFormData({...formData, userPasswordConfirm: e.target.value})} 
          />
        </div>
        {/* Checkbox for Admin Rights */}
        <div className="field-group checkbox-group">
          <label className={`checkbox-container ${isFirstUser ? 'disabled-logic' : ''}`}>
            Administrator {isFirstUser && "(Required For User 1)"}
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
