/* 
 * Handles files and images attached to vessels.
 */ 
import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from './utils/api.js';

const VesselMedia = ({ vessel, mode = 'file' }) => {
  const [mediaItems, setMediaItems]   = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError]             = useState(null);

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
  }, [vessel, mode]);

  // Fetch files when the vessel changes
  useEffect(() => {
    if (vessel?.uuid) fetchMedia();
  }, [vessel, mode, fetchMedia]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      console.warn('The handleUpload() was called without a file being passed in.');
      return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('referenceTable', 'vessels'); 
    formData.append('file', file);

    try {
      const token = localStorage.getItem('muirgen_token');
      const res   = await fetch(`/api/system/${vessel.uuid}/upload`, {
        method: 'POST',
        headers: { 'Authorization' : `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        fetchMedia();
      } else {
        const err = await res.json();
        setError(err.error || 'Upload Failed; Unknown reason');
      }
    } catch(err) {
      setError(`Comms lost during upload. Error: ${err}`);
    } finally {
      setIsUploading(false);
      e.target.value = null;
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

  const renderImageCard = (file) => (
    <div key={file.uuid} className="media-card">
        <div className="media-thumbnail">
          <img src={file.file_directory + '/' + file.file_name} alt={file.file_name} />
        </div>
        <div className="media-info">
          <span>{file.file_name}</span>
          <a href={file.file_directory + '/' + file.file_name} target="_blank" rel="noreferred">Open</a>
        </div>
    </div>
  );

  return (
    <div className="vessel-media-container">
      {/* Upload bar */}
      <div className="action-bar-container" style={{ marginTop: '0', marginBottom: '20px' }}>
        <div className="action-group-horizontal">
          <label className="touch-button" style={{ cursor: 'pointer', fontSize: '1rem', padding: '10px 20px' }}>
            {mode === 'image' ? '┻ Upload Visual Record' : '┻ Upload Data Record'}
            <input type="file" onChange={handleUpload} accept={mode === 'image' ? "image/*" : "*/*"} style={{ display: 'none' }} />
          </label>
          {isUploading && <span className="flicker-text" style={{ marginLeft: '15px' }}> Transmitting...</span>}
        </div>
        {error && <span className="status-display-error" style={{ marginLeft: '20px' }}>{error}</span>}
      </div>

      {/* Content Area */}
      {mediaItems.length === 0 ? (
        <div className="soft-text">No records exist for this object.</div>
      ) : (
        mode === 'image' ? (
          <div className="soft-text">
            {mediaItems.map(renderImageCard)}
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
    </div>
  );
}

export default VesselMedia;