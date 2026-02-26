/* 
 * This handles Notes (and logs) tagged to a vessel. It uses Tiptap for the text management.
 */ 

import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { apiFetch } from './utils/api.js';
import { formatMuirgenDate } from './utils/formatters.js';
import VesselNoteViewer from './VesselNoteViewer.jsx';

// Internal component that handles the toolbar buttons from Tiptap.
const MenuBar = ({ editor }) => {
  if (!editor) return null;
  
  // This helper determines if a button is active (glowing) or inactive.
  const getButtonClass = (isActive) => {
    return `touch-button small-button ${isActive ? 'active-selection-box button-confirm-state' : ''}`;
  };

  return (
    <div className="tiptap-toolbar">
      <button 
        type="button" 
        onClick={() => editor.chain().focus().toggleBold().run()} 
        disabled={!editor.can().chain().focus().toggleBold().run()} 
        className={getButtonClass(editor.isActive('bold'))}
      >
        Bold
      </button>
       <button 
        type="button" 
        onClick={() => editor.chain().focus().toggleItalic().run()} 
        disabled={!editor.can().chain().focus().toggleItalic().run()} 
        className={getButtonClass(editor.isActive('italic'))}
      >
        Italic
      </button>
      <button 
        type="button" 
        onClick={() => editor.chain().focus().toggleBulletList().run()} 
        className={getButtonClass(editor.isActive('bulletList'))}
      >
        H3
      </button>
      <button 
        type="button" 
        onClick={() => editor.chain().focus().toggleCodeBlock().run()} 
        className={getButtonClass(editor.isActive('codeBlock'))}
      >
        Code Block
      </button>
   </div>
  );
}

