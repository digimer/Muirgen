/* 
 * Handles files and images attached to vessels.
 */ 
import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from './utils/api.js';
import { uploadMedia } from './utils/media.js';
import SecurityMedia from './SecurityMedia.jsx';
import ImageViewer from './ImageViewer.jsx';

const VesselMedia = ({ vessel, mode = 'file' }) => {
  const [mediaItems, setMediaItems]   = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError]             = useState(null);
  // Stores the index number of the image being viewed. 'null' means none are shown
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  // Store files in queue until the user confirms the upload.
  const [stagedFiles, setStagedFiles] = useState([]);

  const fetchMedia = useCallback(async () => {
    try {
      // Note: If later we want to filter by images or other files, here's where we'd do it. For now, bulk
      //       load everything for the vessel.
      const res = await apiFetch(`/api/system/${vessel.uuid}/files`)
      if (res.ok) {
        const data     = await res.json();
        const filtered = data.filter(item => mode === 'image' ? item.file_type === 'image' : item.file_type !== 'image' );
        setMediaItems(filtered);
      }
    } catch (err) {
      console.error(`Failed to load the files. Error: ${err}`);
    }
  }, [vessel, mode])

  // Fetch files when the vessel changes
  useEffect(() => {
    if (vessel?.uuid) fetchMedia();
  }, [vessel, mode, fetchMedia]);

  // Intercept files and store them until the user confirms.
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return; // No files, why here?

    setStagedFiles(prev => {
      // Filter out files that already exist in the queue (by name)
      const newFiles = files.filter(
        incoming => !prev.some(existing => existing.name === incoming.name)
      );

      // Combine the existing queue with the new (unique) files
      const combined = [...prev, ...newFiles];

      // Sort the queue alphabetically by file name.
      combined.sort((a, b) => a.name.localeCompare(b.name));

      return combined;
    });
    e.target.value = null; // Reset input so you can click "add" again.
  };

  // Allow the user to remove files from the queue before uploading.
  const removeStagedFile = (indexToRemove) => {
    setStagedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // Helper to check if a staged file shares a name with an already uploaded file.
  const isDuplicate = (fileName) => {
    const expectedServerName = fileName.replace(/\.(heic|heif)$/i, '.jpg');
    return mediaItems.some(item => item.file_name === expectedServerName);
  };

  // The actual upload execution loop
  const executeUpload = async () => {
    if (stagedFiles.length === 0) return; // No files left

    setIsUploading(true);
    setError(null);

    try {
      // Execute uploads sequentially so we don't flood the server with a lot of parallel requests.
      for (const file of stagedFiles) {
        if (!isDuplicate(file.name)) {
          await uploadMedia(file, vessel.uuid, 'vessels');
        }
      }
      setStagedFiles([]); // Clear staging array on success
      fetchMedia();       // Refresh the grid
    } catch (err) {
      setError(`Upload incomplete. Error: [${err.message}]`);
    } finally {
      setIsUploading(false);
    }
  };

  // Helper to format file size
  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k     = 1024;   // In this house, we respect Base 2
    const sizes = ['B', 'KiB', 'MiB', 'GiB'];
    const i     = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Renderers
  const renderFileRow = (file) => (
    <tr key={file.uuid}>
      <td style={{ color: 'var(--neon-red'}}>{file.file_name}</td>
      <td>{formatSize(file.metadata?.size || 0)}</td>
      <td>{new Date(file.created_at || Date.now()).toLocaleDateString()}</td>
      <td style={{ textAlign: 'right' }}>
        <a
          href={file.file_directory + '/' + file.file_name}
          target="_blank"
          rel="noreferrer"
          className="touch-button"
          style={{ padding: '5px 10px', fontSize: '0.8rem', textDecoration: 'none' }}
        >
          Access
        </a>
      </td>
    </tr>
  );

  const renderImageCard = (file, index) => (
    <div 
      key={file.uuid} 
      className="media-card" 
      onClick={() => setSelectedImageIndex(index)} 
      style={{
        cursor: 'pointer', 
        padding: '1px', /* Creates the red border */
        backgroundColor: 'var(--mid-red)', 
        display: 'flex', 
        flexDirection: 'column'
      }}
    >
      {/* Inner dark layer that contains everything */}
      <div 
        style={{
          flex: 1,
          backgroundColor: 'var(--dark-bg)', 
          clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 19px), calc(100% - 19px) 100%, 0 100%)', 
          display: 'flex', 
          flexDirection : 'column'
        }}
      >
        {/* Thumbnail viewport with the thick black border built into the CSS padding via .media-thumbnail */}
        <div className="media-thumbnail">
          <SecurityMedia 
            src={file.file_directory + '/' + file.file_name} 
            alt={file.file_name} 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover' /* Using 'cover' crops the image's thumbnail to always fill the 4:3 ratio thumbnail. If we decide to make it retain the full image, switch to 'contain' */
             }}
          />
        </div>

        {/* Info bar */}
        <div className="media-info">
          <span>{file.file_name}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="vessel-media-container">
      {/* Upload bar */}
      <div className="action-bar-container" style={{ marginTop: '0', marginBottom: '20px' }}>
        <div className="action-group-horizontal">
          <span className="tab-icon">⍍</span>
          <label className="touch-button" style={{ cursor: 'pointer', fontSize: '1rem', padding: '10px 20px' }}>
            {mode === 'image' ? 'Upload Visual Record' : 'Upload Data Record'}
            <input type="file" multiple onChange={handleFileSelect} accept={mode === 'image' ? "image/*" : "*/*"} style={{ display: 'none' }} />
          </label>
          {isUploading && <span className="flicker-text" style={{ marginLeft: '15px' }}> Transmitting...</span>}
        </div>
        {error && <span className="status-display-error" style={{ marginLeft: '20px' }}>{error}</span>}
      </div>

      {/* Staging UI blocks */}
      {stagedFiles.length > 0 && (
        <div className="staging-queue-container">
          <h4 className="staging-queue-title">Queued:</h4>
          <ul className="staging-queue-list">
            {stagedFiles.map((file, index) => {
              const isDupe = isDuplicate(file.name);
              return (
                <li key={index} className="staging-queue-item">
                    {isDupe ? (
                      <>
                        <span className="staging-queue-filename duplicate">{file.name} ({formatSize(file.size)})</span>
                        <div className="staging-queue-actions">
                          <span className="staging-queue-action-text duplicate">Duplicate</span>
                          <span className="staging-queue-action-glyph duplicate">⌀</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="staging-queue-filename valid">{file.name} ({formatSize(file.size)})</span>
                        <div className="staging-queue-actions">
                          <span className="staging-queue-action-text valid" onClick={() => removeStagedFile(index)}>Reject</span>
                          <span className="staging-queue-action-glyph valid" onClick={() => removeStagedFile(index)}>⬎</span>
                        </div>
                      </>
                    )}
                  </li>
              )
            })}
          </ul>
          <div className="staging-queue-controls">
            <button 
              className="touch-button touch-button-affirmative" 
              onClick={executeUpload} 
              disabled={isUploading || stagedFiles.every(file => isDuplicate(file.name))} 
            >
              Begin Transmission
            </button>
            <button className="touch-button" onClick={() => setStagedFiles([])} disabled={isUploading}>
              Abort
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      {mediaItems.length === 0 ? (
        <div className="soft-text">No records exist for this object.</div>
      ) : (
        mode === 'image' ? (
          <div className="media-grid">
            {mediaItems.map((file, index) => renderImageCard(file, index))}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Size</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {mediaItems.map(renderFileRow)}
            </tbody>
          </table>
        )
      )}

      {/* Render the ImageViewer if an image is selected */}
      {selectedImageIndex !== null && (
        <ImageViewer 
          images={mediaItems} 
          initialIndex={selectedImageIndex} 
          onClose={() => setSelectedImageIndex(null)}
        />
      )}
    </div>
  );
}

export default VesselMedia;