// ~/fui/backend/index.js
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Setup __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialise environment variables;
dotenv.config({ path: path.join(__dirname, '.env') });

// Import files that rely on environment variables or shared configs.
import config from '../config.js';
import pool from './db.js';
import { authenticateToken, requireAdmin } from './middleware/auth.js';
import { auditLog } from './utils/logger.js';

const app = express();

// Standard middleware
app.use(cors()); // Critical for local cross-port communication
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist'))); // points to the compiled UI

/* *********************************************************************************************************/
/* Section 1: System Endpoints                                                                             */
/* *********************************************************************************************************/

// Check if any setup is needed.
app.get('/api/system/check-init', async (req, res) => {
  try {
    const userRes = await pool.query('SELECT uuid FROM users WHERE is_active = TRUE LIMIT 1;');
    const vesselRes = await pool.query('SELECT uuid FROM vessels WHERE is_active = TRUE LIMIT 1;');
    
    // Check for a passport in the headers.
    const authHeader = req.headers.authorization;
    let loggedIn = false;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      // Verify that the UUID in the token exists and is (still) active.
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'this_is_bad_fallback_key');
        const userCheck = await pool.query(
          'SELECT uuid FROM users WHERE is_active = TRUE AND uuid = $1;', 
          [decoded.uuid]
        );
        if (userCheck.rows.length > 0) {
          loggedIn = true;
        } else {
          // The user has either been deactivated or deleted entirely.
          loggedIn = false;
        }
      } catch (err) {
        // The token has expired or is invalid.
        loggedIn = false;
      }
    }
      
    res.json({
      userRequired: userRes.rows.length === 0,
      vesselRequired: vesselRes.rows.length === 0, 
      isLoggedIn: loggedIn
    });
  } catch (err) {
    res.status(500).json({ error: 'Database Offline' });
  }
});

// TODO: Delete this, we don't need it anymore.
// Test Query Endpoint
app.get('/api/system/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT TO_CHAR(LOCALTIMESTAMP, \'YYYY-MM-DD HH24:MI:SS\') AS current_time;');
    res.json({ status: 'Online', serverTime: result.rows[0].current_time });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

/* *********************************************************************************************************/
/* Section 2: User (SysOp) Endpoints                                                                       */
/* *********************************************************************************************************/

// Delete (well, deactivate) a user
app.delete('/api/users/delete/:uuid', authenticateToken, requireAdmin, async (req, res) => {
  const targetUuid = req.params.uuid; // The passed in UUID
  const requesterUuid = req.user.uuid;
  const requesterVesselUuid = req.user.vessel_uuid;
  const requesterHandle = req.user.handle;
  
  try {
    // TODO: Replace this with a central auditing function later.
    // Get the user's handle for the audit log;
    const userLookup = await pool.query('SELECT handle FROM users WHERE uuid = $1;', [targetUuid]);
    const targetHandle = userLookup.rows[0]?.handle || 'Unknown';
    
    // Log the delete
    await auditLog(pool, requesterVesselUuid, requesterUuid, 'User::Delete', `Operator: [${requesterHandle}] revoked access for the user: [${targetHandle}] UUID: [${targetUuid}].`);
    
    await pool.query(
      'UPDATE users SET is_active = FALSE WHERE uuid = $1;', 
      [targetUuid]
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: `Operator Deactivation Failed: ${err.message}` })
  }
});

// This is called ONLY during initial setup when no users exist at all. Once even one user exists, this 
// returns 403.
app.post('/api/users/initial-sysop', async (req, res) => {
  try {
    // If any users exist at all, bail out.
    const checkUsers = await pool.query('SELECT COUNT(*) FROM users;');
    if (parseInt(checkUsers.rows[0].count) > 0) {
      return res.status(403).json({ error: "Security: System Already Initialised! What are you doing here? Shoo" });
    }
    
    const { userHandle, userName, userPassword, userPasswordConfirm, userVesselUuid } = req.body;
    if (userPassword !== userPasswordConfirm) {
      return res.status(400).json({ error: 'The access code verification did not match the access code entered.' });
    }
    
    // Record the primary SysOp.
    const hashedPassword = await bcrypt.hash(userPassword, 12);
    const result = await pool.query(
      'INSERT INTO users (handle, name, password_hash, is_admin, vessel_uuid, is_active) VALUES ($1, $2, $3, TRUE, $4, TRUE) RETURNING uuid;', 
      [userHandle, userName, hashedPassword, userVesselUuid]
    );
    
    // First entry in the audit log.
    await auditLog(pool, userVesselUuid, result.rows[0].uuid, 'User::Bootstrap', `System Initialised. Primary SysOp is: [${userHandle}]`);
    res.json({ success: true });
  } catch (err) {
    console.error('Master registration failed! Error: ', err.message);
    res.status(500).json({ error: `Master registration failed! Error: ${err.message}` });
  }
});

