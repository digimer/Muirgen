/* 
 * Image viewer component
 */ 

import React, { useState, useEffect, useCallback } from 'react';
import SecurityMedia from './SecurityMedia.jsx';
import { apiFetch } from './utils/api.js'; 

const ImageViewer = ({ images, initialIndex, onClose, onUpdate }) => {
  const [currentIndex, setCurrentIndex]             = useState(initialIndex);
  const [isEditingName, setIsEditingName]           = useState(false); 
  const [editedName, setEditedName]                 = useState('');
  const [isRenaming, setIsRenaming]                 = useState(false);
  const [renameError, setRenameError]               = useState(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError]               = useState(null);

  const navigate = useCallback((direction) => {
    setIsEditingName(false);
    setRenameError(null);
    setIsConfirmingDelete(false);
    setDeleteError(null);
    setCurrentIndex(prevIndex => {
      let newIndex = prevIndex + direction;
      if (newIndex < 0) newIndex = images.length - 1;
      if (newIndex >= images.length) newIndex = 0;
      return newIndex;
    });
  }, [images.length]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (isEditingName) return; // Disable navigation while editing the name

    if (e.key === 'Escape')     onClose();
    if (e.key === 'ArrowLeft')  navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  }, [onClose, navigate, isEditingName]); // Dependencies will be updated by the navigator

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return() => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const currentImage = images[currentIndex];

  // Handle the actual rename submission
  const handleRenameSubmit = async (e) => {
    if (e.key === 'Escape') {
      setIsEditingName(false);
      return;
    }
    if (e.key !== 'Enter') return;

    // The user hit enter, validate the new name
    const newName = editedName.trim();
    if (!newName || newName === currentImage.file_name) {
      // Empty or unchanged, either way, return.
      setIsEditingName(false);
      return;
    }

    // Check for a name collidion against the other file names already in memory.
    if (images.some(img => img.file_name === newName && img.uuid !== currentImage.uuid)) {
      setRenameError("New name duplicates existing record.");
      return;
    }

    setIsRenaming(true);
    setRenameError(null);
    try {
      // Wait for the backend PUT request.
      const res = await apiFetch(`/api/system/files/${currentImage.uuid}/rename`, {
        method: 'PUT', 
        body: JSON.stringify({ new_name: newName })
      });

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setIsEditingName(false);
      if (onUpdate) {
        // Tell VesselMedia to siltently refresh
        await onUpdate();
      }
    } catch (err) {
      console.error('Failed to change the name. Error: ', err);
      setRenameError(`Rename failed. Error: ${err.message}`);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    // Confirm intent to delete
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }

    try {
      // Wait for the backend PUT request.
      const res  = await apiFetch(`/api/system/files/${currentImage.uuid}/delete`, { method: 'PUT' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Tell the VesselMedia to silently refresh
      if (onUpdate) await onUpdate();

      // Adjust the viewer index so it doesn't crash on an out-of-bounds array when the background refresh
      // completes and the image count drops by 1.
      if (images.length <= 1) {
        // The user removed the last/only image.
        onClose();
      } else if (currentIndex >= images.length - 1) {
        // The user removed the last image in the array, step back one image.
        navigate(-1);
      }

    } catch (err) {
      console.error('Deactivation failed. Error: ', err);
      setDeleteError(`Deactivation failed. Error: [${err.message}]`);
    } finally {
      setIsConfirmingDelete(false);
    }
  };

  if (!currentImage) return null;

  return (
    <div className="image-viewer-backdrop" onClick={onClose}>

      {/* Main container - prevent click propagation so clicking images  */}
      {/* Outer boder layer */}
      <div className="image-viewer-frame" onClick={e => e.stopPropagation()}>
        {/* solid red background explicitely bound via absolute positioning */}
        <div className="image-viewer-outer" />

        {/* Inner Background layer */}
        <div className="image-viewer-inner">
          {/* Header bar */}
          <div className="image-viewer-header">
            <span className="image-viewer-title">
              Optical Record // 
              {isEditingName ? (
                <>
                  <input 
                    type="text" 
                    className="image-viewer-rename-input" 
                    value={editedName}
                    onChange={e => {
                      setEditedName(e.target.value);
                      if (renameError) setRenameError(null);
                    }} 
                    size={Math.max(15, editedName.length)}
                    onKeyDown={handleRenameSubmit} 
                    onBlurCapture={() => {
                      setIsEditingName(false);
                      setRenameError(null); 
                    }}  // Close if they click outside the input
                    autoFocus 
                    disabled={isRenaming}
                  />
                  {renameError && <span className="image-viewer-action-error">{renameError}</span>}
                </>
              ) : (
                <span 
                  className="image-viewer-rename-label" 
                  title="Engage to rename" 
                  onClick={() => {
                    setEditedName(currentImage.file_name); 
                    setIsEditingName(true); 
                  }}
                >
                  ⌬ {currentImage.file_name}
                </span>
              )}
            </span>
            <span className="image-viewer-index">
              {deleteError && <span className="image-viewer-action-error">{deleteError}</span>}
              <span className="glyph-remove">⍀</span>
              <button 
                className={`image-viewer-delete-button ${isConfirmingDelete ? 'button-confirm-state' : ''}`} 
                onClick={handleDelete} 
                title="Remove Record"
              >
                {isConfirmingDelete ? 'Confirm Removal' : 'Remove'}
              </button>
              <span>
                Index: {String(currentIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
              </span>
            </span>
          </div>

          {/* Image Viewport */}
          <div className="image-viewer-viewport">
            {/* Main Image */}
            <SecurityMedia 
              src={currentImage.file_directory + '/' + currentImage.file_name} 
              alt={currentImage.file_name} 
              style={{
                width: '100%', 
                height: '100%', 
                objectFit: 'contain', 
                filter: 'drop-shadow(0 0 10px rgba(0, 0, 0, 0.8))'
              }}
            />
          </div>
          
          {/* Bottom control bar */}
          <div className="image-viewer-controls">
            {/* Previous Image Button */}
            <button onClick={() => navigate(-1)} className="image-viewer-button">
              ⧏
            </button>

            {/* Close Button */}
            <button onClick={onClose} className="image-viewer-button" style={{ lineHeight: '0' }}>
              <span style={{ display: 'block', transform: 'translateY(-1px)' }}>
                ⎚
              </span>
            </button>

            {/* Navigation Overlay - Right */}
            <button onClick={() => navigate(1)} className="image-viewer-button">
              ⧐
            </button>
          </div>
        </div>

        {/* Decorative internal lines */}
        <div className="image-viewer-decoration-line" />
      </div>
    </div>
  );
};

export default ImageViewer;
