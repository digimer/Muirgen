import { useState, useEffect } from 'react';
import config from '@shared/config.js';

function UserSetup({ onComplete }) {
  const [shakeField, setShakeField] = useState(null);
  const [formData, setFormData] = useState({
    userHandle: '',
    userName: '',
    userPassword: '',
    userPasswordConfirm: '',
    userIsAdmin: false,
    userVesselUuid: ''
  });
  
  const [status, setStatus] = useState({ type: '', message: '' });
  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });
    
    // Password validation
    if (formData.userPassword !== formData.userPasswordConfirm) {
      setStatus({ type: 'error', message: "Security: Access Code Mismatch" });
      setShakeField('userPasswordConfirm');
      setTimeout(() => setShakeField(null), 1000);
      
      return;
    }
    
    if(!formData.userVesselUuid) {
      // trigger the pulse
      setShakeField('vessel');
      setStatus({ type: 'error', message: "Vessel Assignment Required!" });
      // Clear the animation after it finishes.(0.3s * 3 == .9s / 900ms)
      setTimeout(() => setShakeField(null), 1000);
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
          userIsAdmin: formData.userIsAdmin, 
          userVesselUuid: formData.userVesselUuid
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
  
  // We will auto-select the user's vessel if there is only one active vessel. If there are two or more, show
  // a select box.
  const [vessels, setVessels] = useState([]);
  const [selectedVessel, setSelectedVessel] = useState('');
  useEffect(() => {
    // Get active vessels
    fetch('/api/vessels/get-active')
      .then(res => res.json())
      .then(data => {
        setVessels(data);
        if (data.length === 1) {
          const singleUuid = data[0].uuid;
          setSelectedVessel(singleUuid);
          // Store the UUID for the form to use
          setFormData(prev => ({ ...prev, userVesselUuid: singleUuid }));
        }
      })
  }, []);

  return (
    <div className="vessel-box setup-mode">
      <h2 className="flicker">Security: User Registration</h2>
      <br />
      
      {status.message && (
        <div style={{
          /* On succes, use it's black text on a red background.
             On failure, use red text on a black background. */
          color: status.type === 'success' ? 'black' : 'var(--neon-red)',
          backgroundColor: status.type === 'success' ? 'var(--neon-red)' : 'transparent', 
          border: `2px solid var(--neon-red)`, 
          padding: '15px', 
          marginBottom: '20px', 
          fontWeight: '900', 
          textTransform: 'uppercase'
        }}>
          {status.message}
        </div>
      )}
      
      {/* "Operator Handle (username) field */}
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
        {/* Full (real) name of the user */}
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
        {/* "Access Code" (password) field */}
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
        {/* Access code verification field */}
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">&#9722;</span>
            <label htmlFor="userPasswordConfirm">
              <span className="label-text">Repeat AC</span>
            </label>
          </div>
          <input type="password" 
            id="userPasswordConfirm"
            className={shakeField === 'userPasswordConfirm' ? 'field-error-shake' : ''}
            required 
            autoComplete="off"
            value={formData.userPasswordConfirm} 
            onChange={e => setFormData({...formData, userPasswordConfirm: e.target.value})} 
          />
        </div>
        {/* Vessel selection (either displayed if only one, or select box if 2+ */}
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">&#9722;</span>
            <label htmlFor="userVessel">
              <span className="label-text">Vessel Assignment</span>
            </label>
          </div>
        
          {vessels.length > 1 ? (
            <select 
              id="userVessel" 
              className={`setup-input-select ${shakeField === 'vessel' ? 'field-error-shake' : ''}`}
              value={selectedVessel} 
              onChange={(e) => {
                setSelectedVessel(e.target.value);
                setFormData({...formData, userVesselUuid: e.target.value});
              }}
            >
              <option value="" disabled>&#9659; Vessel Assignment</option>
              {vessels.map((v) => (
                <option key={v.uuid} value={v.uuid}>{v.name}</option>
              ))}
            </select>
          ) : (
            <div className="setup-field-value-static">
              {vessels[0]?.name || 'E: NAME LOAD FAILED'}
            </div>
          )}
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
        {/* The submit button */}
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