// Get a list of all users
app.get('/api/users/list', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT uuid, handle, name, is_admin, is_active FROM users ORDER BY handle ASC;'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: `Operator Load Failed: ${err.message}` })
  }
});

// Record in the audit log when a user logs out.
app.post('/api/users/logout', authenticateToken, async (req, res) => {
  try {
    // TODO: Replace this with a central auditing function later.
    // The user_uuid of the user being edited
    const { uuid, vessel_uuid, handle } = req.user;
    
    // Log the delete
    await auditLog(pool, vessel_uuid, uuid, 'User::Logout', `Operator: [${handle}] has logged off.`);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error in /api/users/logout:', err); 
    res.status(500).json({ error: 'Database Offline' });
  }
});

// Update existing users
app.put('/api/users/update/:uuid', authenticateToken, requireAdmin, async (req, res) => {
  // The user_uuid of the user being edited
  const targetUuid = req.params.uuid;
  // This comes the JWT middleware (muirgen token) and is the user_uuid of the user doing the update.
  const requesterUuid       = req.user?.uuid;
  const requesterHandle     = req.user?.handle;
  const requesterVesselUuid = req.user?.vessel_uuid;
  
  const { 
    userHandle, 
    userPassword,
    userCurrentPassword, 
    userName, 
    userIsAdmin, 
    userIsActive
  } = req.body;
  
  try {
    // Find the user in the database
    const result = await pool.query('SELECT * FROM users WHERE uuid = $1',  [targetUuid]);
    const user = result.rows[0];
    
    // If the editing user is editing themselves, verify the curren password.
    if (targetUuid === requesterUuid) {
      const isValid = await bcrypt.compare(userCurrentPassword, user.password_hash);
      if (!isValid) {
        return res.status(401).json({ error: "Security Violation: Current Access Code not Correct." });
      }
    }
    
    // Update the record
    if (userPassword) {
      // Update with the password set.
      const encryptedPassword = await bcrypt.hash(userPassword, 12);
      await pool.query(
        'UPDATE users SET name = $1, handle = $2, is_admin = $3, is_active = $4, password_hash = $5 WHERE uuid = $6;',
        [userName, userHandle, userIsAdmin, userIsActive, encryptedPassword, req.params.uuid]
      );
      // Create an audit log for this update.
      await auditLog(pool, requesterVesselUuid, requesterUuid, 'User::Update', `Operator: [${requesterHandle}] update the password /record for user: [${userHandle}].`);
      res.json({ success: true })
    } else {
      // Update without the password column.
      await pool.query(
        'UPDATE users SET name = $1, handle = $2, is_admin = $3, is_active = $4 WHERE uuid = $5;',
        [userName, userHandle, userIsAdmin, userIsActive, req.params.uuid]
      );
      // Create an audit log for this update.
      await auditLog(pool, requesterVesselUuid, requesterUuid, 'User::Update', `Operator: [${requesterHandle}] update the record for user: [${userHandle}].`);
      res.json({ success: true })
    }
  } catch (err) {
    res.status(500).json({ error: `Operator Update Failed: ${err.message}`});
  }
})

// Check if the user is logged in.
app.post('/api/users/login', async (req, res) => {
  const { userHandle, userPassword } = req.body;
  
  try {
    // Get details about the logging in user for the audit log
    const result = await pool.query(
      'SELECT uuid, vessel_uuid, name, password_hash, is_admin FROM users WHERE is_active = TRUE AND handle = $1;', 
      [userHandle]
    );
    
    // Is the handle valid?
    if (result.rows.length === 0) {
      // Nope.
      await auditLog(pool, null, null, 'Login::Failure', `An attempt to login as: [${userHandle}] was made, which is not a valid operator.`);
      return res.status(401).json({ error: "Security: Invalid Operator" });
    }
    
    const user = result.rows[0];
    const match = await bcrypt.compare(userPassword, user.password_hash);
    
    if (match) {
      // Create the password / token.
      const token = jwt.sign(
        { 
          uuid: user.uuid, 
          handle: userHandle, 
          is_admin: user.is_admin, 
          vessel_uuid: user.vessel_uuid
        }, 
        process.env.JWT_SECRET || 'this_is_bad_fallback_key', 
        { expiresIn: '30d' } // This is more to keep sessions active than for security
      );
      await auditLog(pool, user.vessel_uuid, user.uuid, 'Login::Success', `The operator: [${userHandle}] has successfully logged in.`);
      res.json({ success: true, token });
    } else {
      // Bad password.
      await auditLog(pool, null, null, 'Login::Failure', `Security: Invalid access code used for the operator: [${userHandle}]!`);
      res.status(401).json({ error: "Access Denied" });
    }
  } catch (err) {
    res.status(500).json({ error: "System Error. Database Offline?" });
  }
});

