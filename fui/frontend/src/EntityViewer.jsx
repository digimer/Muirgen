/* 
 * This is the boiler plate for display an entity's profile or specs in a read-only format. It allows rapid 
 * navigation though IDs from the parent, with key bindings to move to the editing page and back.
 */ 

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from './utils/api.js';
import { formatMuirgenDate } from './utils/formatters.js';

const EntityViewer = ({ title, notesTitle = "Logs", entityId, onEdit, onClose, onNoteSelect, children }) => {
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [notes, setNotes]         = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadEntityData = useCallback(async () => {
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

  // Handle [Esc] to close, [E] to edit
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't override if user is typing
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        if (onClose) onClose();
      }
      if (e.key === 'e' || e.key === 'E') {
        if (onEdit) onEdit();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onEdit]);

  return (
    <div className="tab-pane active fade-in text-focus-in">
      {/* Title */}
      <div className="entity-viewer-header">
         <h2 className="flicker-subtle" style={{ margin: 0 }}>{title}</h2>
      </div>
       <div className="entity-viewer-split">
          <div className="entity-viewer-left">

            {/* Avatar Area */}
            <div className="entity-viewer-avatar-box">
              {isLoading ? (
                <div className="soft-text">Seaching For Avatar...</div>
              ) : avatarUrl ? (
                <img src={avatarUrl} alt="Entity Avatar" className="entity-viewer-avatar-img" />
              ) : (
                <div className="soft-text">No Avatar set</div>
              )}
            </div>

            {/* Custom Profile Specs (Composition injected here) */}
            <div className="entity-viewer-specs">
              {children}
            </div>
          </div>

          {/* Logs Area */}
          <div className="entity-viewer-right">
            <h3 className="entity-notes-header">{notesTitle}</h3>
            <div className="entity-viewer-notes-list">
              {isLoading ? (
                <div className="soft-text">Retrieving...</div>
              ) : notes.length === 0 ? (
                 <div className="soft-text">No records found</div>
              ) : (
                notes.map(n => (
                  <div 
                    key={n.uuid} 
                    className="entity-viewer-note-item" 
                    onClick={() => onNoteSelect && onNoteSelect(n.uuid)}
                  >
                    <div className="entity-viewer-note-title">{n.note_name}</div>
                    <div className="entity-viewer-note-meta soft-text">
                        {formatMuirgenDate(n.modified_date)} // {n.category}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
       </div>
    </div>
  );
};

export default EntityViewer;
