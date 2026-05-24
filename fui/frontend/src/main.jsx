import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// import './index.css'
import './App.css'
import './Muirgen.css'
import App from './App.jsx'
import { SystemStatusProvider } from './utils/hooks.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SystemStatusProvider>
      <App />
    </SystemStatusProvider>
  </StrictMode>,
)
