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
        backgroundColor: 'rgba(0, 0, 0, 0.95)', 
        backdropFilter: 'blur(5px)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center'
      }}>

      {/* Main container - prevent click propagation so clicking images  */}
      {/* Outer boder layer */}
      <div className="image-viewer-frame" onClick={e => e.stopPropagation()} 
        style={{
          position: 'relative', 
          width: '95vw', 
          height: '90vh', 
          maxWidth: '1400px', 
          filter: 'drop-shadow(0 0 15px rgba(255, 0, 0, 0.15))' 
        }}
      >
        {/* solid red background explicitely bound via absolute positioning */}
        <div 
          style={{
            position: 'absolute', 
            inset: 0, 
            backgroundColor: 'var(--mid-red)', 
            clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 40px), calc(100% - 40px) 100%, 0 100%)'
          }}
        />

        {/* Inner Background layer */}
        <div 
          style={{
            position: 'absolute', 
            inset: '1px', /* This gives us our 1px border that includes the champfer */
            backgroundColor: 'var(--dark-bg)', 
            display: 'flex', 
            flexDirection: 'column',
            clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 39px), calc(100% - 39px) 100%, 0 100%)' 
          }}
        >
          {/* Header bar */}
          <div 
            style={{
              height: '40px', 
              borderBottom: '1px solid var(--soft-red)', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '0px 20px', 
              backgroundColor: 'rgba(20, 0, 0, 0.8)', 
              zIndex: '2'
            }}>
            <span 
              style={{
                fontFamily: "'Oxanium', sans-serif", 
                letterSpacing: '2px', 
                color: 'var(--strong-red)', 
                fontSize: '0.9rem'
              }}
            >
              Optical Record // {currentImage.file_name}
            </span>
            <span 
              style={{
                fontFamily: "'Ubuntu Sans Mono', monospace", 
                color: 'var(--mid-red)', 
                fontSize: '0.9rem'
              }}
            >
              Index: {String(currentIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
            </span>
          </div>

          {/* Image Viewport */}
          <div 
            style={{
              flex: 1, 
              position: 'relative', 
              overflow: 'hidden', 
              backgroundColor: 'var(--dark-bg)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '20px'
            }}
          >
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
          <div 
            style={{
              height: '60px', 
              borderTop: '1px solid var(--dim-red)', 
              display: 'flex',  
              justifyContent: 'space-between', 
              alignItems: 'center', 
              gap: '30px', 
              backgroundColor: 'rgba(20, 0, 0, 0.9)', 
              padding: '0 60px' // Buffer for the champfer cut with symetric spacing around the close button.
            }}
          >
            {/* Previous Image Button */}
            <button 
              onClick={() => navigate(-1)} 
              style={{
                background: 'transparent', 
                border: '1px solid var(--soft-red)', 
                color: 'var(--neon-red)', 
                fontSize: '1.5rem', 
                width: '50px', 
                height: '40px', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center'
              }} 
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--soft-red)'; e.currentTarget.style.color = 'var(--dark-bg)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--neon-red)'; }}
            >
              ⧏
            </button>

            {/* Close Button */}
            <button 
              onClick={onClose} 
              style={{
                background: 'transparent', 
                border: '1px solid var(--soft-red)', 
                color: 'var(--neon-red)', 
                fontSize: '1.5rem', 
                width: '50px', 
                height: '40px', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                lineHeight: '0' /* Kills the font's internal height box */
              }} 
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--soft-red)'; e.currentTarget.style.color = 'var(--dark-bg)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--neon-red)'; }}
            >
              <span style={{ display: 'block', transform: 'translateY(-1px)' }}>
                ⎚
              </span>
            </button>

            {/* Navigation Overlay - Right */}
            <button 
              onClick={() => navigate(1)} 
              style={{
                background: 'transparent', 
                border: '1px solid var(--soft-red)', 
                color: 'var(--neon-red)', 
                fontSize: '1.5rem', 
                width: '50px', 
                height: '40px', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center'
              }} 
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--soft-red)'; e.currentTarget.style.color = 'var(--dark-bg)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--neon-red)'; }}
            >
              ⧐
            </button>
          </div>
        </div>

        {/* Decorative internal lines */}
        <div 
          style={{ 
            position: 'absolute', 
            top: '40px', 
            left: 0, 
            right: 0, 
            height: '1px', 
            background: 'var(--dim-red)', 
            opacity: 0.5 
          }} 
        />
      </div>
    </div>
  );
};

export default ImageViewer;
