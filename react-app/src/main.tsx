import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './table.css'
import './session.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
