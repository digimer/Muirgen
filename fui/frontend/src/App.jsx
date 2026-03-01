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
import UserEdit from './UserEdit';
import UserManagement from './UserManagement';
import EntityViewer from './EntityViewer.jsx';

const App = () => {
  // Remember where the user was in case the browser reloads. 
  const [viewStack, setViewStack] = useState([
    { id: 'VSM', context: null, list: [], index: 0, noteTarget: null }
  ]);
  const [allVessels, setAllVessels]   = useState([]);
  const [allUsers, setAllUsers]       = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [displayTime, setDisplayTime] = useState('Acquiring Time Source...');
  const [dbData, setDbData]           = useState({ status: 'Connecting...', serverTime: '' });
  const hasRestoredSession            = useRef(false);
  // We need to make sure that isLoggingOut always reflects the current value, and isn't cached.
  const [isLoggingOut, setIsLoggingOut]   = useState(false);
  const isLoggingOutRef                   = useRef(false);
  const [isLoggedIn, setIsLoggedIn]       = useState(false);
  const [logoutMessage, setLogoutMessage] = useState('Carrier dropped, session closed');
  const [setupState, setSetupState]       = useState({userRequired: false, vesselRequired: false });
  const [vessel, setVessel]               = useState(null);
  
  // Navigation helpers.
  const currentView = viewStack[viewStack.length - 1];
  const pushView    = useCallback((id, context = null, list = [], index = 0, noteTarget = null) => {
    setViewStack(prev => [...prev, { id, context, list, index, noteTarget }]);
  }, []);
  const popView = useCallback((optionalTargetNoteId = null) => {
    setViewStack(prev => {
      if (prev.length <= 1) return prev; // Never pop the last view (VSM)
      
      const newStack = [...prev];
      newStack.pop(); // Remove the top view
      
      // If a specific note target was passed back from the popped view, inject it into the new top view
      if (typeof optionalTargetNoteId === 'string') {
        newStack[newStack.length - 1] = { 
          ...newStack[newStack.length - 1], 
          noteTarget: optionalTargetNoteId 
        };
      } else {
        newStack[newStack.length - 1] = { 
          ...newStack[newStack.length - 1], 
          noteTarget: null 
        };
      }
      return newStack;
    });
  }, []);
  const resetToView = useCallback((id) => {
    setViewStack([{ id, context: null, list: [], index: 0, noteTarget: null }]);
  }, []);

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
      const res = await fetch('/api/system/time');
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
    
    // Build the storage key from their ID. (Context is now stored inherently in the stack!)
    const stackKey = `muirgen_viewstack_${id}`;
    
    // Restore logic; Run only once.
    if (!hasRestoredSession.current) {
      const savedStack = localStorage.getItem(stackKey);
      
      if (savedStack) {
        try {
          const parsedStack = JSON.parse(savedStack);
          if (Array.isArray(parsedStack) && parsedStack.length > 0) {
            console.log(`Persistence: Restoring ViewStack for operator: [${id}]`, parsedStack);
            setViewStack(parsedStack);
          }
        } catch (err) {
          console.warn("Persistence: Failed to parse the saved view stack! The error was: ", err);
        }
        hasRestoredSession.current = true;
        return;
      }
      hasRestoredSession.current = true;
    }
    
    // If the user is logged in and changes the stack, save the whole array.
    if (isLoggedIn && !isLoggingOutRef.current) {
      console.log(`Persistence: Recording ViewStack to: [${stackKey}]`);
      localStorage.setItem(stackKey, JSON.stringify(viewStack));
    }
  }, [viewStack, currentUser, isLoggedIn]);

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
  
  // Get the list of users.
  const fetchUserManagementData = useCallback(async () => {
    try {
      const res = await apiFetch('/api/users/list');
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data);
      }
    } catch (err) {
      console.error('User management fetch error:', err);
    }
  }, []);

  // Where are we?
  useEffect(() => {
    if (currentView?.id === 'VESSEL_MANAGEMENT' || 
        currentView?.id === 'VESSEL_EDIT'       || 
        currentView?.id === 'VESSEL_PROFILE'    ||
        currentView?.id === 'USER_EDIT') {
      fetchManagementData();
    }
    if (currentView?.id === 'USER_MANAGEMENT' || currentView?.id === 'USER_EDIT' || currentView?.id === 'USER_PROFILE') {
      fetchUserManagementData();
    }
  }, [currentView?.id, fetchManagementData, fetchUserManagementData]);
  
  // Refresh ViewContext with live data if we are editing.
  useEffect(() => {
    // We only refresh context if there's a valid ID and context to refresh!
    if (!currentView || !currentView.context) return;
     
    if (currentView?.id === 'VESSEL_EDIT' && allVessels.length > 0) {
      // Find the updated version of the vessel we're editing.
      const freshVessel = allVessels.find(v => v.uuid === currentView.context.uuid);

      // If found, and it's different (e.g. user count changed), update out context.
      if (freshVessel && JSON.stringify(freshVessel) !== JSON.stringify(currentView.context)) {
        // Replace the top of the stack with the fresh context
        setViewStack(prev => {
          const newStack = [...prev];
          newStack[newStack.length - 1].context = freshVessel;
          return newStack;
        });
      }
    }
    
    if (currentView?.id === 'USER_EDIT' && allUsers.length > 0) {
      const freshUser = allUsers.find(u => u.uuid === currentView.context.uuid);
      if (freshUser && JSON.stringify(freshUser) !== JSON.stringify(currentView.context)) {
        setViewStack(prev => {
          const newStack = [...prev];
          newStack[newStack.length - 1].context = freshUser;
          return newStack;
        });
      }
    }
    // Note: We don't need the other reload interceptors for VESSEL_PROFILE and USER_PROFILE anymore, 
    // because with the ViewStack, the full list context is persisted automatically in localStorage! 
  }, [allVessels, allUsers, currentView]);

  // Handle Logging the user out
  const handleLogout = async () => {
    // blurs the screen during the logout confirmation
    setIsLoggingOut(true);
    isLoggingOutRef.current = true;
    
    // Log the logout.
    const logPromise = apiFetch('/api/auth/logout', { method: 'POST' }).catch(err => {
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
      resetToView('VSM');
      
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
        fetch(`/api/system/time`),
        apiFetch(`/api/auth/session-sync`)
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
        const vesselRes = await apiFetch(`/api/vessels/current`);
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
          <Sidebar activeView={currentView?.id} setActiveView={resetToView} />
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
                {currentView?.id === 'VESSEL_MANAGEMENT' && (
                  <h2 className="flicker"><span className="task-header-button" onClick={() => resetToView('VSM')}>VSM</span> // Vessel Index</h2>
                )}
                {currentView?.id === 'VESSEL_EDIT' && (
                  <h2 className="flicker"><span className="task-header-button" onClick={() => resetToView('VSM')}>VSM</span> // <span className="task-header-button" onClick={() => popView()}>Vessels</span> // Edit</h2>
                )}
                {currentView?.id === 'VESSEL_REGISTRATION' && (
                  <h2 className="flicker"><span className="task-header-button" onClick={() => resetToView('VSM')}>VSM</span> // <span className="task-header-button" onClick={() => popView()}>Vessels</span> // Registration</h2>
                )}
                {currentView?.id === 'USER_MANAGEMENT' && (
                  <h2 className="flicker"><span className="task-header-button" onClick={() => resetToView('VSM')}>VSM</span> // Operator Index</h2>
                )}
                {currentView?.id === 'USER_EDIT' && (
                  <h2 className="flicker"><span className="task-header-button" onClick={() => resetToView('VSM')}>VSM</span> // <span className="task-header-button" onClick={() => popView()}>Operators</span> // Edit</h2>
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
                  {currentView?.id === 'VSM' && vessel && (
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
                  {currentView?.id === 'VESSEL_MANAGEMENT' && (
                    <VesselManagement
                      vessels={allVessels}
                      onView={(vList, vIndex) => {
                        pushView('VESSEL_PROFILE', vList[vIndex], vList, vIndex);
                      }}
                      onModify={(v) => {
                        localStorage.removeItem('vessel_edit_active_tab');
                        pushView('VESSEL_EDIT', v);
                      }}
                      onRegister={() => {
                        localStorage.removeItem('vessel_edit_active_tab');
                        pushView('VESSEL_EDIT', null);
                      }}
                    />
                  )}
                  
                  {currentView?.id === 'VESSEL_PROFILE' && currentView.list?.length > 0 && (
                    <EntityViewer
                      entities={currentView.list}
                      initialIndex={currentView.index}
                      referenceTable="vessels"
                      jumpToNoteId={currentView.noteTarget} 
                      onOptics={(entity) => {
                        pushView('VESSEL_EDIT', entity, [], 0, 'optics');
                      }}
                      onEdit={(entity) => {
                        localStorage.removeItem('vessel_edit_active_tab');
                        pushView('VESSEL_EDIT', entity);
                      }}
                      onAddNote={(entity) => {
                        pushView('VESSEL_EDIT', entity, [], 0, 'new');
                      }}
                      onClose={() => popView()}
                      onNoteSelect={(noteId) => {
                        pushView('VESSEL_EDIT', currentView.list[currentView.index], [], 0, noteId);
                      }}
                    >
                      {/* Merchant Marine Readouts for Vessels */}
                      {(entity) => (
                        <>
                          <div className="telemetry-block">
                            <div className="telemetry-label">Vessel Name</div>
                            <div className="telemetry-value">{entity.name}</div>
                          </div>
                          <div className="telemetry-block">
                            <div className="telemetry-label">Official Number</div>
                            <div className="telemetry-value">{entity.official_number || 'Unknown'}</div>
                          </div>
                          <div className="telemetry-block">
                            <div className="telemetry-label">Hull ID</div>
                            <div className="telemetry-value">{entity.hull_id_number || 'Unknown'}</div>
                          </div>
                          <div className="telemetry-block">
                            <div className="telemetry-label">Flag State</div>
                            <div className="telemetry-value">{entity.flag_nation || 'Unknown'}</div>
                          </div>
                          <div className="telemetry-block">
                            <div className="telemetry-label">Status</div>
                            <div className={`telemetry-value ${entity.is_active ? 'entity-status-active' : 'entity-status-inactive'}`}>
                              {entity.is_active ? 'Active' : 'Inactive'}
                            </div>
                          </div>
                        </>
                      )}
                    </EntityViewer>
                  )}

                  {/* The vessel edit form (for managing existing vessels) */}
                  {currentView?.id === 'VESSEL_EDIT' && currentView.context && (
                    <VesselEdit 
                      vessel={currentView.context}
                      activeCount={allVessels.filter(v => v.is_active).length}
                      jumpToNoteId={currentView.noteTarget} 
                      onComplete={() => {
                        fetchManagementData();  // refresh the index
                        popView();
                      }}
                      onCancel={(cancelNoteId) => {
                        popView(typeof cancelNoteId === 'string' ? cancelNoteId : null);
                      }}
                    />
                  )}
                  
                  {/* The new vessel registration form (adding addition vessels) */}
                  {currentView?.id === 'VESSEL_REGISTRATION' && (
                    <VesselRegistration 
                      onComplete={() => {
                        // refresh the index
                        fetchManagementData(); 
                        popView();
                      }}
                    />
                  )}

                  {/* The Operator views */}
                  {currentView?.id === 'USER_MANAGEMENT' && (
                    <UserManagement
                      users={allUsers}
                      onView={(uList, uIndex) => {
                        pushView('USER_PROFILE', uList[uIndex], uList, uIndex);
                      }}
                      onModify={(u) => {
                        localStorage.removeItem('user_edit_active_tab');
                        pushView('USER_EDIT', u);
                      }}
                      onRegister={() => {
                        localStorage.removeItem('user_edit_active_tab');
                        pushView('USER_EDIT', null);
                      }}
                    />
                  )}
                  
                  {currentView?.id === 'USER_PROFILE' && currentView.list?.length > 0 && (
                    <EntityViewer
                      entities={currentView.list}
                      initialIndex={currentView.index}
                      referenceTable="users"
                      jumpToNoteId={currentView.noteTarget} 
                      onOptics={(entity) => {
                        pushView('USER_EDIT', entity, [], 0, 'optics');
                      }}
                      onEdit={(entity) => {
                        localStorage.removeItem('user_edit_active_tab');
                        pushView('USER_EDIT', entity);
                      }}
                      onAddNote={(entity) => {
                        pushView('USER_EDIT', entity, [], 0, 'new');
                      }}
                      onClose={() => popView()}
                      onNoteSelect={(noteId) => {
                        pushView('USER_EDIT', currentView.list[currentView.index], [], 0, noteId);
                      }}
                    >
                      {/* These are the custom child specs for an Operator! */}
                      {(entity) => (
                        <>
                          <div className="telemetry-block">
                            <div className="telemetry-label">Name</div>
                            <div className="telemetry-value">{entity.name}</div>
                          </div>
                          <div className="telemetry-block">
                            <div className="telemetry-label">Access</div>
                            <div className="telemetry-value">{entity.is_admin ? '◈ SysOp' : '◇ Operator'}</div>
                          </div>
                          <div className="telemetry-block">
                            <div className="telemetry-label">Status</div>
                            <div className="telemetry-value" style={{ color: entity.is_active ? 'var(--neon-red)' : 'var(--soft-red)' }}>
                              {entity.is_active ? 'Aactive' : 'Deactivated'}
                            </div>
                          </div>
                        </>
                      )}
                    </EntityViewer>
                  )}

                  {currentView?.id === 'USER_EDIT' && (
                    <UserEdit 
                      user={currentView.context}
                      activeCount={allUsers.filter(u => u.is_active).length}
                      activeVessel={vessel}
                      vessels={allVessels}
                      jumpToNoteId={currentView.noteTarget}
                      onSaveSuccess={(newUuid) => {
                        fetchUserManagementData();
                        if (!currentView.context) {
                          // If this was a creation, transition to edit mode instantly
                          setViewStack(prev => {
                            const newStack = [...prev];
                            newStack[newStack.length - 1].context = { uuid: newUuid };
                            return newStack;
                          });
                        }
                      }}
                      onComplete={() => {
                        // Refresh list to reflect updates
                        fetchUserManagementData(); 
                        popView();
                      }}
                      onCancel={(cancelNoteId) => {
                        popView(typeof cancelNoteId === 'string' ? cancelNoteId : null);
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
              {currentView?.id !== 'VSM' && (
                <button onClick={() => resetToView('VSM')} className="action-bar-button">
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
