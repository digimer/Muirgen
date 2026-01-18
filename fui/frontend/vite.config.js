import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Create and alias for the directory containing config.js
      '@shared': path.resolve(__dirname, '../')
    }
  },
  server: {
    allowedHosts: ['mr-scifi-ui'],
    host: true, 
    fs: {
      // Allow vite to serve files from one level above the frontend folders
      allow: ['..']
    }
  }
})
