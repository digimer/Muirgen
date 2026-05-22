import { useState, useEffect } from 'react';

const UserSetup = ({ onComplete }) => {
  const [shakeField, setShakeField] = useState(null);
  const [formData, setFormData] = useState({
    handle: '',
    name: '',
    password: '',
    password_confirm: '',
    is_admin: false,
    vesssel_uuid: ''
  });
  
  const [status, setStatus] = useState({ type: '', message: '' });
  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });
    
    // Password validation
    if (formData.password !== formData.password_confirm) {
      setStatus({ type: 'error', message: "Security: Access Code Mismatch" });
      setShakeField('password_confirm');
      setTimeout(() => setShakeField(null), 1000);
      
      return;
    }
    
    if(!formData.vesssel_uuid) {
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
      const res = await fetch(`/api/users/sysop-init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: formData.handle, 
          name: formData.name, 
          password: formData.password, 
          password_confirm: formData.password_confirm, 
          vesssel_uuid: formData.vesssel_uuid
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
  // NOTE: 'fetch' is used intentionally, don't use 'apiFetch'.
  const [isFirstUser, setIsFirstUser] = useState(false);
  useEffect(() => {
    fetch(`/api/auth/session-sync`)
      .then(res => res.json())
      .then(data => {
        if (data.userRequired) {
          setIsFirstUser(true);
          setFormData(prev => ({ ...prev, is_admin: true}));
        }
      });
  }, []);
  
  // We will auto-select the user's vessel if there is only one active vessel. If there are two or more, show
  // a select box.
  const [vessels, setVessels] = useState([]);
  const [selectedVessel, setSelectedVessel] = useState('');
  useEffect(() => {
    // Get active vessels
    fetch('/api/vessels/active')
      .then(res => res.json())
      .then(data => {
        setVessels(data);
        if (data.length === 1) {
          const singleUuid = data[0].uuid;
          setSelectedVessel(singleUuid);
          // Store the UUID for the form to use
          setFormData(prev => ({ ...prev, vesssel_uuid: singleUuid }));
        }
      })
  }, []);
  
  // Enable the submit button when all fields have data.
  const isFormValid = 
    (formData.handle?.trim?.()          ?? '') !== '' && 
    (formData.name?.trim?.()            ?? '') !== '' && 
    (formData.password?.trim?.()        ?? '') !== '' && 
    (formData.password_confirm?.trim?.() ?? '') !== '' && 
    (formData.vesssel_uuid?.trim?.()      ?? '') !== '';

  return (
    <>
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
      
      {/* "Operator Handle (name) field */}
      <form onSubmit={handleSubmit} className="setup-form setup-mode">
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">◺</span>
            <label htmlFor="handle">
              <span className="label-text">Operator Handle</span>
            </label>
          </div>
          <input type="text" 
            id="handle"
            required 
            autoComplete="off"
            value={formData.handle} 
            onChange={e => setFormData({...formData, handle: e.target.value})} 
          />
        </div>
        {/* Full (real) name of the user */}
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">◺</span>
            <label htmlFor="name">
              <span className="label-text">Full Name</span>
            </label>
          </div>
          <input type="text" 
            id="name"
            required 
            autoComplete="off"
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})} 
          />
        </div>
        {/* "Access Code" (password) field */}
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">◺</span>
            <label htmlFor="password">
              <span className="label-text">Access Code</span>
            </label>
          </div>
          <input type="password" 
            id="password"
            required 
            autoComplete="off"
            value={formData.password} 
            onChange={e => setFormData({...formData, password: e.target.value})} 
          />
        </div>
        {/* Access code verification field */}
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">◺</span>
            <label htmlFor="password_confirm">
              <span className="label-text">Repeat AC</span>
            </label>
          </div>
          <input type="password" 
            id="password_confirm"
            className={shakeField === 'password_confirm' ? 'field-error-shake' : ''}
            required 
            autoComplete="off"
            value={formData.password_confirm} 
            onChange={e => setFormData({...formData, password_confirm: e.target.value})} 
          />
        </div>
        {/* Vessel selection (either displayed if only one, or select box if 2+ */}
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">◺</span>
            {/* Use a label only if there are 2+ vessels and a <select> is used. */}
            {vessels.length > 1 ? (
              <label htmlFor="userVessel">
                <span className="label-text">Vessel Assignment</span>
              </label>
            ) : (
              <span className="label-text">Vessel Assignment</span>
            )}
          </div>
        
          {vessels.length > 1 ? (
            <select 
              id="userVessel"
              className={`setup-input-select ${shakeField === 'vessel' ? 'field-error-shake' : ''}`}
              value={selectedVessel} 
              onChange={(e) => {
                setSelectedVessel(e.target.value);
                setFormData({...formData, vesssel_uuid: e.target.value});
              }}
            >
              <option value="" disabled>▻ Vessel Assignment</option>
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
              <span className="glyph">◺</span>
              <div>
                <span className="label-text">Administrator</span>
                <div className="operator-subtitle">
                  (Operator 1)
                </div>
              </div>
            </div>
            <input type="checkbox" 
              checked={formData.is_admin} 
              disabled={isFirstUser} // Disabled if this is the first user
              onChange={e => setFormData({...formData, is_admin: e.target.checked})} />
            <span className="retro-checkmark"></span>
          </label>
        </div>
        {/* The submit button */}
        <div className="button-row">
          <button type="submit" className={`button-icon ${isFormValid ? 'button-confirm-ready' : ''}`} disabled={!isFormValid}>
            {status.type === 'success' ? "Recording..." : "Register SysOp"}
          </button>
        </div>
      </form>
    </>
  );
}

export default UserSetup;
