import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// EVERY API PREFIX THIS APP CALLS.
//
// A path missing from this list does NOT fail loudly — Vite falls through to
// the SPA and serves index.html, so the fetch succeeds and the JSON parse is
// what breaks: `Unexpected token '<'`. Adding a route to the backend is only
// half of shipping an endpoint; it has to be listed here too.
const API_PATHS = [
  '/health',
  '/whoami',
  // Every data address lives under /api, so a PAGE path and a DATA path can
  // never collide. Without that split, adding '/tasks' here shadowed the UI's
  // own /tasks page — opening it showed raw JSON instead of the app.
  '/api'
]

export default defineConfig(({ mode }) => {
  // Prefix '' so plain names load, not just VITE_-prefixed ones. These are dev
  // server settings, not values shipped to the browser.
  const env = loadEnv(mode, process.cwd(), '')

  // NO PORT LITERALS. A hardcoded fallback is a second answer to a question
  // .env already answers, and it is the one that wins when the file is missing
  // — exactly when you want to be told rather than quietly served elsewhere.
  const port = Number(env.UI_PORT)
  const authUrl = env.AUTH_URL
  const apiUrl = env.API_URL
  if (!port || !authUrl || !apiUrl) {
    throw new Error('ui/.env must set UI_PORT, AUTH_URL and API_URL')
  }

  const proxy = {
    // Only the real network calls (/auth/api/*), NOT bare /auth — that prefix
    // is also used by client-side routes (/auth/login, /auth/profile), which
    // must fall through to Vite's SPA index.html rather than the auth backend.
    '/auth/api': authUrl,
    // A SERVICE THAT MAY RUN ON ITS OWN PORT, before the /api it sits under —
    // the first matching prefix wins. Blank WORKFLOW_URL: it runs inside the
    // API, so the API answers. The browser always calls /api/workflow/…; which
    // process serves it is decided here (and by nginx in production), never in
    // the UI's code.
    '/api/workflow': env.WORKFLOW_URL || apiUrl
  }
  API_PATHS.forEach((p) => { proxy[p] = apiUrl })

  return {
    plugins: [react()],
    // Force every import to THIS app's copy, so hook-using libraries don't
    // load twice and break the rules of hooks in ways that read as impossible.
    resolve: { dedupe: ['react', 'react-dom', 'react-router-dom', '@xeplr/ui-canvas', '@xeplr/ui-table'] },
    server: { port, strictPort: true, proxy },
    preview: { port, strictPort: true }
  }
})