function VesselNotes({ vessel }) {
  const [notes, setNotes]                                   = useState([]);
  const [editingNote, setEditingNote]                       = useState(null);
  const [status, setStatus]                                 = useState({ type: '', message: '' });
  const [isAutoSaving, setIsAutoSaving]                     = useState(false);
  const [isConfirmingDeactivate, setIsConfirmingDeactivate] = useState(false);
  const [viewingNoteIndex, setViewingNoteIndex]             = useState(null);
  const [hasEdits, setHasEdits]                             = useState(false);

  // Initialize Tiptap
  const editor = useEditor({
    extensions: [ StarterKit ], 
    content: '',
    editorProps: { 
      attributes: { class: 'tiptap-editor-area' } // Pass Muirgen's UI classinto Tiptap's editor area
    }, 
    onUpdate: () => { setHasEdits(true) }         // Disable the [Escape] button
  });

  // Load existing notes
  const fetchNotes = async () => {
    try {
      const res = await apiFetch(`/api/notes/${vessel.uuid}/list`);
      if (res.ok) {
        const data = await res.json();
        // Force standard string sorting on the UUIDv7 prefix to guarantee newest-first
        const sortedData = data.sort((a, b) => b.uuid.localeCompare(a.uuid));
        setNotes(sortedData);
      }

    } catch (err) {
      console.error("Failed to load vessel logs. Error: ", err)
    }
  };

  useEffect(() => {
    if (vessel?.uuid) fetchNotes();
  }, [vessel]);

  // When a user selects a log, load it into the Tiptap instance.
  const handleEditSelect = (note) => {
    // Make sure we've got a valid array for access level and, if not, set it to an array with just 'general'
    // set.
    setEditingNote({
      ...note,
      access_level: Array.isArray(note.access_level) ? note.access_level : ['general']
    });
    if (editor && note) {
      editor.commands.setContent(note.note_body);
    }
    setStatus({ type: '', message: '' });  
    setIsConfirmingDeactivate(false);  // Clear the "Confirm" on record flag
    setHasEdits(false);                // Mark that it's safe the enable [Escape]
  };

  // Helper to safely toggle Access Levels
  const toggleAccessLevel = (level) => {
    if (!editingNote) return;
    // If they click the one that's already checked, don't let them uncheck it 
    // (a note must always have at least one access level). Or, default to 'general'!
    if (editingNote.access_level?.includes(level)) {
      if (level !== 'general') {
        setEditingNote({...editingNote, access_level: ['general']});
        setHasEdits(true);
      }
      return; 
    }
    // Otherwise, completely overwrite the array with ONLY the newly clicked level.
    setEditingNote({...editingNote, access_level: [level]});
    setHasEdits(true);
  };

  // This allows [Esc] to be used to exit the editor _if_ there are no changes.
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only trigger if editor is open
      if (e.key === 'Escape' && editingNote) {
        
        // Block Escape if any edits exist.
        if (hasEdits) {
          console.warn("Unsaved changes, [Esc] blocked.");
          return;
        }

        // If there's a notes.uuid, send them back to the viewer.
        if (editingNote.uuid) {
          const targetIndex = notes.findIndex(n => n.uuid === editingNote.uuid);
          if (targetIndex !== -1) {
            setViewingNoteIndex(targetIndex);
          }
         }

        // If we got here, the user hit [Esc] on a new note with no changes yet. Go back to the main list.
        setEditingNote(null);
        editor?.commands.setContent('');
        setStatus({ type: '', message: '' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingNote, notes, editor, hasEdits]);

  // Debounce auto-save for drafts
  useEffect(() => {
    // Only auto-save if we have an active editor and this is a new log. (
    // NOTE: See ToDo on why this is the case
    if (!editor || !editingNote || editingNote.uuid) return;

    const saveTimer = setTimeout(() => {
      const htmlContent = editor.getHTML();

      // Don't save if it's completely empty
      if (!editingNote.note_name && (htmlContent === '<p></p>' || !htmlContent)) return;
      
      setIsAutoSaving(true);
      const draftData = {...editingNote, note_body: htmlContent };
      localStorage.setItem(`muirgen_draft_log_${vessel.uuid}`, JSON.stringify(draftData));
      console.log("Draft auto-saved."); 

      // Flick the hard drive LED
      setTimeout(() => setIsAutoSaving(false), 500);
    }, 1000); // Save if the user hasn't typed in >1sec

    return () => clearTimeout(saveTimer);
  }, [editingNote, editor?.getHTML()]);

  // Create or update
  const handleSave = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: 'Recording log...' });

    // Extract the raw HTML from the Tiptop instance
    const htmlContent = editor.getHTML();

    if (!editingNote.note_name || !htmlContent || htmlContent === '<p></p>') {
      setStatus({ type: 'error', message: 'Title and body are required' });
      return;
    }

    // Ensure we don't save an empty array, default to 'general' access.
    const finalAccessLevel = (editingNote.access_level && editingNote.access_level.length > 0) ? editingNote.access_level : ['general'];

    const isUpdate = !!editingNote.uuid;
    const url      = isUpdate ? `/api/notes/${editingNote.uuid}/update` : `/api/notes/create`;
    // This flickers the HDD icon
    setIsAutoSaving(true);

    try {
      const res = await apiFetch(url, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({
          reference_table: 'vessels', 
          reference_id: vessel.uuid, 
          category: editingNote.category || 'Note::General', 
          note_name: editingNote.note_name, 
          note_body: htmlContent, 
          is_pinned: editingNote.is_pinned || false, 
          access_level: finalAccessLevel 
        })
      });

      if (res.ok) {
        const savedNote = await res.json();
        setStatus({ type: 'success', message: 'Log entry recorded.' });

        // Wait for the updated list to come back from the DB
        const refreshRes = await apiFetch(`/api/notes/${vessel.uuid}/list`);
        if (refreshRes.ok) {
          const freshNotes = await refreshRes.json();
          // Update the UI directory list
          setNotes(freshNotes);
          
          // If this was a new log, set it's new UUID as the log being amended and update the editor.
          setEditingNote(savedNote); 
        }

        // Mark that it's safe the enable [Escape]
        setHasEdits(false);

        // Clear the draft from memory.
        localStorage.removeItem(`muirgen_draft_log_${vessel.uuid}`);

        // Show the LED blink briefly and the success for a couple seconds.
        setTimeout(() => setIsAutoSaving(false), 500);
        setTimeout(() => {
          setStatus({ type: '', message: '' });
        }, 2000);
      } else {
        const errData = await res.json();
        setStatus({ type: 'error', message: errData.error || 'Log entry failed to record.' });
        setIsAutoSaving(false);  // stop the HDD icon
      }
    } catch(err) {
      setStatus({ type: 'error', message: 'Comms failure.' });
      setIsAutoSaving(false);  // stop the HDD icon
    }
  };

  // NOTE: Recovering deleted logs will be handled by a SysOp level function later.
  // Handle the deletion (deactivation) of the note/log entry.
  const handleDelete = async () => {

    try {
      const res = await apiFetch(`/api/notes/${editingNote.uuid}/deactivate`, { method: 'POST' });
      if (!isConfirmingDeactivate) {
        setIsConfirmingDeactivate(true);
        return; 
      }
      if (res.ok) {
        setStatus({ type: 'success', message: 'Log deactivated.' });
        fetchNotes();
        setTimeout(() => {
          setEditingNote(null);
          editor.commands.setContent('');
          setIsConfirmingDeactivate(false);
        }, 100);
      }
    } catch(err) {
      setStatus({ type: 'error', message: `Failed to archive log. Error: ${err.message}` });
    }
  };

  return(
    <div className="vessel-media-container setup-display">
      {/* Search column (list of logs, hidden while editing) */}
      {!editingNote && (
        <div className="directory-column">
          <div className="button-with-glyph" style={{ marginBottom: '20px' }}>
            <span className="glyph-new-record">❖</span>
            <button 
              type="button" 
              className="touch-button" 
              onClick={() => {
                const draft = localStorage.getItem(`muirgen_draft_log_${vessel.uuid}`);
                if (draft) {
                  try {
                    const parsedDraft = JSON.parse(draft);
                    setEditingNote(parsedDraft);
                    editor?.commands.setContent(parsedDraft.note_body || '');
                    setStatus({ type: 'success', message: 'Restored draft.'});
                  } catch (e) {
                    console.error("Failed to recover draft!", e);
                    setEditingNote({ note_name: '', category: 'Note::General', is_pinned: false, access_level: ['general'] });
                    editor?.commands.setContent('');
                  }
                } else {
                  setEditingNote({ note_name: '', category: 'Note::General', is_pinned: false, access_level: ['general'] });
                  editor?.commands.setContent('');
                }
                setStatus({ type: '', message: '' });
              }}
            >
              Log Entry
            </button>
          </div>

          {notes.length === 0 ? (
            <>
              <div className="user-list" style={{ height: 'fit-content' }}>
                <div className="empty-list">No records exist for this object.</div>
              </div>
            </>
          ) : (
            <div className="scrollable-media-box user-list">
              {notes.map((note, index) => (
                <div
                  key={note.uuid} 
                  className={`user-card ${note.is_pinned ? 'pinned-note-card' : ''}`}
                  onClick={() => setViewingNoteIndex(index)}
                >
                  {/* Category (Fixed Width) */}
                  <div className="log-list-category">
                    {(!note.access_level.includes('general') || note.access_level.length > 1) ? '⌭ ' : ''}
                    {note.category}
                  </div>

                  {/* Subject (Grows and Truncates) */}
                  <div className="label-text log-list-subject">
                    {note.is_pinned && <span className="glyph" style={{ marginRight: '8px' }}>△</span>}
                    {note.note_name}
                  </div>

                  {/* Date (Fixed Width) */}
                  <div className="operator-subtitles log-list-date">
                    {formatMuirgenDate(note.modified_date)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Interstitial Note Viewer */}
      {viewingNoteIndex !== null && !editingNote && (
        <VesselNoteViewer 
          notes={notes}
          initialIndex={viewingNoteIndex}
          onClose={() => setViewingNoteIndex(null)}
          onEdit={(note) => {
            setViewingNoteIndex(null);  // Close the viewport
            handleEditSelect(note);     // Open the editor
          }}
        />
      )}

      {/* Tiptap editor column */}
      <div className="terminal-column terminal-column-constrained" style={editingNote ? { gridColumn: '1 / -1' } : {}}>
        {editingNote && (
          <>
            <div className="note-editor-status-header">
              <h3 className="flicker" style={{ margin: 0 }}>{editingNote.uuid ? 'Amend Log' : 'New Log'}</h3>
              
              {/* Fixed-height container for status messages so the form never jumps */}
              <div className="note-editor-status-container">
                {status.message && (
                  <div className={`status-display top-aligned ${status.type}`}>
                    {status.message}
                  </div>
                )}
              </div>
            </div>

            <form className="setup-form note-form-container" onSubmit={handleSave}>
              <div className="field-group note-subject-category-row">
                <div className="note-subject-column">
                  <label>Subject</label>
                  <input 
                    type="text" 
                    value={editingNote.note_name || ''}
                    onChange={(e) => {
                      setEditingNote({...editingNote, note_name: e.target.value});
                      setHasEdits(true);
                    }}
                    placeholder="<Log Subject>" 
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                  <div className="field-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Category</label>
                    <select 
                      value={editingNote.category || 'Note::General'}
                      onChange={(e) => setEditingNote({ ...editingNote, category: e.target.value})}
                      className="setup-input-select"
                    >
                      <option value="Log::Crew">Log::Crew</option>
                      <option value="Log::Incident">Log::Incident</option>
                      <option value="Log::Maintenance">Log::Maintenance</option>
                      <option value="Log::Private">Log::Private</option>
                      <option value="Log::Voyage">Log::Voyage</option>
                      <option value="Log::Weather">Log::Weather</option>
                      <option value="Note::General">Note::General</option>
                    </select>
                  </div>
                  
                  <label className="checkbox-container" style={{ marginTop: '20px' }}>
                    <span className="label-text">Pin Record</span>
                    <input
                      type="checkbox"
                      checked={editingNote.is_pinned || false}
                      onChange={(e) => setEditingNote({ ...editingNote, is_pinned: e.target.checked })}
                    />
                    <span className="retro-checkmark"></span>
                  </label>
                </div>
              </div>

              {/* Tiptap editor mount point */}
              <div className="field-group" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="note-editor-header">
                  <label style={{ marginBottom: 0 }}>Log Data</label>
                  {editingNote.uuid && (
                    <span className="note-editor-mtime">
                      mtime: {formatMuirgenDate(editingNote.modified_date)}
                    </span>
                  )}
                </div>
                <div className="tiptap-editor-wrapper">
                  <MenuBar editor={editor} />
                  <div className="tiptap-editor-scroll-area">
                    <EditorContent editor={editor} style={{ height: '100%' }} />
                  </div>
                </div>
              </div>

              {/* Access Level Array Toggle moved below */}
              <div className="field-group field-group-access-level">
                <div className="access-level-container">

                  <span className="access-level-title">Access Level:</span>
                  <label className="checkbox-container">
                    <span className="label-text">General Access</span>
                    <input
                      type="checkbox"
                      checked={(editingNote.access_level || []).includes('general')}
                      onChange={() => toggleAccessLevel('general')}
                    />
                    <span className="retro-checkmark"></span>
                  </label>
                  <label className="checkbox-container">
                    <span className="label-text">SysOp Restricted</span>
                    <input
                      type="checkbox"
                      checked={(editingNote.access_level || []).includes('sysop')}
                      onChange={() => toggleAccessLevel('sysop')}
                    />
                    <span className="retro-checkmark"></span>
                  </label>
                  <label className="checkbox-container">
                    <span className="label-text">Private Log</span>
                    <input
                      type="checkbox"
                      checked={(editingNote.access_level || []).includes('private')}
                      onChange={() => toggleAccessLevel('private')}
                    />
                    <span className="retro-checkmark"></span>
                  </label>
                </div>
              </div>
              
              {/* The record button. */}
              <div className="button-row note-editor-button-row">
                 
                 {/* Left Column: Discard/Deactivate */}
                 <div className="note-editor-button-column-left">
                   {!editingNote.uuid ? (
                     <div className="button-with-glyph">
                       <span className="large-icon note-large-icon">⌧</span>
                       <button 
                         type="button" 
                         className="touch-button danger" 
                         onClick={() => {
                           localStorage.removeItem(`muirgen_draft_log_${vessel.uuid}`);
                           setEditingNote(null);
                           editor?.commands.setContent('');
                           setStatus({ type: '', message: 'Draft discarded.' });
                         }}
                       >
                         Discard Draft
                       </button>
                     </div>
                   ) : (
                     <div className="button-with-glyph">
                       <span className="large-icon note-large-icon">⌧</span>
                       <button 
                        type="button" 
                        className={`touch-button danger ${isConfirmingDeactivate ? 'button-confirm-state' : ''}`} 
                        onClick={handleDelete}
                      >
                        {isConfirmingDeactivate ? 'Confirm' : 'Deactivate'}
                       </button>
                     </div>
                   )}
                 </div>
                 
                 {/* Center Column: Record & HDD LED */}
                 <div className="note-editor-button-column-center">
                   <div className="button-with-glyph">
                     {/* Auto-save LED indicator placed beside the Record button */}
                     <span className={`auto-save-indicator ${isAutoSaving ? 'active' : ''}`} style={{ alignSelf: 'center' }}>
                       <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(90deg)' }}>
                         <ellipse cx="6" cy="12" rx="3" ry="7"></ellipse>
                         <path d="M6 5h12c1.66 0 3 3.13 3 7s-1.34 7-3 7H6"></path>
                       </svg>
                     </span>
                     <button type="submit" className="touch-button">
                       Record
                     </button>
                   </div>
                 </div>
                 
                 {/* Right Column: The End button */}
                 <div className="note-editor-button-column-right">
                   <div className="button-with-glyph">
                     <span className="large-icon note-large-icon">⎚</span>
                     <button 
                       type="button" 
                       className="touch-button" 
                       onClick={() => {
                        // Only trigger the Viewer if the log actually exists in the database.
                        // (If it's an unsaved draft, editingNote.uuid will be undefined)
                        if (editingNote.uuid) {
                          // Find the current array index by matching the notes.uuid
                          const targetIndex = notes.findIndex(n => n.uuid === editingNote.uuid);
                          if (targetIndex !== -1) {
                            setViewingNoteIndex(targetIndex);
                          }
                        }
                         setEditingNote(null);
                         editor?.commands.setContent('');
                         setStatus({ type: '', message: '' });
                       }}
                     >
                       End
                     </button>
                   </div>
                 </div>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default VesselNotes;
