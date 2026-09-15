import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { configure, AccessProvider, ThemeProvider } from '@xeplr/ui-account'
import App from './App.jsx'
__MT_UI_IMPORTS__
import './index.css'
import '@xeplr/ui-account/src/designs/theme.css'

// Auth requests are same-origin in dev — vite proxies /auth/api to AUTH_URL
// (see vite.config.js, which reads it from .env).
configure('')
__MT_UI_REGISTER__

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* REQUIRED, not decoration. theme.css defines its colours only inside
          .xeplr-theme-* classes — there is no :root default — so without a
          theme wrapper every var(--xeplr-*) is undefined and the whole UI
          renders unstyled. */}
      <ThemeProvider>
        <AccessProvider>
          <App />
        </AccessProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)
