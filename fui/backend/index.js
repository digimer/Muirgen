// ./backend/index.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors'); // Use this to allow React to talk to Node

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

// Test Query Endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT TO_CHAR(LOCALTIMESTAMP, \'YYYY-MM-DD HH24:MI:SS\') AS current_time');
    res.json({ status: 'Online', serverTime: result.rows[0].current_time });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

app.get('/api/get-vessel', async (req, res) => {
  try {
    const result = await pool.query('SELECT uuid, name, flag_nation, port_of_registry, build_details, official_number, hull_id_number, keel_offset, waterline_offset FROM vessels LIMIT 1;');
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
    res.status(500).json({ error: err.message });
  }
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on http://0.0.0.0:${PORT}`);
});

