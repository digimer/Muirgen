/* 
 * Muirgen Endpoints/ 
 * - Naming conventions is 'Subject-Verb'. 
 *   - Sort '/api/<subject>/:uuid/<verb>' *after* '/api/<subject>/<verb>'!
 */

import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs-extra';
// NOTE: When sharp supports heic on Alma10, switch back and remove the following two imports and the 
//       execFilePromis constant.
import { execFile } from 'child_process';
import util from 'util';

// For handling shell calls (to heif-convert, specifically).
const execFilePromise = util.promisify(execFile);

// Setup __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialise environment variables;
dotenv.config({ path: path.join(__dirname, '.env') });

import config from '../config.js';
import pool from './db.js';
import { authenticateToken, requireAdmin } from './middleware/auth.js';
import { auditLog } from './utils/logger.js';

const app = express();
const frontendDistPath = path.join(__dirname, '../frontend/dist');

app.use(express.static(frontendDistPath));
app.use(express.json());

/* Setup generic Multer storage */
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // Create a robust path to files 
    const entityType = req.body.referenceTable || '';
    const entityUuid = req.params.uuid;

    if (!entityType) {
      return cb(new Error('Missing referenceTable'));
    }

    // Construct the path: <root>/uploads/<entityType>/<entityUuid>
    const uploadPath = path.join(process.cwd(), 'uploads', entityType, entityUuid);

    // Ensure the directory exists
    try {
      await fs.ensureDir(uploadPath);
      cb(null, uploadPath);
    } catch (err) {
      cb(err);
    }
  },
  // Multer requires this, ignore the unused variable warnings for 'req'.
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

// This sets a 250 MiB limit, which needs to also be changed in 
// '/etc/nginx/conf.d/muirgen.conf -> client_max_body_size' and in ./utils/media.js's 'uploadMedia' function.
const upload = multer({ 
  storage, 
  limits: {fileSize: 250 * 1024 * 1024 } // 50 MiB limit
});

/* *********************************************************************************************************/
/* Authentication / Security Endpoints                                                                     */
/* *********************************************************************************************************/

// Check if the user is logged in.
app.post('/api/auth/login', async (req, res) => {
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

// Record in the audit log when a user logs out.
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    // TODO: Replace this with a central auditing function later.
    // The user_uuid of the user being edited
    const { uuid, vessel_uuid, handle } = req.user;
    
    // Log the delete
    await auditLog(pool, vessel_uuid, uuid, 'User::Logout', `Operator: [${handle}] has logged off.`);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error in /api/auth/logout:', err); 
    res.status(500).json({ error: 'Database Offline' });
  }
});

// Check system requirements and sync active session data.
app.get('/api/auth/session-sync', async (req, res) => {
  try {
    const userRes = await pool.query('SELECT uuid FROM users WHERE is_active = TRUE LIMIT 1;');
    const vesselRes = await pool.query('SELECT uuid FROM vessels WHERE is_active = TRUE LIMIT 1;');
    
    // Check for a passport in the headers.
    const authHeader = req.headers.authorization;
    let loggedIn = false;
    let userRecord = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      // Verify that the UUID in the token exists and is (still) active.
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'this_is_bad_fallback_key');
        const userCheck = await pool.query(
          'SELECT uuid, handle, is_admin, vessel_uuid FROM users WHERE is_active = TRUE AND uuid = $1;', 
          [decoded.uuid]
        );
        
        if (userCheck.rows.length > 0) {
          loggedIn = true;
          userRecord = userCheck.rows[0];
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
      isLoggedIn: loggedIn, 
      user: userRecord
    });
  } catch (err) {
    res.status(500).json({ error: 'Database Offline' });
  }
});

/* *********************************************************************************************************/
/* File Management Endpoints                                                                               */
/* *********************************************************************************************************/

