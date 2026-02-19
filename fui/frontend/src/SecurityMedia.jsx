/* 
 * This is a wrapper around media elements that handles loading errors (403/404) gracefully.
 * It attempts to diagnose the errors by fetching the resource manually if the tag fails.
 */

import React, { useState, useEffect } from 'react';

const SecurityMedia = ({ src, alt, className, style, type = 'image' }) => {
  const [status, setStatus]             = useState('loading'); // Values; loading, loaded, error
  const [errorMessage, setErrorMessage] = useState(null);

  // TODO: Enable this when we're ready to add file tests
  // useEffect(() => if (type === 'file') checkFileExistence(); }, [src]);

  const handleLoadError = async () => {
    setStatus('error');
    setErrorMessage('Generic Load error');

    try {
      // Diagnostic fetch to get the real status code
      const res = await fetch(src, { method: 'GET' });
      let message = `Generic Error: [${res.status}]`;
      if (res.status === 403) {
        setErrorMessage(
          <>
            Security: Access Denied! (Err: 403)
            <br />
            <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Bad Directory/File Permissions?</span>
          </>
        );
        return;
      } 
      if (res.status === 404) {
        message = "Access: File Not Found on Storage (404 status)";
        setErrorMessage(
          <>
            Access: Record Not Found! (Err: 404)
            <br />
            <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>File or Parent Directory Removed?</span>
          </>
        );
        return;
      }

      setErrorMessage(message);
    } catch (err) {
      setErrorMessage(`Comms Failure: ${err}`);
    }
  }

  // This will be expanded after we confirm image process is done.
  if (type !== 'image') { 
    return ( 
      <div className={`security-media-wrapper ${className || ''}`} style={style}>
        <div className="status-display-error">Unsupported Media Type: {type}</div>
      </div>
    ); 
  }

  return (
    <div className={`security-media-wrapper ${className || ''}`} style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      {/* Error Overlay */}
      {status === 'error' && (
        <div className="status-display-error" style={{
          position: 'absolute', 
          inset: 0, 
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '10px', 
          backgroundColor: 'rgba(0, 0, 0, 0.8)', 
          zIndex: 10
        }}>
          <span className="flicker-text">{errorMessage}</span>
        </div>
      )}

      {/* The Image */}
      {type === 'image' && (
        <img src={src} alt={alt} 
          style={{ 
            display: status === 'error' ? 'none' : 'block', // Hide broken image icon
            width: '100%', 
            height: '100%', 
            objectFit: 'cover'
          }} 
          onLoad={() => setStatus('loaded')} 
          onError={handleLoadError}
        />
      )}
    </div>
  );
};

export default SecurityMedia;
