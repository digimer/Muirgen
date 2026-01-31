export const apiFetch = async (url, options = {}) => {
  // Automatically attach the token to every request
  const token = localStorage.getItem('muirgen_token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Execute the fetch
  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 || response.status === 403) {
    const reason = response.status === 401 ? "is unauthorized" : "has expired";
    
    // Dispatch a custom event that App.jsx can hear
    const event = new CustomEvent('muirgen-auth-failure', {
      detail: { message: `Security: Token ${reason}, Ejecting user.` }
    });
    window.dispatchEvent(event);
    
    // Clean up local storage;
    localStorage.removeItem('muirgen_token');
    localStorage.removeItem('muirgen_user_uuid');
    
    // Return null to tell the caller to abort.
    return null;
  }
  
  return response;
};
