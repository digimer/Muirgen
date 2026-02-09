import React, {useState} from 'react';
import { apiFetch} from './utils/api.js';

const VesselRegistration = ({ onComplete, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    flag_nation: '',
    port_of_registry: '',
    build_details: '',
    official_number: '',
    hull_id_number: '',
    keel_offset_cm: 0,
    waterline_offset_cm: 0
  });
  const [error, setError] = useState(null);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await apiFetch('/api/vessels/register', {
        method: 'POST', 
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        onComplete();
      } else {
        const data = await res.json();
        setError(data.error || 'Registration Failed; Unknown Error');
      }
    } catch (err) {
      setError(`Database Link Failure: [${err.message}]`);
    }
  }
  
  return (
    <>
      {error && <div className="status-display error">{error}</div>}
      <form className="setup-form" onSubmit={handleSubmit}>
        <div className="field-group">
          <label>Vessel Name</label>
          <input 
            type="text" 
            required 
            value={formData.name} 
            onChange={(e) => setFormData({...formData, name: e.target.value})}
          />
        </div>
        <div className="field-group">
          <label>Hull ID Number</label>
          <input 
            type="text" 
            required 
            value={formData.hull_id_number} 
            onChange={(e) => setFormData({...formData, hull_id_number: e.target.value})}
          />
        </div>
        <div className="field-group">
          <label>Keel Offset</label>
          <input 
            type="number" 
            step="1" 
            value={formData.keel_offset_cm} 
            onChange={(e) => setFormData({...formData, keel_offset_cm: parseInt(e.target.value) || 0})} 
          />
          <span className="soft-text operator-subtitles">// Transducer to bottom of keel in cm.</span>
        </div>
        <div className="field-group">
          <label>Waterline Offset</label>
          <input 
            type="number" 
            step="1" 
            value={formData.waterline_offset_cm} 
            onChange={(e) => setFormData({...formData, waterline_offset_cm: parseInt(e.target.value) || 0})} 
          />
          <span className="soft-text operator-subtitles">// Transducer to waterline in cm.</span>
        </div>
        <div className="button-row">
          <button type="button" className="button-icon" onClick={onCancel}>◹ Abort</button>
          <button type="submit" className="button-icon">⏃ Record</button>
        </div>
      </form>
    </>
  );
}

export default vesselRegistration;
