import { useState } from 'react';
        
const VesselSetup = ({ onComplete }) => {
  const [formData, setFormData] = useState({
    vesselName: '', 
    vesselOfficialNumber: '', 
    vesselFlagNation: '',
    vesselPortOfRegistry: '',
    vesselBuildDetails: '',
    vesselHullIdentificationNumber: '', 
    vesselKeelOffset: 0, 
    vesselWaterlineOffset: 0
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
    (formData.vesselName?.trim?.()                     ?? '') !== '' && 
    (formData.vesselOfficialNumber?.trim?.()           ?? '') !== '' && 
    (formData.vesselFlagNation?.trim?.()               ?? '') !== '' && 
    (formData.vesselPortOfRegistry?.trim?.()           ?? '') !== '' && 
    (formData.vesselBuildDetails?.trim?.()             ?? '') !== '' && 
    (formData.vesselHullIdentificationNumber?.trim?.() ?? '') !== '' && 
    formData.vesselKeelOffset                                 !== 0  && 
    formData.vesselWaterlineOffset                            !== 0;
 
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
            <label htmlFor="vesselName">
              <span className="label-text">Vessel Name</span>
            </label>
          </div>
          <input type="text"
            id="vesselName"
            autoComplete="off"
            value={formData.vesselName} 
            onChange={e => setFormData({...formData, vesselName: e.target.value})} 
            required 
          />
        </div>
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">◺</span>
            <label htmlFor="vesselOfficialNumber">
              <span className="label-text">Official Number</span>
            </label>
          </div>
          <input type="text" 
            id="vesselOfficialNumber"
            autoComplete="off"
            value={formData.vesselOfficialNumber} 
            onChange={e => setFormData({...formData, vesselOfficialNumber: e.target.value})} 
            required 
          />
        </div>
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">◺</span>
            <label htmlFor="vesselFlagNation">
              <span className="label-text">Flag Nation</span>
            </label>
          </div>
          <input type="text" 
            id="vesselFlagNation"
            autoComplete="off"
            value={formData.vesselFlagNation} 
            onChange={e => setFormData({...formData, vesselFlagNation: e.target.value})} 
            required 
          />
        </div>
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">◺</span>
            <label htmlFor="vesselPortOfRegistry">
              <span className="label-text">Port of Registry</span>
            </label>
          </div>
          <input type="text" 
            id="vesselPortOfRegistry"
            autoComplete="off"
            value={formData.vesselPortOfRegistry} 
            onChange={e => setFormData({...formData, vesselPortOfRegistry: e.target.value})} 
            required 
          />
        </div>
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">◺</span>
            <label htmlFor="vesselBuildDetails">
              <span className="label-text">Build Details</span>
            </label>
          </div>
          <input type="text" 
            id="vesselBuildDetails"
            autoComplete="off"
            value={formData.vesselBuildDetails} 
            onChange={e => setFormData({...formData, vesselBuildDetails: e.target.value})} 
            required 
          />
        </div>
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">◺</span>
            <label htmlFor="vesselHullIdentificationNumber">
              <span className="label-text">Hull ID Number</span>
            </label>
          </div>
          <input type="text" 
            id="vesselHullIdentificationNumber"
            autoComplete="off"
            value={formData.vesselHullIdentificationNumber} 
            onChange={e => setFormData({...formData, vesselHullIdentificationNumber: e.target.value})} 
            required 
          />
        </div>
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">◺</span>
            <label htmlFor="vesselKeelOffset">
              <span className="label-text">Keel Offset (cm)</span>
            </label>
          </div>
          <input type="number" 
            id="vesselKeelOffset"
            autoComplete="off"
            step="1" 
            inputMode="decimal"
            value={formData.vesselKeelOffset} 
            onChange={e => setFormData({ ...formData, vesselKeelOffset: parseInt(e.target.value) || 0 })} 
            required 
          />
        </div>
        <div className="field-group">
          <div className="setup-field-header">
            <span className="cursor-prompt">◺</span>
            <label htmlFor="vesselWaterlineOffset">
              <span className="label-text">Waterline Offset (cm)</span>
            </label>
          </div>
          <input type="number" 
            id="vesselWaterlineOffset"
            autoComplete="off"
            step="1" 
            inputMode="decimal"
            value={formData.vesselWaterlineOffset} 
            onChange={e => setFormData({ ...formData, vesselWaterlineOffset: parseInt(e.target.value) || 0 })} 
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
