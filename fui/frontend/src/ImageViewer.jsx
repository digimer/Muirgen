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
    <div className="image-viewer-backdrop" onClick={onClose} 
      style={{
        position: 'fixed',
        inset: 0, 
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.9)', 
        backdropFilter: 'blur(5px)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center'
      }}>
      {/* Main container - prevent click propagation so clicking images  */}
      <div className="image-viewer-frame" onClick={e => e.stopPropagation()} 
        style={{
          position: 'relative', 
          width: '90vw', 
          height: '85vw', 
          border: '2px solid var(--neon-red)', 
          backgroundColor: 'var(--dark-bg)', 
          boxShadow: '0 0 20px var(--neon-red), inset 0 0 20px rgba(255, 0, 0, 0.2)', 
          display: 'flex', 
          flexDirection: 'column'
        }}>
        
        {/* Header / telemetry line */}
        <div 
          style={{
            padding: '10px 20px', 
            borderBottom: '1px solid var(--neon-red)', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            fontFamily: "'Oxanium', sans-serif", 
            letterSpacing: '2px', 
            color: 'var(--soft-red)'
          }}>
          <span>Optical Record // {currentImage.file_name}</span>
          <span>Index: {String(currentIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}</span>
        </div>

        {/* Image Area */}
        <div 
          style={{
            flex: 1, 
            position: 'relative', 
            overflow: 'hidden', 
            display: 'flex'
          }}
        >
          
          {/* Navigation Overlay - Left */}
          <div onClick={() => navigate(-1)} 
            style={{
              position: 'absolute', 
              left: 0, 
              top: 0, 
              bottom: 0, 
              width: '10%',
              cursor: 'pointer',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              zIndex: 10,
              opacity: 0, 
              transition: 'opacity 0.2s'
            }} 
            onMouseEnter={e => e.currentTarget.style.opacity = 0.5} 
            onMouseLeave={e => e.currentTarget.style.opacity = 0}
          >
            <span 
              style={{ 
                fontSize: '4rem', 
                color: 'var(--neon-red)', 
                textShadow: '0 0 10px red'
              }}>
                ⍃
              </span>
          </div>

          <SecurityMedia 
            src={currentImage.file_directory + '/' + currentImage.file_name} 
            alt={currentImage.file_name} 
            style={{
              width: '100%', 
              height: '100%', 
              objectFit: 'contain'
            }}
          />

          {/* Navigation Overlay - Right */}
          <div onClick={() => navigate(1)} 
            style={{
              position: 'absolute', 
              left: 0, 
              top: 0, 
              bottom: 0, 
              width: '10%',
              cursor: 'pointer',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              zIndex: 10,
              opacity: 0, 
              transition: 'opacity 0.2s'
            }} 
            onMouseEnter={e => e.currentTarget.style.opacity = 0.5} 
            onMouseLeave={e => e.currentTarget.style.opacity = 0}
          >
            <span 
              style={{ 
                fontSize: '4rem', 
                color: 'var(--neon-red)', 
                textShadow: '0 0 10px red' 
              }}>
                ⍄
              </span>
          </div>
          
          {/* Footer / Exit Button */}
          <div 
            style={{
              padding: '10px', 
              borderTop: '1px solid var(--dim-red)', 
              display: 'flex', 
              justifyContent: 'flex-end'
            }}
          >
            <button 
              className="touch-button" 
              onClick={onClose} 
              style={{ 
                padding: '8px 20px', 
                fontSize: '0.9rem' 
              }}>
                ⍂
              </button>
          </div>

          {/* Corner decor for the cassette futurism aesthetic */}
          <div 
            style={{
              position: 'absolute', 
              top: '-2px', 
              left: '-2px', 
              width: '20px', 
              height: '20px', 
              borderTop: '4px solid var(--neon-red)', 
              borderLeft: '4px solid var(--neon-red)'
            }}
          />
          <div 
            style={{
              position: 'absolute', 
              bottom: '-2px', 
              right: '-2px', 
              width: '20px', 
              height: '20px', 
              borderBottom: '4px solid var(--neon-red)', 
              borderRight: '4px solid var(--neon-red)'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ImageViewer;
