import { useState, useEffect, useRef } from 'react';
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
  // We need to make sure that isLoggingOut always reflects the current value, and isn't cached.
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isLoggingOutRef = useRef(false);
  
  // Handle Logging the user out
  const handleLogout = () => {
    // blurs the screen during the logout confirmation
    setIsLoggingOut(true);
    isLoggingOutRef.current = true;
    
    // Clear the token immediately
    localStorage.removeItem('muirgen_token');
    
    // Show the hang-up message for 2 seconds. 
    setTimeout(() => {
      setIsLoggedIn(false);
      setVessel(null);
      // unblur for the next session
      setIsLoggingOut(false);
      isLoggingOutRef.current = false;
    }, 2000);
  }

  const fetchData = async () => {
    // If we're logging out, return, don't do anything else.
    if (isLoggingOutRef.current) return;
    
    const savedToken = localStorage.getItem('muirgen_token');
    
    // Backup check to see if we're logging out.
    if (!savedToken && isLoggingOut)
    {
      return;
    }
    
    // Check if we've got a saved token
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
      
      // If, for some reason, the setup is required but a stale token remains, delete it.
      if (initData.userRequired || initData.vesselRequired) {
        if (localStorage.getItem('muirgen_token')) {
          localStorage.removeItem('muirgen_token');
        }
        setIsLoggedIn(false);
      } else if (!isLoggingOutRef.current) {
        setIsLoggedIn(initData.isLoggedIn);
      }
      
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
      
      {/* sky-ground walking grid background. Blurred during log-out */}
      <div className={`grid-container ${isLoggingOut ? 'blur-active' : ''}`}>
        <div className="wireframe-grid sky" />
        <div className="wireframe-grid ground" />
      </div>

      <main className="main-layout">
        {/* To make sure the success message remains visible during the 2s logout sequence, this needs to be
            the top priority. */}
        {isLoggingOut && (
          <div className="status-display success logout-overlay">
            Carrier Disconnected, Session Closed
          </div>
        )}
        
        {/* Main body */}
        <div className={`content-container ${isLoggingOut? 'blur-active' : ''}`}>
          <h2 className="flicker">Core Database: {dbData.status}</h2>
          {setupState.vesselRequired ? (
            <VesselSetup onComplete={fetchData} />
          ) : setupState.userRequired ? (
            <UserSetup onComplete={fetchData} />
          ) : !isLoggedIn ? (
            <Login onLoginSuccess={() => {
              setIsLoggedIn(true);
              fetchData();
            }} />
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
        
        {/* System Controls */}
        {isLoggedIn && !isLoggingOut && (
          <div className="system-controls">
            <button onClick={handleLogout} className="logout-button">
              <span className="glyph">&#9708;</span>
              <span className="label-text">End Session</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
