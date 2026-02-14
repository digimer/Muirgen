/* 
 * Handles files and images attached to vessels.
 */ 
import React, { useState, useEffect } from 'react';
import { apiFetch } from './utils/api.js';

const VesselMedia = ({ vessel, mode = 'file' }) => {
  const [mediaItems, setMediaItems]   = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError]             = useState(null);

  // Fetch files when the vessel changes
  useEffect(() => {
    if (vessel?.uuid) fetchMedia();
  }, [vessel]);

  const fetchMedia = async () => {
    try {
      // Note: If later we want to filter by images or other files, here's where we'd do it. For now, bulk
      //       load everything for the vessel.
      const res = await apiFetch(`/api/system/${vessel.uuid}/files`)
      if (res.ok) {
        const data = await apiFetch(`/api/system/${vessel.uuid}/files`);
        const filtered = data.filter(item => mode === 'image' ? item.file_type === 'image' : item.file_type !== 'image' );
        setMediaItems(filtered);
      }
    } catch (err) {
      console.error(`Failed to load the files. Error: ${err}`);
    }
  }
};

const handleUpload = async (e) => {

};

export default VesselMedia;