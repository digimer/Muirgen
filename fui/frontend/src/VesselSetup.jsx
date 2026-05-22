import { useState } from 'react';
        
const VesselSetup = ({ onComplete }) => {
  const [formData, setFormData] = useState({
    name: '', 
    official_number: '', 
    flag_nation: '',
    port_of_registry: '',
    build_details: '',
    hull_id_number: '', 
    keel_offset_cm: 0, 
    waterline_offset_cm: 0
  });
  
  const [status, setStatus] = useState({ type: '', message: '' });
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });
    
    // Read the token.
    const token = localStorage.getItem('muirgen_token');
    
    try {
      const res = await fetch(`/api/vessels/create`, {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        setStatus({ type: 'success', message: 'Vessel Recorded.' });
        setTimeout(() => { 
          setStatus({ type: '', message: '' }); // Reset status locally
          onComplete(); 
        }, 2000);
      } else {
        setStatus({ type: 'error', message: 'Vessel Registration Failed, Unknown Database Error.' });
      }
    } catch(err) {
      setStatus({ type: 'error', message: 'Vessel Registration Failed. Error.', err });
    }
  };
  
  // Enable the submit button when all fields have data.
  const isFormValid = 
    (formData.name?.trim?.()             ?? '') !== '' && 
    (formData.official_number?.trim?.()  ?? '') !== '' && 
    (formData.flag_nation?.trim?.()      ?? '') !== '' && 
    (formData.port_of_registry?.trim?.() ?? '') !== '' && 
    (formData.build_details?.trim?.()    ?? '') !== '' && 
    (formData.hull_id_number?.trim?.()   ?? '') !== '' && 
    formData.keel_offset_cm                     !== 0  && 
    formData.waterline_offset_cm                !== 0;
 
  return (
    <>
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
      
      <form onSubmit={handleSubmit} className="setup-form setup-mode">
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">◺</span>
            <label htmlFor="name">
              <span className="label-text">Vessel Name</span>
            </label>
          </div>
          <input type="text"
            id="name"
            autoComplete="off"
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})} 
            required 
          />
        </div>
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">◺</span>
            <label htmlFor="official_number">
              <span className="label-text">Official Number</span>
            </label>
          </div>
          <input type="text" 
            id="official_number"
            autoComplete="off"
            value={formData.official_number} 
            onChange={e => setFormData({...formData, official_number: e.target.value})} 
            required 
          />
        </div>
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">◺</span>
            <label htmlFor="flag_nation">
              <span className="label-text">Flag Nation</span>
            </label>
          </div>
          <input type="text" 
            id="flag_nation"
            autoComplete="off"
            value={formData.flag_nation} 
            onChange={e => setFormData({...formData, flag_nation: e.target.value})} 
            required 
          />
        </div>
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">◺</span>
            <label htmlFor="port_of_registry">
              <span className="label-text">Port of Registry</span>
            </label>
          </div>
          <input type="text" 
            id="port_of_registry"
            autoComplete="off"
            value={formData.port_of_registry} 
            onChange={e => setFormData({...formData, port_of_registry: e.target.value})} 
            required 
          />
        </div>
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">◺</span>
            <label htmlFor="build_details">
              <span className="label-text">Build Details</span>
            </label>
          </div>
          <input type="text" 
            id="build_details"
            autoComplete="off"
            value={formData.build_details} 
            onChange={e => setFormData({...formData, build_details: e.target.value})} 
            required 
          />
        </div>
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">◺</span>
            <label htmlFor="hull_id_number">
              <span className="label-text">Hull ID Number</span>
            </label>
          </div>
          <input type="text" 
            id="hull_id_number"
            autoComplete="off"
            value={formData.hull_id_number} 
            onChange={e => setFormData({...formData, hull_id_number: e.target.value})} 
            required 
          />
        </div>
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">◺</span>
            <label htmlFor="keel_offset_cm">
              <span className="label-text">Keel Offset (cm)</span>
            </label>
          </div>
          <input type="number" 
            id="keel_offset_cm"
            autoComplete="off"
            step="1" 
            inputMode="decimal"
            value={formData.keel_offset_cm} 
            onChange={e => setFormData({ ...formData, keel_offset_cm: parseInt(e.target.value) || 0 })} 
            required 
          />
        </div>
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">◺</span>
            <label htmlFor="waterline_offset_cm">
              <span className="label-text">Waterline Offset (cm)</span>
            </label>
          </div>
          <input type="number" 
            id="waterline_offset_cm"
            autoComplete="off"
            step="1" 
            inputMode="decimal"
            value={formData.waterline_offset_cm} 
            onChange={e => setFormData({ ...formData, waterline_offset_cm: parseInt(e.target.value) || 0 })} 
            required 
          />
        </div>
        <div className="button-row">
          <button type="submit" className={`button-icon ${isFormValid ? 'button-confirm-ready' : ''}`} disabled={!isFormValid}>
            {status.type === 'success' ? "Recording..." : "Register Vessel"}
          </button>
        </div>
      </form>
    </>
  );
}

export default VesselSetup;
