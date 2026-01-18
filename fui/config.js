// ~/fui/config.js
const config = {
  // Ports used by the services internally
  apiPort: 5000,       // Node.js backend
  frontendPort: 5173,  // Vite/React dev port

  // Default display settings for the UI
  vesselNameDefault: "Muirgen",
  
  // This helps the UI know where to find the API
  // In production (Nginx port 80), this should just be empty or '/'
  apiBaseUrl: '/api'
};

export default config;
