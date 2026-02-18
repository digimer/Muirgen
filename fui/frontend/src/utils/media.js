/* 
 * Centralized media upload utility. Handles tests and verifications
 * 
 * @param {File} file - The opject being uploaded
 * @param {string} referenceId - The UUID (or other ID) used to locate the associated referenced item type
 * @param {string} referenceTable - The database table related to the file being uploaded (ie: 'vessels', 'users', etc)
 */

export const uploadMedia = async (file, referenceId, referenceTable) => {
  // Check max size. If changing this, be sure to update Nginx's config! Specifically, 
  // - /etc/nginx/conf.d/muirgen.conf -> client_max_body_size 50m;'
  const MAX_SIZE = 50 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error(`File too large; Limit is: [${(MAX_SIZE / (1024 * 1024)).toFixed(1)} MiB]], attempted upload is: [~${(file.size / (1024 * 1024)).toFixed(1)} MiB].`);
  }

  // Prepare for the data
  const formData = new FormData();
  formData.append('referenceTable', referenceTable);
  formData.append('file', file);

  // Send the request.
  const token = localStorage.getItem('muirgen_token');
  const res = await fetch(`/api/system/${referenceId}/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });

  // Handle responses.
  if (!res.ok) {
    let errorMessage = `Upload Failed: Server returned: [${res.status}]`;
    try {
      const errorData = await res.json();
      errorMessage = errorData.error || errorMessage;
    } catch (err) {
      console.warn('Upload Failed: Response was not JSON:', err);
    }
    throw new Error(errorMessage);
  }

  return await res.json();
};