// Handle saving users with bcryptjs
app.post('/api/users/save', authenticateToken, requireAdmin, async (req, res) => {
  const { userHandle, userName, userPassword, userPasswordConfirm, userIsAdmin, userVesselUuid } = req.body;
  try {
    // Is the access code and verify code the same?
    if (userPassword !== userPasswordConfirm) {
      return res.status(400).json({ error: 'The access code verification did not match the access code entered.' });
    }
    
    // Prevent duplicate handles.
    const existing = await pool.query('SELECT uuid FROM users WHERE handle = $1;', [userHandle]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Conflict: User handle already in use!" });
    }
    
    // Hash the password.
    const hashedPassword = await bcrypt.hash(userPassword, 12);
    
    // Record the new user.
    const newUser = await pool.query(
      'INSERT INTO users (handle, name, password_hash, is_admin, vessel_uuid, is_active) VALUES ($1, $2, $3, $4, $5, TRUE);',
      [userHandle, userName, hashedPassword, userIsAdmin, userVesselUuid]
    );
    
    // Log who created it and then we're done.
    await auditLog(pool, userVesselUuid, req.user.uuid, 'User::Create', `Operator: [${req.user.handle}] registered the new user: [${userHandle}].`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Database error: ${err.message}` });
  }
});

/* *********************************************************************************************************/
/* Section 3: Vessel Endpoints                                                                             */
/* *********************************************************************************************************/

// Delete (deactive) a vessel.
app.delete('/api/vessels/delete/:uuid', authenticateToken, requireAdmin, async (req, res) => {
  const targetUuid = req.params.uuid;
  
  try {
    // Is there another active vessel?
    const vessels = await pool.query('SELECT COUNT(*) FROM vessels WHERE is_active = TRUE AND uuid != $1;', [targetUuid]);
    if (parseInt(vessels.rows[0].count) === 0) {
      return res.status(400).json({ error: "Abort: Can not deactive a vessel while no other vessel is active!" });
    }
    
    // Are all active users moved over to another vessel?
    const users = await pool.query('SELECT COUNT(*) FROM users WHERE is_active = TRUE AND vessel_uuid = $1;', [targetUuid]);
    if (parseInt(users.rows[0].count) !== 0) {
      return res.status(400).json({ error: "Abort: All users (and crew) must be moved to another vessel before deactiving!" });
    }
    
    // Are all active crew moved over to another vessel?
    const crew = await pool.query('SELECT COUNT(*) FROM crew WHERE is_active = TRUE AND vessel_uuid = $1;', [targetUuid]);
    if (parseInt(crew.rows[0].count) !== 0) {
      return res.status(400).json({ error: "Abort: All crew (and users) must be moved to another vessel before deactiving!" });
    }
    
    // Still alive? Then we're ready. Get the vessel name for the audit log
    const vesselLookup = await pool.query('SELECT name FROM vessels WHERE uuid = $1;', [targetUuid])
    const vesselName = vesselLookup.rows[0]?.name || 'Unknown vessel';
    await pool.query('UPDATE vessels SET is_active = FALSE WHERE uuid = $1;', [targetUuid]);
    
    // Log it
    await auditLog(pool, targetUuid, req.user.uuid, 'Vessel::Deactivate', `Operator: [${req.user.handle}] deactivated the vessel: [${vesselName}].`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: `Vessel deactivation failed. Error: ${err.message}` });
  }
});

// Get a list of active vessels
app.get('/api/vessels/get-active', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT uuid, name FROM vessels WHERE is_active = TRUE ORDER BY name ASC;'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('SQL SELECT error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get details for the logged-in user's vessel_uuid
app.get('/api/vessels/get-vessel', authenticateToken, async (req, res) => {
  try {
    const vesselUuid = req.user.vessel_uuid;
    const result = await pool.query(
      'SELECT uuid, name, flag_nation, port_of_registry, build_details, official_number, hull_id_number, keel_offset, waterline_offset FROM vessels WHERE is_active = TRUE AND uuid = $1;',
      [vesselUuid]
    );
    if (result.rows.length === 0) {
      
      return res.status(404).json({ error: "Vessel not found or has been deactived!" });
    }
    const vessel = result.rows[0];
    res.json({
      vesselUuid: vessel.uuid, 
      vesselName: vessel.name, 
      vesselFlagNation: vessel.flag_nation,
      vesselPortOfRegistry: vessel.port_of_registry,
      vesselBuildDetails: vessel.build_details,
      vesselOfficialNumber: vessel.official_number,
      vesselHullIdentificationNumber: vessel.hull_id_number, 
      vesselKeelOffset: vessel.keel_offset, 
      vesselWaterlineOffset: vessel.waterline_offset, 
      setupRequired: false
    });
  } catch (err) {
    console.error('Error in /api/vessels/get-vessel:', err.message); 
    res.status(500).json({ error: 'Database Offline' });
  }
});

// Save a new vessel. This is separate from update as it needs logic for initialisation of the system.
app.post('/api/vessels/save', async (req,res) => {
  // Before proceeding; If this is a fresh setup (no vessels in the DB), allow the save without a valid 
  // token. Otherwise, require authentication.
  try {
    const vesselCountRes = await pool.query('SELECT COUNT(*) FROM vessels;');
    const isInitialSetup = parseInt(vesselCountRes.rows[0].count) === 0;
    let requester = { uuid: null, vessel_uuid: null, handle: 'SYSTEM' };
    
    // If this os NOT the initial setup, validate the session.
    if (!isInitialSetup) {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      
      if (!token) {
        return res.status(403).json({ error: "Security: authorization required!" });
      }
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'this_is_bad_fallback_key');
        if (!decoded.is_admin) {
          return res.status(403).json({ error: "Security: System operator status required!" });
        }
        requester = decoded;
      } catch (err) {
        return res.status(403).json({ error: "Security: Session expired." });
      }
    }
    
    // Now save.
    const { 
      vesselName, 
      vesselFlagNation,
      vesselPortOfRegistry, 
      vesselBuildDetails, 
      vesselOfficialNumber, 
      vesselHullIdentificationNumber, 
      vesselKeelOffset, 
      vesselWaterlineOffset } = req.body;
    try {
      await pool.query(
          `INSERT INTO vessels (name, flag_nation, port_of_registry, build_details, official_number, hull_id_number, keel_offset, waterline_offset) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
          [vesselName, vesselFlagNation, vesselPortOfRegistry, vesselBuildDetails, vesselOfficialNumber, vesselHullIdentificationNumber, vesselKeelOffset, vesselWaterlineOffset]
      );
    } catch (err) {
      console.error('SQL INSERT Error:', err.message); 
      return res.status(500).json({ error: err.message });
    }
    
    if (!isInitialSetup) {
      // We can log additional vessels, as there must be a user by that point. We can not log the very first
      // vessel though, as it is added before any user exists.
      await auditLog(pool, requester.vessel_uuid, requester.uuid, 'Create::Vessel', `Vessel [${vesselName}] registered by [${requester.handle}].`);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Adding the vessel failed. Error: :', err.message); 
    res.status(500).json({ error: err.message });
  }
});

