import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initUiTheme } from './lib/uiTheme'
import App from './App.tsx'

initUiTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
