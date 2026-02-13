import { useState, useEffect, useRef, useCallback } from 'react';
import useInterval from './useInterval';
import './App.css';
import VesselSetup from './VesselSetup'; 
import UserSetup from './UserSetup';
import Login from './Login';
import { apiFetch } from './utils/api.js';
import Sidebar from './Sidebar';
import VesselEdit from './VesselEdit';
import VesselManagement from './VesselManagement';
import VesselRegistration from './VesselRegistration';

function App() {
  // Remember where the user was in case the browser reloads. 
  const [activeView, setActiveView] = useState('VSM');  // VSM = Vessel Status Monitor
  const [allVessels, setAllVessels] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [displayTime, setDisplayTime] = useState('Acquiring Time Source...');
  const [dbData, setDbData] = useState({ status: 'Connecting...', serverTime: '' });
  const hasRestoredSession = useRef(false);
  // We need to make sure that isLoggingOut always reflects the current value, and isn't cached.
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isLoggingOutRef = useRef(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState('Carrier dropped, session closed');
  const [setupState, setSetupState] = useState({userRequired: false, vesselRequired: false });
  const [vessel, setVessel] = useState(null);
  const [viewContext, setViewContext] = useState(null);
  
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
      setDbData(prev => ({ ...prev, status: 'Time Source Offline. Error: ', err }));
    }
  };
  
  // Drift in browsers can be an issue, so we'll update the react time with the DB time every 30 seconds.
  useInterval(() => {
    syncServerTime();
  }, 30000);
  
  // If there's a last used view for the user (if they're logged in), load it.
  useEffect(() => {
    // Identify the operator, if they're logged in.
    const id = currentUser?.uuid || localStorage.getItem('muirgen_user_uuid');
    
    if (!id) {
      console.warn('Persistence: No user ID found.');
      return;
    }
    
    // Build the storage key from their ID.
    const storageKey = `muirgen_view_${id}`;
    const contextKey = `muirgen_view_context_${id}`;
    
    // Restore logic; Run only once.
    // Only attempt restore if we haven't yet and the current view is VSM.
    if (!hasRestoredSession.current) {
      const savedView = localStorage.getItem(storageKey);
      
      if (savedView && savedView !== 'VSM') {
        console.log(`Persistence: Restoring: [${savedView}] for operator: [${id}]`);
        setActiveView(savedView);

        // Load any context for this view;
        const savedContext = localStorage.getItem(contextKey);
        if (savedContext) {
          try {
            setViewContext(JSON.parse(savedContext));
          } catch (err) {
            console.warn("Persistence: Failed to parse the saved context! The error was: ", err);
          }
        }
        hasRestoredSession.current = true;
        // Exit early so we don't immediately resave 'VSM'
        return;
      }
      hasRestoredSession.current = true;
    }
    
    // If the user is logged in and changes the view, save it.
    if (isLoggedIn && !isLoggingOutRef.current) {
      console.log(`Persistence: Recording: [${activeView}] to: [${storageKey}]`);

      // Save the view
      localStorage.setItem(storageKey, activeView);

      // Save the context, if there is any.
      if (viewContext) {
        localStorage.setItem(contextKey, JSON.stringify(viewContext));
      } else {
        localStorage.removeItem(contextKey);
      }
    }
  }, [activeView, currentUser, isLoggedIn, viewContext]);
  
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
  
  // Fetch all vessels for management
  const fetchManagementData = useCallback(async () => {
    try {
      const res = await apiFetch('/api/vessels/list-all');
      if (res.ok) {
        const data = await res.json();
        setAllVessels(data);
      }
    } catch (err) {
      console.error('Management fetch error:', err);
    }
  }, []);
  
  useEffect(() => {
    if (activeView === 'VESSEL_MANAGEMENT' || activeView === 'VESSEL_EDIT') {
      fetchManagementData();
    }
  }, [activeView, fetchManagementData]);
  
  // Handle Logging the user out
  const handleLogout = async () => {
    // blurs the screen during the logout confirmation
    setIsLoggingOut(true);
    isLoggingOutRef.current = true;
    
    // Log the logout.
    const logPromise = apiFetch('/api/users/logout', { method: 'POST' }).catch(err => {
      console.warn("Entering a log in audit_log appears to have failed:", err);
    });
    
    // Show the hang-up message for 2 seconds. 
    setTimeout(() => {
      // Clear the token locally
      localStorage.removeItem('muirgen_user_uuid');
      localStorage.removeItem('muirgen_token');
      setIsLoggedIn(false);
      setVessel(null);
      
      // Reset the VSM as the default display for the next user/session.
      setActiveView('VSM');
      
      // unblur for the next session
      setIsLoggingOut(false);
      isLoggingOutRef.current = false;
    }, 2000);
    
    await logPromise;
  }

  const fetchData = useCallback(async () => {
    // If we're logging out, return, don't do anything else.
    if (isLoggingOutRef.current) return;
    
    const savedToken = localStorage.getItem('muirgen_token');
    
    // Backup check to see if we're logging out.
    if (!savedToken && isLoggingOut) return;
    
    // Check if we've got a saved token
    try {
      const [statusRes, syncRes] = await Promise.all([
        fetch(`/api/system/get-time`),
        apiFetch(`/api/system/sync-session`)
      ]);
      
      const statusData = await statusRes.json();
      const syncData = await syncRes.json();

      // Map the identity from the JWT to state
      if (syncData.isLoggedIn && syncData.user) {
        console.log("Fetch: User object received: ", syncData.user);
        
        // Standardized ID lookup
        const id = syncData.user.uuid || localStorage.getItem('muirgen_user_uuid');
        
        if (id) {
          console.log(`Fetch: Standarzied ID to: [${id}]`);
          
          // Save this locally so the load effect can find it on browser reload.
          localStorage.setItem('muirgen_user_uuid', id);
          setCurrentUser(syncData.user);
          setIsLoggedIn(true);
        } else {
          console.error("Fetch: User found but no UUID property detected!");
        }
      } else {
        setCurrentUser(null);
      }
      
      setDbData(statusData);
      setSetupState(syncData);
      
      // If, for some reason, the setup is required but a stale token remains, delete it.
      if (syncData.userRequired || syncData.vesselRequired) {
        if (localStorage.getItem('muirgen_token')) {
          localStorage.removeItem('muirgen_token');
        }
        setIsLoggedIn(false);
      } else if (!isLoggingOutRef.current) {
        setIsLoggedIn(syncData.isLoggedIn);
      }
      
      // Get vessel data if the user is logged in.
      if (!syncData.userRequired && !syncData.vesselRequired && syncData.isLoggedIn) {
        const vesselRes = await apiFetch(`/api/vessels/get-vessel`);
        // prevents crashing on vesselRed.json() if the token was nuked.
        if (!vesselRes) { return; }
        const vesselData = await vesselRes.json();
        setVessel(vesselData);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  }, [isLoggingOut]);

  // Initial load
  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="App">
      <div className="crt-overlay" />
      
      {/* Background Layer; sky-ground walking grid background. Blurred during log-out */}
      <div className={`grid-container ${isLoggingOut ? 'blur-active' : ''}`}>
        <div className="wireframe-grid sky" />
        <div className="wireframe-grid ground" />
      </div>
      
      {/* The main view port */}
      <main className="main-layout">
        {/* Navigation Sidebar */}
        {isLoggedIn && !isLoggingOut && (
          <Sidebar activeView={activeView} setActiveView={setActiveView} />
        )}
        
        {/* Dynamic background Viewport */}
        <div className={`content-viewport ${isLoggingOut ? 'blur-active' : ''}`}>
          
          {/* View Center Container */}
          <div className="view-center-container">
            
            {/* Which header are we showing? */}
            {(!isLoggedIn) ? (
              <div className="task-header-wrapper">
                {(setupState.vesselRequired || setupState.userRequired) ? (
                  <h2 className="flicker">Initial System Configuration</h2>
                ) : (
                  <h2 className="flicker">⧲ Operator Authentication</h2>
                )}
              </div>
            ) : (
              <div className="task-header-wrapper">
                {activeView === 'VESSEL_MANAGEMENT' && (
                  <h2 className="flicker"><span className="task-header-button" onClick={() => setActiveView('VSM')}>VSM</span> // Vessel Index</h2>
                )}
                {activeView === 'VESSEL_EDIT' && (
                  <h2 className="flicker"><span className="task-header-button" onClick={() => setActiveView('VSM')}>VSM</span> // <span className="task-header-button" onClick={() => setActiveView('VESSEL_MANAGEMENT')}>Vessels</span> // Vessel Edit</h2>
                )}
                {activeView === 'VESSEL_REGISTRATION' && (
                  <h2 className="flicker"><span className="task-header-button" onClick={() => setActiveView('VSM')}>VSM</span> // <span className="task-header-button" onClick={() => setActiveView('VESSEL_MANAGEMENT')}>Vessels</span> // Vessel Registration</h2>
                )}
              </div>
            )}
            
            {/* The main VSM box */}
            <div className="vessel-box">
              {setupState.vesselRequired ? (
                <>
                  <h3 className="step-title">⏃ Initial Vessel Registration</h3>
                  <VesselSetup onComplete={fetchData} />
                </>
              ) : setupState.userRequired ? (
                <>
                  <h3 className="step-title">⏿ System Operator Registration</h3>
                  <UserSetup onComplete={fetchData} />
                </>
              ) : !isLoggedIn ? (
                <>
                  <h3 className="step-title">Security: Enter Credentials</h3>
                  <Login onLoginSuccess={() => { setIsLoggedIn(true); fetchData();}} />
                </>
              ) : (
                <>
                  {/* The main / initial page. For now, it's a simple data box */}
                  {activeView === 'VSM' && vessel && (
                    <>
                      <h3 className="step-title">◫ Vessel Status Monitor // {vessel.vesselName || 'Loading...'}</h3>
                      <p>Flag Nation: {vessel.vesselFlagNation || 'Loading...'}</p>
                      <p>Home Port: {vessel.vesselPortOfRegistry || 'Loading...'}</p>
                      <p>Build Details: {vessel.vesselBuildDetails || 'Loading...'}</p>
                      <p>Official Number: {vessel.vesselOfficialNumber || 'Loading...'}</p>
                      <p>Hull ID Number: {vessel.vesselHullIdentificationNumber || 'Loading...'}</p>
                      <p>Database UUID: {vessel.vesselUuid || 'Loading...'}</p>
                    </>
                  )}
                  
                  {/* The vessel management */}
                  {activeView === 'VESSEL_MANAGEMENT' && (
                    <VesselManagement
                      vessels={allVessels}
                      onModify={(v) => {
                        setViewContext(v);
                        setActiveView('VESSEL_EDIT');
                      }}
                      onRegister={() => setActiveView('VESSEL_MANAGEMENT')}
                    />
                  )}
                  
                  {/* The vessel edit form (for managing existing vessels) */}
                  {activeView === 'VESSEL_EDIT' && viewContext && (
                    <VesselEdit 
                      vessel={viewContext}
                      activeCount={allVessels.filter(v => v.is_active).length}
                      onComplete={() => {
                        fetchManagementData();              // refresh the index
                        setActiveView('VESSEL_MANAGEMENT'); // Return to the list.
                        setViewContext(null);               // Clear the selected vessel
                      }}
                      onCancel={() => {
                        setActiveView('VESSEL_MANAGEMENT'); // Return to the list
                        setViewContext(null);               // Clear the selected vessel
                      }}
                    />
                  )}
                  
                  {/* The new vessel registration form (adding addition vessels) */}
                  {activeView === 'VESSEL_REGISTRATION' && (
                    <VesselRegistration 
                      onComplete={() => {
                        fetchManagementData(); // refresh the index
                        setActiveView('VESSEL_MANAGEMENT'); // Return to the list.
                      }}
                    />
                  )}
                </>
              )}
            </div>
          </div>
            
          {/* System Controls (floating top-right - VSM when navigating, End Session always */}
          {isLoggedIn && !isLoggingOut && (
            <div className="system-controls">
              {activeView !== 'VSM' && (
                <button onClick={() => setActiveView('VSM')} className="action-bar-button">
                  <span className="glyph">◫</span>
                  <span className="label-text">VSM</span>
                </button>
              )}

              <button onClick={handleLogout} className="action-bar-button" style={{ marginLeft: 'auto' }}>
                <span className="glyph">🞪</span>
                <span className="label-text">End Session</span>
              </button>
            </div>
          )}
          
          {/* Telemetry footer */}
          <div className="telemetry-footer">
            <div className="telemetry-item">
              <span className="soft-text">System Time //</span> {displayTime}
            </div>
            <div className="telemetry-item">
              <span className="soft-text">Database //</span>
              <span className={dbData.status === 'Online' ? 'neon-text' : 'danger-text'}>
                {dbData.status.toUpperCase()}
              </span>
            </div>
            {/* Future placeholder for GPS lat/lon. */}
            <div className="telemetry-item">
              <span className="soft-text">Position //</span> ◭ NO SAT LOCK ◮
            </div>
          </div>
        </div>
    
        {/* Logout Overlay; Success message must stay inside the viewport to be visible during logout. */}
        {isLoggingOut && (
          <div className="status-display success logout-overlay">
            {logoutMessage}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
