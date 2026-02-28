/* 
 * Similar to the ImageViewer (can you tell which came first?) this handles the management and display of 
 * files. Those with mimetype well supported by modern browsers (as of early 2026) like PDF, text, MP4, 
 * MP3. etc will be rendered in-situ. Others are present to the user to download via the
 * '/api/files/:uuid/download' endpoint to prevent drive-by downloads.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from './utils/api.js';
import { Plyr } from 'plyr-react';
import 'plyr-react/plyr.css';

const DataViewer = ({ files, initialIndex, onClose, onUpdate }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  const navigate = useCallback((direction) => {
    setIsEditingName(false);
    setRenameError(null);
    setIsConfirmingDelete(false);
    setDeleteError(null);
    setCurrentIndex(prevIndex => {
      let newIndex = prevIndex + direction;
      if (newIndex < 0) newIndex = files.length - 1;
      if (newIndex >= files.length) newIndex = 0;
      return newIndex;
    });
  }, [files.length]);

  // Keyboard navigation.
  const handleKeyUp = useCallback((e) => {
    if (isEditingName) return;

    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  }, [onClose, navigate, isEditingName]);

  // Add and remove keyboard listener
  useEffect(() => {
    window.addEventListener('keyup', handleKeyUp);
    return () => window.removeEventListener('keyup', handleKeyUp);
  }, [handleKeyUp]);

  const currentFile = files[currentIndex];

  // Secure download handler
  const handleSecureDownload = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const res = await apiFetch(`/api/files/${currentFile.uuid}/download`, { method: 'GET' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Download failed. Generic error.');
      }

      // NOTE: See ToDo; This puts the entire file in memory, which is fine while files are limited in 
      //       upload size to Nginx's client_max_body_size value (currently 250MiB). When we want to 
      //       support larger files though, this won't be safe or practical.
      // Convert responce to a blob
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      // Create a temporary link element to trigger the download.
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = currentFile.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup the object URL
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download failed. error', err);
      setDownloadError(`Retrieve failed. Error: [${err.message}]`);
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle rename submission.
  const handleRenameSubmit = async (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      setIsEditingName(false);
      return;
    }
    if (e.key !== 'Enter') return;

    const newName = editedName.trim();
    if (!newName || newName === currentFile.file_name) {
      // Name is blank or unchanged, don't do anything.
      setIsEditingName(false);
      return;
    }

    // Make sure the new name doesn't collide with another file attached to this object.
    if (files.some(f => f.file_name === newName && f.uuid !== currentFile.uuid)) {
      setRenameError("Requested name collides with another record, aborting.");
      return;
    }

    setIsRenaming(true);
    setRenameError(null);
    try {
      const res = await apiFetch(`/api/files/${currentFile.uuid}/rename`, {
        method: 'POST',
        body: JSON.stringify({ new_name: newName })
      });

      // Catch and throw an error if the end-point somehow failed.
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      // We're done, tell the browser to refresh it's file list
      setIsRenaming(false);
      if (onUpdate) await onUpdate();
    } catch (err) {
      console.error('Failed to rename record. Error: ', err);
      setRenameError(`Failed to rename the record. Error: ${err.message}`);
    } finally {
      setIsRenaming(false);
    }
  };

  // Handle deletion (deactivation)
  const handleDelete = async () => {
    // If this is called and we're not confirming the delete, confirm now.
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }

    try {
      const res = await apiFetch(`/api/files/${currentFile.uuid}/delete`, { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (onUpdate) await onUpdate();
      if (files.length <= 1) {
        // Deactivated the last file, close the file viewer.
        onClose();
      } else if (currentIndex >= files.length - 1) {
        // Deactivated the last file in the array, sent them back to the first entry.
        navigate(-1);
      }
    } catch (err) {
      console.error('Removal failed. Error: ', err);
      setDeleteError(`Removal failed. Error: ${err.message}`);
    } finally {
      setIsConfirmingDelete(false);
    }
  };

  // Stable references to prevent Plyr from infinitely unmounting and remounting
  const videoOptions = useMemo(() => ({ controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'fullscreen'] }), []);
  const audioOptions = useMemo(() => ({ controls: ['play', 'progress', 'current-time', 'duration', 'mute', 'volume'] }), []);

  // Safely calculate the source object at the top level of the component
  const plyrSource = useMemo(() => {
    if (!currentFile) return null;
    const mimetype = currentFile.metadata?.mimetype || '';
    const fileUrl = currentFile.file_directory + '/' + currentFile.file_name;
    const isMorphedVideo = mimetype === 'application/octet-stream' && /\.(mov|mp4|webm|mkv)$/i.test(currentFile.file_name);
    
    if (mimetype.startsWith('video/') || isMorphedVideo) {
      return { type: 'video', title: currentFile.file_name, sources: [{ src: fileUrl, type: isMorphedVideo ? 'video/mp4' : mimetype }] };
    }
    if (mimetype.startsWith('audio/')) {
      return { type: 'audio', title: currentFile.file_name, sources: [{ src: fileUrl, type: mimetype }] };
    }
    return null;
  }, [currentFile]);

  // Bail if we've got not file.
  if (!currentFile) return null;

  // Render logic for different file types
  const renderViewportContent = () => {
    const mimetype      = currentFile.metadata?.mimetype || '';
    const isTranscoding = currentFile.metadata?.transcoding === true;
    const fileUrl       = currentFile.file_directory + '/' + currentFile.file_name;
  
    // Central logic to catch videos whose mimetype doesn't start with 'video/'. 
    const isMorphedVideo = mimetype === 'application/octet-stream' && /\.(mov|mp4|webm|mkv)$/i.test(currentFile.file_name);

    // If the video is still transcoding, tell the user to wait.
    if (isTranscoding) {
      return (
        <div className="viewer-fallback-container">
          <span className="viewer-fallback-header flicker">
            Transcoding Operation Active
          </span>
          <span className="soft-text" style={{ textAlign: 'center' }}>
            Video record being transcoded for maximum viewport compatibility. <br />
            Retrieve again later. Time is dependent on size of the video, be patient.
          </span>
        </div>
      );
    }

    // Render the Plyr video UI
    if (mimetype.startsWith('video/') || isMorphedVideo) {
      return (
        <div className="viewer-video">
          <Plyr 
            source={plyrSource} 
            options={videoOptions}
          />
        </div>
      );
    }

    // Render the audio player
    if (mimetype.startsWith('audio/')) {
      return (
        <div className="viewer-audio">
          <Plyr 
            source={plyrSource} 
            options={audioOptions}
          />
        </div>
      );
    }

    if (mimetype === 'application/pdf' || mimetype.startsWith('text/')) {
      // This is one rare case where we have to break the red-only rule. PDFs often have transparent 
      // backgrounds with black text. Text documents render black text of the active background. Similar to
      // all other media, if the user is viewing this behind a 620nm filter, the resulting media will be what
      // it'll be. At least white will render as red fairly cleanly.
      return (
        <iframe src={fileUrl} title={currentFile.file_name} className="viewer-document" />
      );
    }

    // Finally, catch all other document formats we don't recognise as simple downloads 
    return (
      <div class="viewer-fallback-container">
        <span class="viewer-fallback-header">
          No preview available, download to PADD to access.
        </span>
        <button className="touch-button touch-button-affirmative" onClick={handleSecureDownload} disabled={isDownloading}>
          {isDownloading ? 'Receiving transmission...' : 'Retrieve Record'}
        </button>
      </div>
    )
  };

  // Now the page data
  return (
    <div className="file-viewer-backdrop" onClick={onClose}>
      {/* Outer Frame */}
      <div className="file-viewer-frame" onClick={e => e.stopPropagation()}>
        <div className="file-viewer-outer" />

        {/* Inner background layer */}
        <div className="file-viewer-inner">
          {/* Header bar */}
          <div className="file-viewer-header">
            <span className="file-viewer-title">
              Data Record //
              {isEditingName ? (
                <>
                  <input
                    type="text"
                    className="file-viewer-rename-input"
                    value={editedName}
                    onChange={e => {
                      setEditedName(e.target.value);
                      if (renameError) setRenameError(null);
                    }}
                    size={Math.max(15, editedName.length)}
                    onKeyUp={handleRenameSubmit} 
                    onBlurCapture={() => {
                      setIsEditingName(false);
                      setRenameError(null);
                    }}
                    autoFocus
                    disabled={isRenaming}
                  />
                  {renameError && <span className="file-viewer-action-error">{renameError}</span>}
                </>
              ) : (
                <span
                  className="file-viewer-rename-label"
                  title="Engage to rename"
                  onClick={() => {
                    setEditedName(currentFile.file_name);
                    setIsEditingName(true);
                  }}
                >
                  ⌬ {currentFile.file_name}
                </span>
              )}
            </span>
            <span className="file-viewer-index">
              {downloadError && <span className="file-viewer-action-error" style={{ margin: '15px' }}>{downloadError}</span>}
              {deleteError && <span className="file-viewer-action-error">{deleteError}</span>}

              {/* Retrieve download component */}
              <span className="glyph">⍔</span>
              <button className="touch-button touch-button-file-download" onClick={handleSecureDownload} disabled={isDownloading}>
                {isDownloading ? 'Receiving transmission...' : 'Retrieve Record'}
              </button>
              <span className="glyph-remove">⍀</span>
              <button
                className={`file-viewer-delete-button ${isConfirmingDelete ? 'button-confirm-state' : ''}`}
                onClick={handleDelete}
                title="Remove record"
              >
                {isConfirmingDelete ? 'Confirm Removal' : 'Remove'}
              </button>
              <span>
                Index: {String(currentIndex + 1).padStart(2, '0')} / {String(files.length).padStart(2, '0')}
              </span>
            </span>
          </div>

          {/* Viewport area */}
          <div className="file-viewer-viewport">
            {renderViewportContent()}
          </div>

          {/* Bottom control bar */}
          <div className="file-viewer-controls">
            <button onClick={() => navigate(-1)} className="file-viewer-button">
              ⧏
            </button>

            {/* Close Button */}
            <button onClick={onClose} className="file-viewer-button" style={{ lineHeight: '0' }}>
              {/* The ⎚ renders in a way that requires mangling to center */}
              <span style={{ display: 'block', transform: 'translateY(-1px)' }}>
                ⎚
              </span>
            </button>

            {/* Navigation Overlay - Right */}
            <button onClick={() => navigate(1)} className="file-viewer-button">
              ⧐
            </button>
          </div>

          {/* Decorative internal lines */}
          <div className="file-viewer-decoration-line" />
        </div>
      </div>
    </div>
  );
};

export default DataViewer;