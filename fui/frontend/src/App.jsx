import { useState, useEffect } from 'react';
import useInterval from './useInterval'; // Import our new hook
import './App.css';
import VesselSetup from './VesselSetup'; 

function App() {
  const [dbData, setDbData] = useState({ status: 'Connecting...', serverTime: '' });
  const [vessel, setVessel] = useState(null);

  const fetchData = async () => {
    try {
      const [statusRes, vesselRes] = await Promise.all([
        fetch('http://mr-scifi-ui:5000/api/test-db'),
        fetch('http://mr-scifi-ui:5000/api/get-vessel')
      ]);
      
      const statusData = await statusRes.json();
      const vesselData = await vesselRes.json();

      setDbData(statusData);
      setVessel(vesselData);
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  // 1. Initial load
  useEffect(() => { fetchData(); }, []);

  // 2. Poll every 1000ms (1 second)
  useInterval(fetchData, 1000);
  
  if (!vessel) {
    return (
      <div className="main-layout">
        <div className="crt-overlay" />
        <h2 className="flicker">Booting...</h2>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="crt-overlay" />
      
      {/* dual grid background. */}
      <div className="grid-container">
        <div className="wireframe-grid sky" />
        <div className="wireframe-grid ground" />
      </div>

      {/* The main container now handles centering */}
      <main className="main-layout">
        <div className="content-container">
          <h2 className="flicker">Core Database: {dbData.status}</h2>
          {vessel.setupRequired ? (
            <VesselSetup onComplete={fetchData} />
          ) : (
          
            <div className="vessel-box">
              <p>Date/Time: {dbData.serverTime || 'Loading...'}</p>
              <p>Vessel Name: {vessel.vesselName || 'Loading...'}</p>
              <p>Flag Nation: {vessel.vesselFlagNation || 'Loading...'}</p>
              <p>Home Port: {vessel.vesselPortOfRegistry || 'Loading...'}</p>
              <p>Build Details: {vessel.vesselBuildDetails || 'Loading...'}</p>
              <p>Official Number: {vessel.vesselOfficialNumber || 'Loading...'}</p>
              <p>Hull ID Number: {vessel.vesselHullIdentificationNumber || 'Loading...'}</p>
              <p>Database UUID: {vessel.vesselUuid || 'Loading...'}</p>
              
            </div>
         )}
        </div>
      </main>
    </div>
  );
}

export default App;

