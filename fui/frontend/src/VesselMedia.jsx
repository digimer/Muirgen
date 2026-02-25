/* 
 * Handles files and images attached to vessels.
 */ 
import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from './utils/api.js';
import { uploadMedia } from './utils/media.js';
import SecurityMedia from './SecurityMedia.jsx';
import ImageViewer from './ImageViewer.jsx';
import DataViewer from './DataViewer.jsx';

const VesselMedia = ({ vessel, mode = 'file' }) => {
  const [mediaItems, setMediaItems]                 = useState([]);
  const [isUploading, setIsUploading]               = useState(false);
  const [error, setError]                           = useState(null);
  // Stores the index number of the image/file being viewed. 'null' means none are shown
  const [selectedFileIndex, setSelectedFileIndex]   = useState(null);
  // Store files in queue until the user confirms the upload.
  const [stagedFiles, setStagedFiles]               = useState([]);
  // Controls visibility of the empty statging drop-zone. 
  const [isStagingModalOpen, setIsStagingModalOpen] = useState(false);

  const fetchMedia = useCallback(async () => {
    try {
      // Note: If later we want to filter by images or other files, here's where we'd do it. For now, bulk
      //       load everything for the vessel.
      const res = await apiFetch(`/api/files/${vessel.uuid}/list`)
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
    // Force the modal open if we successfully paste something
    setIsStagingModalOpen(true);
    e.target.value = null; // Reset input so you can click "add" again.
  };

  // Allow the user to remove files from the queue before uploading.
  const removeStagedFile = (indexToRemove) => {
    setStagedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // Helper to check if a staged file shares a name with an already uploaded file. This checks against files
  // that will be converted using the target name as they'll become post-processing.
  const isDuplicate = (fileName) => {
    let expectedServerName = fileName.replace(/\.(heic|heif)$/i, '.jpg');
        expectedServerName = expectedServerName.replace(/\.(mov|m4v|webm)$/i, '.mp4');
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
      setStagedFiles([]);           // Clear staging array on success
      setIsStagingModalOpen(false); // Close the queue, assume they're done.
      fetchMedia();                 // Refresh the grid
    } catch (err) {
      setError(`Upload incomplete. Error: [${err.message}]`);
    } finally {
      setIsUploading(false);
    }
  };

  // Catch paste events and extract files (used for catching screenshots or copied images)
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const pastedFiles = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) {
          // Pasted items often get generic names, so we'll create one that's a bit more useful.
          const extension   = file.type.split('/')[1] || 'png';
          const finalName   = file.name === 'image.png' ? `pasted-record_${Date.now()}.${extension}` : file.name;
          const renamedFile = new File([file], finalName, { type: file.type });

          pastedFiles.push(renamedFile);
        }
      }
    }

    if (pastedFiles.length > 0) {
      setStagedFiles(prev => {
        // Apply the same duplicate filtering (by name or size+mimetype) and alphabetic sort used in normal
        // upload queueing.
        const newFiles = pastedFiles.filter(
          incoming => !prev.some(existing => existing.name === incoming.name || existing.size === incoming.size)
        );
        const combined = [...prev, ...newFiles];
        combined.sort((a, b) => a.name.localeCompare(b.name));
        return combined;
      });
      // Force the modal open if we successfully paste something
      setIsStagingModalOpen(true);
    }
  }, [setStagedFiles]);

  // When the staging queue is open, enable pasting anywhere on the screen
  useEffect(() => {
    if (isStagingModalOpen) {
      document.addEventListener('paste', handlePaste);
    }

    // Cleanup
    return () => {
      document.removeEventListener('paste', handlePaste);
    }; 
  }, [isStagingModalOpen, handlePaste]);

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
      <td style={{ color: 'var(--neon-red' }}>{file.file_name}</td>
      <td>{formatSize(file.metadata?.size || 0)}</td>
      <td>{new Date(file.created_at || Date.now()).toLocaleDateString()}</td>
      <td style={{ textAlign: 'right' }}>
        <button className="touch-button touch-button-retrieve" onClick={() => setSelectedFileIndex(mediaItems.findIndex(f => f.uuid === file.uuid))}>
          Retrieve
        </button>
      </td>
    </tr>
  );

  const renderImageCard = (file, index) => (
    <div 
      key={file.uuid} 
      className="media-card" 
      onClick={() => setSelectedFileIndex(index)} 
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
          <button className="touch-button" onClick={() => setIsStagingModalOpen(true)}>
            {mode === 'image' ? 'Upload Visual Record' : 'Upload Data Record'}
          </button>
          {isUploading && <span className="flicker-text" style={{ marginLeft: '15px' }}> Transmitting...</span>}
        </div>
        {error && <span className="status-display-error" style={{ marginLeft: '20px' }}>{error}</span>}
      </div>

      {/* Staging UI blocks */}
      {isStagingModalOpen && (
        <div 
          className="staging-queue-container" 
          onPaste={handlePaste} 
          tabIndex={0}
        >
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
          
          {stagedFiles.length === 0 && (
            <div className="soft-text" style={{ marginBottom: '15px '}}>Copy from Memory Enabled</div>
          )}

          <div className="staging-queue-controls">
            <label className="touch-button" style={{ cursor: 'pointer' }}>
              Load
              <input type="file" multiple onChange={handleFileSelect} accept={mode === 'image' ? "image/*" : "*/*"} style={{ display: 'none' }} />
            </label>
            <button 
              className="touch-button touch-button-affirmative" 
              onClick={executeUpload} 
              disabled={isUploading || stagedFiles.every(file => isDuplicate(file.name))} 
            >
              Transmit
            </button>
            <button className="touch-button" onClick={() => {setStagedFiles([]); setIsStagingModalOpen(false);}} disabled={isUploading}>
              End
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      {mediaItems.length === 0 ? (
        <div className="user-list" style={{ height: 'fit-content' }}>
          <div className="empty-list">No records exist for this object.</div>
        </div>
      ) : (
        <div className={`scrollable-media-box ${isStagingModalOpen ? 'queue-open' : ''}`}>
          {mode === 'image' ? (
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
          )}
        </div>
      )}

      {/* Render the ImageViewer if an image is selected */}
      {selectedFileIndex !== null && mode === 'image' && (
        <ImageViewer 
          images={mediaItems} 
          initialIndex={selectedFileIndex} 
          onClose={() => setSelectedFileIndex(null)}
          onUpdate={fetchMedia}
        />
      )}

      {/* Render the DataViewer if a file is selected */}
      {selectedFileIndex !== null && mode === 'file' && (
        <DataViewer 
          files={mediaItems}
          initialIndex={selectedFileIndex}
          onClose={() => setSelectedFileIndex(null)}
          onUpdate={fetchMedia}
        />
      )}
    </div>
  );
}

export default VesselMedia;