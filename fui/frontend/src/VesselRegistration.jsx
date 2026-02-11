import React, {useState} from 'react';
import { apiFetch} from './utils/api.js';

const VesselRegistration = ({ onComplete, onCancel }) => {
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
      {error && <div className="status-display error">{error}</div>}
      <h3 className="flicker-subtle">⏃ Register New Vessel</h3>
      <form className="setup-form" onSubmit={handleSubmit}>
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
            onChange={(e) => setFormData({...formData, vesselName: e.target.value})}
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
            onChange={(e) => setFormData({...formData, vesselOfficialNumber: e.target.value})}
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
            onChange={(e) => setFormData({...formData, vesselFlagNation: e.target.value})}
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
            onChange={(e) => setFormData({...formData, vesselPortOfRegistry: e.target.value})}
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
            onChange={(e) => setFormData({...formData, vesselBuildDetails: e.target.value})}
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
            required 
            value={formData.vesselHullIdentificationNumber} 
            onChange={(e) => setFormData({...formData, vesselHullIdentificationNumber: e.target.value})}
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
            onChange={(e) => setFormData({...formData, vesselKeelOffset: parseInt(e.target.value) || 0})} 
            required 
          />
          <span className="soft-text operator-subtitles">Transducer to bottom of keel</span>
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
            step="1" 
            inputMode="decimal"
            value={formData.vesselWaterlineOffset} 
            onChange={(e) => setFormData({...formData, vesselWaterlineOffset: parseInt(e.target.value) || 0})} 
            required 
          />
          <span className="soft-text operator-subtitles">Transducer to waterline</span>
        </div>
        <div className="button-row">
          <button type="button" className="button-icon" onClick={onCancel}>Abort</button>
          <button type="submit" className={`button-icon ${isFormValid ? 'button-confirm-ready' : ''}`} disabled={!isFormValid}>
            Register Vessel
          </button>
        </div>
      </form>
    </>
  );
}

export default VesselRegistration;
