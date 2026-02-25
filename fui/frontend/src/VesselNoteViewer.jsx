/* 
 * This is the Vessel Note Viewer to show rendered, uneditable logs.
 */ 

import React, { useState, useEffect, useCallback } from 'react';
import { formatMuirgenDate } from './utils/formatters.js';

const VesselNoteViewer = ({ notes, initialIndex, onClose, onEdit }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const navigate = useCallback((direction) => {
    setCurrentIndex(prevIndex => {
      let newIndex = prevIndex + direction;
      if (newIndex < 0) newIndex = notes.length - 1;
      if (newIndex >= notes.length) newIndex = 0;
      return newIndex;
    });
  }, [notes.length]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape')     onClose();
    if (e.key === 'ArrowLeft')  navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
    if (e.key === 'e' || e.key === 'E') {
      // Quick edit shortcut with the index the user is viewing
      onEdit(notes[currentIndex], currentIndex);
    }
  }, [onClose, navigate, onEdit, notes, currentIndex]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const currentNote = notes[currentIndex];
  if (!currentNote) return null;

  return (
    <div className="file-viewer-backdrop" onClick={onClose}>
      <div className="file-viewer-frame" onClick={e => e.stopPropagation()}>
        <div className="file-viewer-outer" />
        <div className="file-viewer-inner">

          {/* Header bar */}
          <div className="file-viewer-header">
            <span className="file-viewer-title" style={{ color: 'var(--mid-red)' }}>
              Log Viewer // {currentNote.category}
            </span>
            <span className="file-viewer-index">
              <span style={{ marginLeft: '15px' }}>
                Index: {String(currentIndex + 1).padStart(2, '0')} / {String(notes.length).padStart(2, '0')}
              </span>
            </span>
          </div>

          {/* Sci-Fi BBS / Console Viewport */}
          <div className="image-viewer-viewport note-console-viewport">

            {/* BBS Header Simulation */}
            <div className="note-bbs-header-outer">
              <div className="note-console-inner">
                <strong className="note-console-subject">Subject: {currentNote.note_name}</strong>
                <div className="note-console-header">
                  <span>mtime: {formatMuirgenDate(currentNote.modified_date)}</span>
                    <button 
                    className="touch-button small-button note-viewer-button" 
                    onClick={() => onEdit(currentNote, currentIndex)} 
                    title="Edit Record"
                  >
                    Amend Log
                  </button>
                </div>
              </div>
              <div className="note-console-access">
                Access: {currentNote.access_level.join(' | ').toUpperCase()}
              </div>
            </div>

            {/* Note Content (Reusing the Tiptap style target to maintain visual consistency) */}
            <div className="tiptap-editor-area note-console-body" dangerouslySetInnerHTML={{ __html: currentNote.note_body }}/>

            {/* EOF marker */}
            <div className="note-console-eof">
              --- EOF ---
            </div>
          </div>

          {/* Bottom control bar */}
          <div className="file-viewer-controls">
            <button onClick={() => navigate(-1)} className="file-viewer-button">⧏</button>
            <button onClick={onClose} className="file-viewer-button" style={{ lineHeight: '0' }}>
              <span style={{ display: 'block', transform: 'translateY(-1px)' }}>⎚</span>
            </button>
            <button onClick={() => navigate(1)} className="file-viewer-button">⧐</button>
          </div>

        </div>
        <div className="file-viewer-decoration-line" />
      </div>
    </div>
  );
};

export default VesselNoteViewer;