// Update an existing vessel
app.put('/api/vessels/update/:uuid', authenticateToken, requireAdmin, async (req, res) => {
  const targetUuid = req.params.uuid;
  const {
    vesselName, 
    vesselFlagNation, 
    vesselPortOfRegistry, 
    vesselBuildDetails, 
    vesselOfficialNumber, 
    vesselHullIdentificationNumber, 
    vesselKeelOffset, 
    vesselWaterlineOffset
  } = req.body;
  
  try {
    await pool.query(
      'UPDATE vessels SET name = $1, flag_nation = $2, port_of_registry = $3, build_details = $4, official_number = $5, hull_id_number = $6, keel_offset = $7, waterline_offset = $8 WHERE uuid = $9;', 
      [vesselName, vesselFlagNation, vesselPortOfRegistry, vesselBuildDetails, vesselOfficialNumber, vesselHullIdentificationNumber, vesselKeelOffset, vesselWaterlineOffset, targetUuid]
    );
    
    await auditLog(pool, targetUuid, req.user.uuid, 'Vessel::Update', `Operator: [${req.user.handle}] updated the vessel records for: [${vesselName}].`);
    res.json({ success: true});
  } catch (err) {
    console.error('Vessel update failed! Error: ', err.message);
    res.status(500).json({ error: `Vessel update failed! Error: ${err.message}` });
  }
});

/* *********************************************************************************************************/
/* Section 4: Non-endpoint stuff                                                                           */
/* *********************************************************************************************************/

process.on('uncaughtException', function (err) {
  console.error('FATAL UNCAUGHT EXCEPTION:', err.message);
  // Optional: Add more details here
  process.exit(1); // Exit the process cleanly for PM2 to restart it
});

// Ensure that if the page is refreshhed on a sub-route, it still loads index.html
app.get(/^(?!\/api\/).+/, (req, res, next) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const PORT = process.env.PORT || config.apiPort || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend online on port ${PORT}`);
});
