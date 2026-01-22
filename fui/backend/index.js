// ~/fui/backend/index.js
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import config from '../config.js';

// Setup __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialise the dotenv using the explicit path
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors()); // Critical for local cross-port communication
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Check if the user is logged in.
app.post('/api/login', async (req, res) => {
  const { userHandle, userPassword } = req.body;
  try {
    const result = await pool.query('SELECT uuid, vessel_uuid, name, password_hash, is_admin FROM users WHERE is_active = TRUE AND handle = $1;', [userHandle]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid Operator" });
    }
    
    const user = result.rows[0];
    const match = await bcrypt.compare(userPassword, user.password_hash);
    
    if (match) {
      // Create the password / token.
      const token = jwt.sign(
        { uuid: user.uuid, handle: user.handle, isAdmin: user.is_admin }, 
        process.env.JWT_SECRET || 'this_is_bad_fallback_key', 
        { expiresIn: '30d' } // This is more to keep sessions active than for security
      );
      
      res.json({ success: true, token });
    } else {
      res.status(401).json({ error: "Access Denied" });
    }
  } catch (err) {
    res.status(500).json({ error: "System Error. Database Offline?" });
  }
});

// Check if any setup is needed.
app.get('/api/check-init', async (req, res) => {
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

// Handle saving users with bcryptjs
app.post('/api/save-user', async (req, res) => {
  const { userHandle, userName, userPassword, userIsAdmin, userVesselUuid } = req.body;
  try {
    // If there are no users yet, this first user will be forced to be an admin.
    const userCount = await pool.query('SELECT COUNT(*) FROM users;');
    const isFirstUser = parseInt(userCount.rows[0].count) === 0;
    const finalAdminStatus = isFirstUser ? true : userIsAdmin;
    
    // Hash password with 12 salt rounds
    const hashedPassword = await bcrypt.hash(userPassword, 12);
    await pool.query(
      'INSERT INTO users (handle, name, password_hash, is_admin, vessel_uuid) VALUES ($1, $2, $3, $4, $5);',
      [userHandle, userName, hashedPassword, finalAdminStatus, userVesselUuid]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Database error: ${err.message}` });
  }
});

// TODO: Delete this, we don't need it anymore.
// Test Query Endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT TO_CHAR(LOCALTIMESTAMP, \'YYYY-MM-DD HH24:MI:SS\') AS current_time;');
    res.json({ status: 'Online', serverTime: result.rows[0].current_time });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// TODO: We need to either pass in a vessels.uuid, or handle when there's multiple vessels database. If this
//       is used to let an admin see inactive vessels (to re-active them), this won't work.
app.get('/api/get-vessel', async (req, res) => {
  try {
    const result = await pool.query('SELECT uuid, name, flag_nation, port_of_registry, build_details, official_number, hull_id_number, keel_offset, waterline_offset FROM vessels WHERE is_active = TRUE LIMIT 1;');
    if (result.rows.length === 0) {
      return res.json({ setupRequired: true });
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
    console.error('Error in /api/get-vessel:', err); 
    res.status(500).json({ error: 'Database Offline' });
  }
});

// TODO: This needs to support UPDATEs of existing vessels so the user can make changes to existing vessels,
//       disable or re-enable a vessel, etc.
app.post('/api/save-vessel', async (req,res) => {
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
    res.json({ success: true });
  } catch (err) {
    console.error('SQL INSERT Error:', err.message); 
    res.status(500).json({ error: err.message });
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

process.on('uncaughtException', function (err) {
  console.error('FATAL UNCAUGHT EXCEPTION:', err.message);
  // Optional: Add more details here
  process.exit(1); // Exit the process cleanly for PM2 to restart it
});

const PORT = process.env.PORT || config.apiPort || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend online on port ${PORT}`);
});
