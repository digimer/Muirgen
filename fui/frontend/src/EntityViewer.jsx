/* 
 * This is the boiler plate for display an entity's profile or specs in a read-only format. It allows rapid 
 * navigation though IDs from the parent, with key bindings to move to the editing page and back.
 */ 

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from './utils/api.js';
import { formatMuirgenDate } from './utils/formatters.js';
import EntityNoteViewer from './EntityNoteViewer.jsx';

const EntityViewer = ({ entities, initialIndex, notesTitle = "Logs", onEdit, onClose, onNoteSelect, onAddNote, children }) => {
  const [currentIndex, setCurrentIndex]         = useState(initialIndex);
  const [avatarUrl, setAvatarUrl]               = useState(null);
  const [notes, setNotes]                       = useState([]);
  const [isLoading, setIsLoading]               = useState(true);
  const [viewingNoteIndex, setViewingNoteIndex] = useState(null);
  const currentEntity = entities[currentIndex];
  const entityId = currentEntity?.uuid;

  const navigate = useCallback((direction) => {
    setCurrentIndex(prevIndex => {
      let newIndex = prevIndex + direction;
      if (newIndex < 0) newIndex = entities.length - 1;
      if (newIndex >= entities.length) newIndex = 0;
      return newIndex;
    });
  }, [entities.length]);

  const loadEntityData = useCallback(async () => {
    if (!entityId) return;
    setIsLoading(true);

    // Fetch files to find the avatar, if any.
    try {
      const filesRes = await apiFetch(`/api/files/${entityId}/list`);
      if (filesRes.ok) {
        const files = await filesRes.json();
        const avatarImage = files.find(f => f.file_type === 'image' && f.metadata?.avatar === true);

        if (avatarImage) {
          setAvatarUrl(`${avatarImage.file_directory}/${avatarImage.file_name}`);
        } else {
          setAvatarUrl(null);
        }
      }
    } catch(err) { 
      console.error("EntityViewer file load failure. Error: :", err);
    }

    // Fetch notes, if any exist for this entity.
    try {
      const notesRes = await apiFetch(`/api/notes/${entityId}/list`);
      if (notesRes.ok) {
        const notesData = await notesRes.json();
        setNotes(notesData.sort((a,b) => b.uuid.localeCompare(a.uuid)));
      }
    } catch(err) { 
        console.error("EntityViewer failed to load notes. Error:", err); 
    }
    
    setIsLoading(false);
  }, [entityId]);
  
  // Refresh the entity data.
  useEffect(() => {
    loadEntityData();
  }, [loadEntityData]);

  // Handle [Esc] to close, [E] to edit, and left/right arrows for navigation.
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore hotkeys while a child overlay is active
      if (viewingNoteIndex !== null) return;

      // Don't override if user is typing
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        if (onClose) onClose();
      }
      if (e.key === 'ArrowLeft') {
        navigate(-1);
      }
      if (e.key === 'ArrowRight') {
        navigate(1);
       }
      if (e.key === 'e' || e.key === 'E') {
        if (onEdit) onEdit(currentEntity);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onEdit, navigate, viewingNoteIndex]);

  if (!currentEntity) return null;

  return (
    <div className="file-viewer-backdrop" onClick={onClose}>
      <div className="file-viewer-frame" onClick={e => e.stopPropagation()}>
        <div className="file-viewer-outer" />
        <div className="file-viewer-inner">
          
          {/* Header bar */}
          <div className="file-viewer-header">
            <span className="file-viewer-title">
              Entity Record // {currentEntity.handle || currentEntity.name || 'Unknown'}
            </span>
            <span className="file-viewer-index">
              <button 
                className="file-viewer-action-button file-viewer-action-button-padding"
                onClick={() => onEdit(currentEntity)}
                title="Edit Entity"
              >
                Edit
              </button>
              <span>
                Index: {String(currentIndex + 1).padStart(2, '0')} / {String(entities.length).padStart(2, '0')}
              </span>
            </span>
          </div>

          {/* Viewport area */}
          <div className="file-viewer-viewport entity-viewer-viewport">
            <div className="entity-viewer-content-area">
              <div className="entity-viewer-split">
                
                {/* Top Row: Avatar and Specs */}
                <div className="entity-viewer-profile-row">
                  <div className="entity-viewer-left">
                    <div className="entity-viewer-avatar-box">
                      {isLoading ? (
                        <div className="soft-text">Loading Avatar...</div>
                      ) : avatarUrl ? (
                        <img src={avatarUrl} alt="Entity Avatar" className="entity-viewer-avatar-img" />
                      ) : (
                        <div className="soft-text">No Avatar set</div>
                      )}
                    </div>
                  </div>
                  <div className="entity-viewer-right">
                    <div className="entity-viewer-specs">
                      {typeof children === 'function' ? children(currentEntity) : children}
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Logs Table */}
                <div className="entity-viewer-logs-row">
                  <div className="entity-notes-header entity-notes-header-flex">
                    <h3 className="entity-notes-title">{notesTitle}</h3>
                    <button 
                      className="file-viewer-action-button"
                      onClick={() => onAddNote && onAddNote(currentEntity)}
                      title={`Add New ${notesTitle}`}
                    >
                      New Entry
                    </button>
                  </div>
                  {isLoading ? (
                    <div className="soft-text">Retrieving...</div>
                  ) : notes.length === 0 ? (
                    <div className="soft-text">No records found</div>
                  ) : (
                    <table className="data-table">
                      <tbody>
                        {notes.map(n => (
                          <tr 
                            key={n.uuid} 
                            className="entity-pointer"
                            onClick={() => setViewingNoteIndex(notes.findIndex(note => note.uuid === n.uuid))}
                          >
                            <td className="data-table-cell-category">{n.category}</td>
                            <td className="data-table-cell-title">{n.note_name}</td>
                            <td className="data-table-cell-date">{formatMuirgenDate(n.modified_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom control bar */}
          <div className="file-viewer-controls">
            <button onClick={() => navigate(-1)} className="file-viewer-button">
              ⧏
            </button>

            <button onClick={onClose} className="file-viewer-button file-viewer-button-icon">
              <span>
                ⎚
              </span>
            </button>

            <button onClick={() => navigate(1)} className="file-viewer-button">
              ⧐
            </button>
          </div>

          {/* Decorative internal lines */}
          <div className="file-viewer-decoration-line" />
        </div>
      </div>

      {/* Nested Interstitial Viewer for Logs */}
      {viewingNoteIndex !== null && (
        <EntityNoteViewer 
          notes={notes}
          initialIndex={viewingNoteIndex}
          onClose={() => setViewingNoteIndex(null)}
          onEdit={(note) => {
            setViewingNoteIndex(null);
            if (onNoteSelect) onNoteSelect(note.uuid);
          }}
        />
      )}
    </div>
  );
};

export default EntityViewer;
