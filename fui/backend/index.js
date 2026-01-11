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
    const result = await pool.query('SELECT vessel_uuid, vessel_name, vessel_official_number, vessel_hin, modified_date FROM vessels ORDER BY modified_date DESC LIMIT 1;');
    res.json({ 
      vesselUuid: result.rows[0].vessel_uuid, 
      vesselName: result.rows[0].vessel_name, 
      vesselOfficialNumber: result.rows[0].vessel_official_number,
      vesselHIN: result.rows[0].vessel_hin
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on http://0.0.0.0:${PORT}`);
});

