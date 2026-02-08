import { useState, useEffect, useRef } from 'react';
import useInterval from './useInterval'; // Import our new hook
import config from '@shared/config.js';
import './App.css';
import VesselSetup from './VesselSetup'; 
import UserSetup from './UserSetup';
import Login from './Login';
import { apiFetch } from './utils/api.js';
import Sidebar from './Sidebar';
import VesselManagement from './VesselManagement';

function App() {
  // Remember where the user was in case the browser reloads. 
  // HUD               - Default display
  // VESSEL_MANAGEMENT - Vessel Management view,
  // USER_MANAGEMENT   - User Management view.
  const [activeView, setActiveView] = useState('HUD');
  const [allVessels, setAllVessels] = useState([]);
  const API_URL = config.apiBaseUrl;
  const [currentUser, setCurrentUser] = useState(null);
  const [displayTime, setDisplayTime] = useState('Acquiring Time Source...');
  const [dbData, setDbData] = useState({ status: 'Connecting...', serverTime: '' });
  // We need to make sure that isLoggingOut always reflects the current value, and isn't cached.
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isLoggingOutRef = useRef(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState('Carrier dropped, session closed');
  const [setupState, setSetupState] = useState({userRequired: false, vesselRequired: false });
  const [vessel, setVessel] = useState(null);
  
  // Drift in browsers can be an issue, so we'll update the react time with the DB time every 30 seconds.
  useInterval(() => {
    syncServerTime();
  }, 30000);
  
  // Local tick to update the displayed time each second.
  useInterval(() => {
    if (dbData.serverTime) {
      const now = new Date();
      // Format the date/time to YYY-MM-DD HH:MM:SS
      setDisplayTime(now.toLocaleString('sv-SE'));
    }
  }, 1000);
  
  // 
  const syncServerTime = async () => {
    try {
      const res = await fetch('/api/system/get-time');
      const data = await res.json();
      setDbData(data);
    } catch (err) {
      setDbData(prev => ({ ...prev, status: 'Time Source Offline' }));
    }
  };
  
  // If there's a last used view for the user (if they're logged in), load it.
  useEffect (() => {
    if (isLoggedIn &&  currentUser?.userUuid) {
      const userKey = `muirgen_view_${currentUser.userUuid}`;
      const savedView = localStorage.getItem(userKey);
      if (savedView) setActiveView(savedView);
    }
  }, [isLoggedIn, currentUser?.userUuid]);
  
  // Record the active user's current view.
  useEffect(() => {
    if (isLoggedIn && currentUser?.userUuid) {
      localStorage.setItem(`muirgen_view_${currentUser.userUuid}`, activeView);
    }
  }, [activeView, isLoggedIn, currentUser?.userUuid]);
  
  // Watch for 401 or 403 errors indicating a bad token and triggering a logout.
  useEffect(() => {
    const handleAuthFailure = (event) => {
      // Set the specific error message from api.js
      setLogoutMessage(event.detail.message);
      
      // Trigger the same visual sequence as handleLogout
      setIsLoggingOut(true);
      isLoggingOutRef.current = true;
      
      setTimeout(() => {
        setIsLoggedIn(false);
        setVessel(null);
        setIsLoggingOut(false);
        isLoggingOutRef.current = false;
        // Reset the message for the next use.
        setLogoutMessage('Carrier dropped, session closed');
      }, 3000); // Longer detail for easier debugging in case of invalid ejection trigger.
    };
    
    window.addEventListener('muirgen-auth-failure', handleAuthFailure);
    return () => window.removeEventListener('muirgen-auth-failure', handleAuthFailure);
  }, []);
  
  useEffect(() => {
    if (activeView === 'VESSEL_MANAGEMENT') {
      fetchManagementData();
    }
  }, [activeView]);
  
  // Fetch all vessels for management
  const fetchManagementData = async () => {
    try {
      const res = await apiFetch('/api/vessels/list-all');
      if (res.ok) {
        const data = await res.json();
        setAllVessels(data);
      }
    } catch (err) {
      console.error('Management fetch error:', err);
    }
  };
  
  // Deactivate a vessel
  const handleVesselDeactivate = async (uuid) => {
    const res = await apiFetch(`/api/vessels/deactivate/${uuid}`, { method: 'DELETE' });
    if (res.ok) fetchManagementData();
  };
  
  //Reactivate a vessel
  const handleVesselReactivation = async (uuid) => {
    const res = await apiFetch(`/api/vessels/reactivate/${uuid}`, { method: 'PATCH' });
    if (res.ok) fetchManagementData();
  };
  
  // Handle Logging the user out
  const handleLogout = async () => {
    // blurs the screen during the logout confirmation
    setIsLoggingOut(true);
    isLoggingOutRef.current = true;
    
    // Reset the HUD as the default display for the next user/session.
    setActiveView('HUD');
    
    // Log the logout.
    const logPromise = apiFetch('/api/users/logout', { method: 'POST' }).catch(err => {
      console.warn("Entering a log in audit_log appears to have failed:", err);
    });
    
    // Show the hang-up message for 2 seconds. 
    setTimeout(() => {
      // Clear the token locally
      localStorage.removeItem('muirgen_token');
      setIsLoggedIn(false);
      setVessel(null);
      // unblur for the next session
      setIsLoggingOut(false);
      isLoggingOutRef.current = false;
    }, 2000);
    
    await logPromise;
  }

  const fetchData = async () => {
    // If we're logging out, return, don't do anything else.
    if (isLoggingOutRef.current) return;
    
    const savedToken = localStorage.getItem('muirgen_token');
    
    // Backup check to see if we're logging out.
    if (!savedToken && isLoggingOut) return;
    
    // Check if we've got a saved token
    try {
      const [statusRes, initRes] = await Promise.all([
        fetch(`/api/system/get-time`),
        apiFetch(`/api/system/check-init`)
      ]);
      
      const statusData = await statusRes.json();
      const initData = await initRes.json();

      // Map the identity from the JWT to state
      if(initData.isLoggedIn && initData .user) {
        setCurrentUser(initData.user); // Should have the user's UUID and handle.
      } else {
        setCurrentUser(null);
      }
      
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
        const vesselRes = await apiFetch(`/api/vessels/get-vessel`);
        // prevents crashing on vesselRed.json() if the token was nuked.
        if (!vesselRes) { return; }
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
        {/* Navigation Sidebar */}
        {isLoggedIn && !isLoggingOut && (
          <Sidebar activeView={activeView} setActiveView={setActiveView} />
        )}
        
        {/* Dynamic Viewport */}
        <div className={`content-viewport ${isLoggingOut ? 'blur-active' : ''}`}>
          {/* Success message must stay inside the viewport to be visible during logout. */}
          {isLoggingOut && (
            <div className="status-display success logout-overlay">
              {logoutMessage}
            </div>
          )}
          
          {/* Persistent Telemetry Data */}
          <div className="telemetry-header">
            <div className="telemetry-item">
              <span className="dim-text">System Time //</span> {displayTime}
            </div>
            <div className="telemetry-item">
              <span className="dim-text">Database //</span>
              <span className={dbData.status === 'Online' ? 'neon-text' : 'danger-text'}>
                {dbData.status.toUpperCase()}
              </span>
            </div>
            {/* Future placeholder for GPS lat/lon. */}
            <div className="telemetry-item">
              <span className="dim-text">Position //</span> ◭ NO SAT LOCK ◮
            </div>
          </div>
          
          <h2 className="flicker">Core Database: {dbData.status}</h2>
          {setupState.vesselRequired ? (
            <VesselSetup onComplete={fetchData} />
          ) : setupState.userRequired ? (
            <UserSetup onComplete={fetchData} />
          ) : !isLoggedIn ? (
            <Login onLoginSuccess={() => { setIsLoggedIn(true); fetchData();}} />
          ) : (
            <>
              {activeView === 'HUD' && vessel && (
                <div className="vessel-box">
                  <p>Date/Time: {dbData.serverTime || 'Loading...'}</p>
                  <p>Vessel Name: {vessel.vesselName || 'Loading'}</p>
                  <p>Flag Nation: {vessel.vesselFlagNation || 'Loading...'}</p>
                  <p>Home Port: {vessel.vesselPortOfRegistry || 'Loading...'}</p>
                  <p>Build Details: {vessel.vesselBuildDetails || 'Loading...'}</p>
                  <p>Official Number: {vessel.vesselOfficialNumber || 'Loading...'}</p>
                  <p>Hull ID Number: {vessel.vesselHullIdentificationNumber || 'Loading...'}</p>
                  <p>Database UUID: {vessel.vesselUuid || 'Loading...'}</p>
                </div>
              )}
              
              {activeView === 'VESSEL_MANAGEMENT' && (
                <VesselManagement
                  vessels={allVessels}
                  onDeactivate={handleVesselDeactivate}
                  onReactivate={handleVesselReactivation}
                  onModify={(v) => console.log("Modify", v)}
                  onRegister={() => console.log("Register New")}
                />
              )}
            </>
         )}
        </div>
        
        {/* Persustent "End Session" button. (May move to the sidebar later) */}
        {isLoggedIn && !isLoggingOut && (
          <div className="system-controls">
            <button onClick={handleLogout} className="logout-button">
              <span className="glyph">🞪</span>
              <span className="label-text">End Session</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
