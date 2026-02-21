/* 
 * Image viewer component
 */ 

import React, { useState, useEffect, useCallback } from 'react';
import SecurityMedia from './SecurityMedia.jsx';

const ImageViewer = ({ images, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const navigate = useCallback((direction) => {
    setCurrentIndex(prevIndex => {
      let newIndex = prevIndex + direction;
      if (newIndex < 0) newIndex = images.length - 1;
      if (newIndex >= images.length) newIndex = 0;
      return newIndex;
    });
  }, [images.length]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape')     onClose();
    if (e.key === 'ArrowLeft')  navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  }, [onClose, navigate]); // Dependencies will be updated by the navigator

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return() => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const currentImage = images[currentIndex];

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
              Optical Record // {currentImage.file_name}
            </span>
            <span className="image-viewer-index">
              Index: {String(currentIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
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
