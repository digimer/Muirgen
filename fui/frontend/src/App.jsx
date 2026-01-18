import { useState, useEffect } from 'react';
import useInterval from './useInterval'; // Import our new hook
import config from '@shared/config.js';
import './App.css';
import VesselSetup from './VesselSetup'; 
import UserSetup from './UserSetup';
import Login from './Login';

function App() {
  const [dbData, setDbData] = useState({ status: 'Connecting...', serverTime: '' });
  const [vessel, setVessel] = useState(null);
  const [setupState, setSetupState] = useState({userRequired: false, vesselRequired: false });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const API_URL = config.apiBaseUrl;

  const fetchData = async () => {
    // Check if we've got a saved token
    const savedToken = localStorage.getItem('muirgen_token');
    try {
      const [statusRes, initRes] = await Promise.all([
        fetch(`/api/test-db`),
        fetch(`/api/check-init`, {
          // Attach the token.
          headers: {
            'Authorization': savedToken ? `Bearer ${savedToken}` : ''
          }
        })
      ]);
      
      const statusData = await statusRes.json();
      const initData = await initRes.json();

      setDbData(statusData);
      setSetupState(initData);
      
      // Should return 'isLoggedIn: true' if the token is valid.
      setIsLoggedIn(initData.isLoggedIn);
      
      // Get vessel data if the user is logged in.
      if (!initData.userRequired && !initData.vesselRequired && initData.isLoggedIn) {
        const vesselRes = await fetch(`/api/get-vessel`);
        const vesselData = await vesselRes.json();
        setVessel(vesselData);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  // Initial load
  useEffect(() => { fetchData(); }, []);

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
          {setupState.userRequired ? (
            <UserSetup onComplete={fetchData} />
          ) : setupState.vesselRequired ? (
            <VesselSetup onComplete={fetchData} />
          ) : !isLoggedIn ? (
            <Login onLoginSuccess={() => setIsLoggedIn(true)} />
          ) : !vessel ? (
            <h2 className="flicker">Establishing Database Connection...</h2>
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