// Delete (deactivate) files by it's UUID
app.post('/api/files/:uuid/delete', authenticateToken, async (req, res) => {
  try {
    const fileUuid      = req.params.uuid;
    const fileRecordRes = await pool.query('SELECT file_name, reference_id FROM files WHERE uuid = $1', [fileUuid]);
    if (fileRecordRes.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileRecord = fileRecordRes.rows[0];

    // Deactivate the file.
    await pool.query('UPDATE files SET is_active = FALSE, modified_date = CURRENT_TIMESTAMP WHERE uuid = $1;', [fileUuid]);

    // Make an audit log entry.
    await auditLog(pool, fileRecord.reference_id, req.user.uuid, 'File::Deactivate', `Operator: [${req.user.handle || 'unknown'}] deactivated the file: [${fileRecord.file_name}].`);

    res.json({ success: true });
  } catch (err) {
    console.error('File deactivation error: ', err);
    res.status(500).json({ error: `File deactivation failed. Error: ${err.message}`});
  }
});

// Enable (secure) downloads of file.
app.get('/api/files/:uuid/download', authenticateToken, async (req, res) => {
  try {
    const fileUuid = req.params.uuid;

    // Get the file details from the DB
    const fileRecordRes = await pool.query('SELECT file_directory, file_name, reference_id FROM files WHERE uuid = $1 AND is_active = TRUE;', [fileUuid]);

    if (fileRecordRes.rows.length === 0) {
      return res.status(404).json({ error: 'Data file not located on storage or has been deactivated.' });
    }

    const fileRecord = fileRecordRes.rows[0];

    // strip leading slash from file_directory before joining with process.cwd()
    const safeDirectory = fileRecord.file_directory.replace(/^\/+/, '');
    const physicalPath  = path.join(process.cwd(), safeDirectory, fileRecord.file_name);

    // Ensure the file actually exists on physical storage before trying to serve it.
    if (!(await fs.pathExists(physicalPath))) {
      return res.status(404).json({ error: 'Physical file missing from storage.' });
    }

    // Log the download.
    await auditLog(pool, fileRecord.reference_id, req.user.uuid, 'File::Download', `Operator: [${req.user.handle || 'unknown'}] downloaded: [${fileRecord.file_name}]`);

    // We use res.download, which automatically handles setting the correct headers for forcing a file 
    // download and streaming the binary data to the client.
    res.download(physicalPath, fileRecord.file_name, (err) => {
      if (err) {
        // Handle cases where the client aborts the download prematurely, avoiding a server crash.
        if (!res.headersSent) {
          console.error(`Error downloading the file: [${fileRecord.file_name}]: ${err.message}`);
          res.status(500).json({ error: `There was an error serving the file.`});
        }
      } 
    });

  } catch (err) {
    console.error('Data download failure. Error: ', err);
    res.status(500).json({ error: `Data download failure. Error: [${err.message}]`});
  }
});

// List files for a given entity.
app.get('/api/files/:uuid/list', authenticateToken, async (req, res) => {
  try {
    // Note: reference_table is not needed here, as we're pulling records for a specific target, and the 
    //       UUID is sufficiently unique on it's own. 
    // Note: We use uuidv7, so sorting by uuid is equivalent to sorting by creation date.
    const parentUuid  = req.params.uuid;
    const result = await pool.query(`
      SELECT * FROM files WHERE reference_id = $1 AND is_active = TRUE ORDER BY uuid ASC;`, 
      [parentUuid]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('File data load failure, error:', err)
    res.status(500).json({ error: `File data load failure, error: ${err}` });
  }
});

// Rename a specific file by it's UUID
app.post('/api/files/:uuid/rename', authenticateToken, async (req, res) => {
  try {
    const fileUuid     = req.params.uuid;
    const { new_name } = req.body;
    if (!new_name) {
      return res.status(400).json({ error: 'new_name is required' });
    }
    
    // Get the current file record
    const fileRecordRes = await pool.query('SELECT file_directory, file_name, reference_id FROM files WHERE uuid = $1;', [fileUuid]);
    if (fileRecordRes.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    const fileRecord = fileRecordRes.rows[0];

    // Check that we're not about to cause a conflict
    const collisionRes = await pool.query(
      'SELECT uuid FROM files WHERE file_directory = $1 AND file_name = $2 AND uuid != $3 AND is_active  = TRUE;',
      [fileRecord.file_directory, new_name, fileUuid]
    );

    if (collisionRes.rows.length > 0) {
      return res.status(409).json({ error: 'A file with that name already exists here.' });
    }

    // Rename on physical disk
    const oldPath = path.join(process.cwd(), fileRecord.file_directory.replace(/^\/+/, ''), fileRecord.file_name);
    const newPath = path.join(process.cwd(), fileRecord.file_directory.replace(/^\/+/, ''), new_name);

    if (await fs.pathExists(oldPath)) {
      await fs.rename(oldPath, newPath);
    } else {
      console.warn(`File not found on disk: [${oldPath}], proceeding with the DB record update anyway.`);
    }

    // Update the DB
    await pool.query(`UPDATE files SET file_name = $1, modified_date = CURRENT_TIMESTAMP WHERE uuid = $2;`, [new_name, fileUuid]);

    // Make an audit log entry.
    await auditLog(pool, fileRecord.reference_id, req.user.uuid, 'File::Rename', `Operator: [${req.user.handle || 'unknown'}] renamed file: [${fileRecord.file_name}] to: [${new_name}].`);

    res.json({ success: true, new_name });
  } catch (err) {
    console.error('File rename error: ', err);
    res.status(500).json({ error: `File rename failed. Error: ${err.message}`});
  }
});

// Upload a file or image. Frontend must append 'referenceTable' to the formData.
app.post('/api/files/:uuid/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const parentUuid  = req.params.uuid; // Entity UUID
    const userUuid    = req.user.uuid;   // From the auth middleware
    const file        = req.file;

    // Ensure we've got a file and reference table.
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Make sure we've got a reference table.
    const referenceTable = req.body.referenceTable || '';
    if (!referenceTable) {
      return res.status(400).json({ error: 'No reference table provided' });
    }

    // Determine type based on mimetype
    let fileType          = file.mimetype.startsWith('image/') ? 'image' : 'file';
    let finalFilename     = file.filename;
    let finalMimetype     = file.mimetype;
    let finalSize         = file.size;
    const isHeicExtension = /\.(heic|heif)$/i.test(file.originalname);
    const isVideoExt      = /\.(mov|mp4|m4v|webm)$/i.test(file.originalname);
    const stats           = await fs.stat(file.path); // Get the size on disk

    // NOTE: Muirgen is not a backup tool, or a media player! It's a quick refrence tool. As such, we'll 
    //       favour usability and mangle uploads to favour in-browser accessibility. 

    // HEIC/HEIF handling: Convert to WebP
    if ((file.mimetype === 'image/heic' || file.mimetype === 'image/heif') ||
        (file.mimetype === 'application/octet-stream' && isHeicExtension)) {
      try {
        // NOTE: When sharp supports HEIC, switch back to .webp. If/when the extension changes, update where
        //       duplicate checks run before uploading in JSX files!
        const outputFilename = file.filename.replace(/\.(heic|heif)$/i, '') + '.jpg';
        const outputPath     = path.join(file.destination, outputFilename);

        // TODO: When sharp adds heic support, switch back to the following line (and 'finalMimetype' back to
        //       'image/webp')
        //await sharp(file.path).webp({ quality: 92 }).toFile(outputPath);
        // Convert
        await execFilePromise('heif-convert', ['-q', '90', file.path, outputPath]);

        // Delete the original HEIC/HEIF
        await fs.unlink(file.path);
        
        // Update the metadata for the DB
        finalFilename = outputFilename;
        finalMimetype = 'image/jpeg';
        finalSize     = (await fs.stat(outputPath)).size;
        fileType      = 'image';

      } catch (conversionError) {
        console.error(`Conversion from: [${file.mimetype}] to: [${finalMimetype}] failed. Error: [${conversionError}]`);
        // We'll upload the file as it is, but it'll be stored as a file insted of an image.
      }
    }

    // Video handling. Given how most modern devices use patent encombered formats, we'll bulk-convert video
    // to web-safe mp4 format. Start by saving to the database right away to avoid Nginx timeouts.
    const fileDirectory   = `/uploads/${referenceTable}/${parentUuid}`;
    const isVideo         = file.mimetype.startsWith('video/') || (file.mimetype === 'application/octet-stream' && isVideoExt);
    const initialMetadata = { size: finalSize, mimetype: finalMimetype };
    if (isVideo) {
      // Flag for the frontend
      initialMetadata.transcoding = true; 
    }

    const newFile = await pool.query(`INSERT INTO files 
      (user_uuid, reference_table, reference_id, file_directory, file_name, file_type, metadata) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`, 
      [userUuid, referenceTable, parentUuid, fileDirectory, finalFilename, fileType, JSON.stringify(initialMetadata)]
    );

    // Return success to the front-end immediatedly, before transcoding starts
    res.status(201).json(newFile.rows[0]);

    // Now launch transcoding asynchronously in the background.
    if (isVideo) {
      setTimeout(async () => {
        try {
          const tempOutputName = finalFilename + '-transcoded.mp4';
          const tempOutputPath = path.join(file.destination, tempOutputName);

          await execFilePromise('ffmpeg', [
            '-y', 
            '-i', 
            file.path, 
            '-c:v', 
            'libx264', 
            '-preset', 
            'fast', 
            '-crf', 
            '23', 
            '-pix_fmt',
            'yuv420p',
            '-c:a', 
            'aac', 
            '-movflags', 
            '+faststart', 
            tempOutputPath
          ]);

          // Delete the original now that the transcoding is done.
          await fs.unlink(file.path);
          
          const finalMp4Name = file.originalname.replace(/\.[^/.]+$/, "") + '.mp4';
          const finalPath = path.join(file.destination, finalMp4Name);
          await fs.rename(tempOutputPath, finalPath);

          // Update the DB record to remove the transcoding flag and point to the MP4
          const newMetadata = { size: (await fs.stat(finalPath)).size, mimetype: 'video/mp4' };
          await pool.query(`UPDATE files SET file_name = $1, metadata = $2 WHERE uuid = $3`, [finalMp4Name, JSON.stringify(newMetadata), newFile.rows[0].uuid]);
          
        } catch (err) {
          console.error(`Transcode of [${file.originalname}] failed: [${err.message}]`);
          // Strip the transcoding flag so the user can at least download the failed file
          await pool.query(`UPDATE files SET metadata = $1 WHERE uuid = $2`, [JSON.stringify({ size: finalSize, mimetype: finalMimetype }), newFile.rows[0].uuid]);
        }
      }, 0);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

/* *********************************************************************************************************/
/* Notes (& Logs) Endpoints                                                                                */
/* *********************************************************************************************************/

// Create a new note
app.post('/api/notes/create', authenticateToken, async (req, res) => {
  try {
    const userUuid = req.user.uuid;
    const { reference_table, reference_id, category, note_name, note_body, is_pinned, access_level } = req.body;

    // NOTE: We don't audit log this as it's generally not note-worthy, and who created it is record is 
    //       user_uuid anyway
    // User ID is extracted from the JWT token
    const result = await pool.query(
      'INSERT INTO notes (reference_table, reference_id, user_uuid, category, note_name, note_body, is_pinned, access_level) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;', 
      [reference_table, reference_id, userUuid, category, note_name, note_body, is_pinned || false, access_level || ['general']]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Log entry failed. Error: ', err);
    res.status(500).json({ error: `Log entry failed. Error: [${err.message}]` });
  }
});

// Delete (deactivate) a note
app.post('/api/notes/:uuid/deactivate', authenticateToken, async (req, res) => {
  try {
    const userUuid       = req.user.uuid;
    const noteUuid       = req.params.uuid; 
    const userVesselUuid = req.user.vessel_uuid;
    const userHandle     = req.user.handle;
    
    // Log the deactivation. Generally notes shouldn't be deactivated, but that doesn't mean it's a sign of
    // anyhting nefarious. Though unlikely, it could be, so log it.
    await auditLog(pool, userVesselUuid, userUuid, 'Note::Deactivation', `Operator: [${userHandle}] deactivated the note/log entry: [${noteUuid}].`);

    // Mark the note as deactivated. 
    const result = await pool.query('UPDATE notes SET is_active = FALSE WHERE uuid = $1 RETURNING *;', [noteUuid]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Deactivation failed; Note not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Note deactivation failure. Error: ', err);
    res.status(500).json({ error: `Note deactivation failed. Error: [${err.message}]` });
  }
});

// Load the existing notes for a given entity
app.get('/api/notes/:uuid/list', authenticateToken, async (req, res) => {
  try {
    const userUuid      = req.user.uuid;
    const parentUuid    = req.params.uuid;
    const isAdmin       = req.user.is_admin;
    const viewableRoles = ['general'];

    // If the user is a SysOp, give them access to 'sysop' tagged notes.
    if (isAdmin) {
      viewableRoles.push('sysop');
    }

    // Load notes that the user has access to, plus any notes marked as 'private' and match their users.uuid
    // - && $2::text[]) - It is Public or SysOp (and the user is allowed to see it)
    const result = await pool.query(
     `SELECT * FROM notes 
      WHERE reference_id = $1 
        AND is_active = TRUE 
        AND (
          (access_level && $2::text[])
          OR 
          ('private' = ANY(access_level) AND user_uuid = $3)
        )
      ORDER BY is_pinned DESC, uuid DESC;`, 
      [parentUuid, viewableRoles, userUuid]);
    res.json(result.rows);
  } catch (err) {
    console.error('Notes load failure. Error: ', err);
    res.status(500).json({ error: `Notes load failure. Error: [${err.message}]` });
  }
});

// Undelete (reeactivate) a note.
app.post('/api/notes/:uuid/reactivate', authenticateToken, async (req, res) => {
  try {
    const userUuid       = req.user.uuid;
    const noteUuid       = req.params.uuid; 
    const userVesselUuid = req.user.vessel_uuid;
    const userHandle     = req.user.handle;
    
    // Log the reactivation. This is likely a user simply undeleting an accidentally deleted note. Though 
    // unlikely, it could be someone snooping, so log it.
    await auditLog(pool, userVesselUuid, userUuid, 'Note::Reactivation', `Operator: [${userHandle}] reactivated the note/log entry: [${noteUuid}].`);

    // Mark the note as deactivated. 
    const result = await pool.query('UPDATE notes SET is_active = TRUE WHERE uuid = $1 RETURNING *;', [noteUuid]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Reactivation failed; Note not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Note reactivation failure. Error: ', err);
    res.status(500).json({ error: `Note reactivation failed. Error: [${err.message}]` });
  }
});

// Update an existing note.
app.post('/api/notes/:uuid/update', authenticateToken, async (req, res) => {
  try {
    const userUuid       = req.user.uuid;
    const noteUuid       = req.params.uuid; 
    const userVesselUuid = req.user.vessel_uuid;
    const userHandle     = req.user.handle;
    const { category, note_name, note_body, is_pinned, access_level } = req.body;
    
    // Log the update. It's generally not a concern, but in the unlikely chance a user tries to manipulate a 
    // record (ie: to mask incrimidating evidence), we audit the change.
    await auditLog(pool, userVesselUuid, userUuid, 'Note::Update', `Operator: [${userHandle}] updated the note/log entry: [${noteUuid}].`);

    const result = await pool.query(
      `UPDATE notes SET 
        category = $1, 
        note_name = $2, 
        note_body = $3, 
        is_pinned = $4, 
        user_uuid = $5, 
        access_level = $6 
      WHERE uuid = $7 
      AND is_active = TRUE 
      RETURNING *;`, 
      [category, note_name, note_body, is_pinned, userUuid, access_level || ['general'], noteUuid]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Not updated, note not found.' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Note update failed. Error: ', err);
    res.status(500).json({ error: `Note update failed. Error: [${err.message}]` });
  }
});

/* *********************************************************************************************************/
/* System Related Endpoints                                                                                */
/* *********************************************************************************************************/

// Get the time from the database server to prevent drift in the displayed time
app.get('/api/system/time', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as server_time;');
    res.json({ 
      status: 'Online', 
      serverTime: result.rows[0].server_time
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

/* *********************************************************************************************************/
/* User Management Endpoints (Not Auth!)                                                                   */
/* *********************************************************************************************************/

// Handle saving users with bcryptjs
app.post('/api/users/create', authenticateToken, requireAdmin, async (req, res) => {
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

// Get a list of all users
app.get('/api/users/list', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT uuid, handle, name, vessel_uuid, is_admin, is_active FROM users ORDER BY handle ASC;'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: `Operator Load Failed: ${err.message}` })
  }
});

// This is called ONLY during initial setup when no users exist at all. Once even one user exists, this 
// returns 403.
app.post('/api/users/sysop-init', async (req, res) => {
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

// Delete (well, deactivate) a user
app.post('/api/users/:uuid/delete', authenticateToken, requireAdmin, async (req, res) => {
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

// Update existing users
app.post('/api/users/:uuid/update', authenticateToken, requireAdmin, async (req, res) => {
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

/* *********************************************************************************************************/
/* Vessel Management Endpoints                                                                             */
/* *********************************************************************************************************/

// Get a list of active vessels
app.get('/api/vessels/active', async (req, res) => {
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

// Save a new vessel. This is separate from update as it needs logic for initialisation of the system.
app.post('/api/vessels/create', async (req,res) => {
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
          `INSERT INTO vessels (name, flag_nation, port_of_registry, build_details, official_number, hull_id_number, keel_offset_cm, waterline_offset_cm) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
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

// Get details for the logged-in user's vessel_uuid
app.get('/api/vessels/current', authenticateToken, async (req, res) => {
  try {
    const vesselUuid = req.user.vessel_uuid;
    const result = await pool.query(
      'SELECT uuid, name, flag_nation, port_of_registry, build_details, official_number, hull_id_number, keel_offset_cm, waterline_offset_cm FROM vessels WHERE is_active = TRUE AND uuid = $1;',
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
      vesselKeelOffset: vessel.keel_offset_cm, 
      vesselWaterlineOffset: vessel.waterline_offset_cm, 
      setupRequired: false
    });
  } catch (err) {
    console.error('Error in /api/vessels/current:', err.message); 
    res.status(500).json({ error: 'Database Offline' });
  }
});

// Get a list of all vessels
app.get('/api/vessels/list-all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT v.*, (SELECT COUNT(*)::int FROM users u WHERE u.vessel_uuid = v.uuid AND u.is_active = TRUE) AS active_user_count FROM vessels v ORDER BY v.name ASC;');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: `Vessel Data Load Failed. Error: ${err.message}` });
  }
});

// Register a new vessel
app.post('/api/vessels/register', authenticateToken, async (req, res) => {
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
    const result = await pool.query(
      `INSERT INTO vessels (name, flag_nation, port_of_registry, build_details, official_number, hull_id_number, keel_offset_cm, waterline_offset_cm) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING uuid;`,
      [
        vesselName, 
        vesselFlagNation, 
        vesselPortOfRegistry, 
        vesselBuildDetails, 
        vesselOfficialNumber, 
        vesselHullIdentificationNumber, 
        vesselKeelOffset, 
        vesselWaterlineOffset
      ]
    );
    
    // Log the addition of the new vessel
    await auditLog(pool, result.rows[0].uuid, req.user.uuid, 'Vessel::Register', `New vessel: [${vesselName}], HID: [${vesselHullIdentificationNumber}] registered.`);
    
    res.json({ success: true, uuid: result.rows[0].uuid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ddeactive a vessel.
app.post('/api/vessels/:uuid/deactivate', authenticateToken, requireAdmin, async (req, res) => {
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

// Reactivate a vessel
app.post('/api/vessels/:uuid/reactivate', authenticateToken, requireAdmin, async (req, res) => {
  const targetUuid = req.params.uuid;
  try {
    await pool.query('UPDATE vessels SET is_active = TRUE WHERE uuid = $1;', [targetUuid]);
    const vesselLookup = await pool.query('SELECT name FROM vessels WHERE uuid = $1;', [targetUuid]);
    await auditLog(pool, targetUuid, req.user.uuid, 'Vessel::Reactivate', `Operator: [${req.user.handle}] reactivated the vessel: [${vesselLookup.rows[0]?.name}].`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: `Reactivation Failed: ${err.message}` });
  }
});

// Update an existing vessel
app.post('/api/vessels/:uuid/update', authenticateToken, requireAdmin, async (req, res) => {
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
      'UPDATE vessels SET name = $1, flag_nation = $2, port_of_registry = $3, build_details = $4, official_number = $5, hull_id_number = $6, keel_offset_cm = $7, waterline_offset_cm = $8 WHERE uuid = $9;', 
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
/* Non-endpoint stuff                                                                                      */
/* *********************************************************************************************************/

const PORT = process.env.PORT || config.apiPort || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend online on port ${PORT}`);
});

// Ensure the SPA routing also uses the absolute path
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});
