// Flows are at /api/workflow/flows — served by @xeplr/workflow inside this
// app's API, or on its own port; the dev proxy (vite.config.js) and nginx
// decide which, never this file. authFetch carries the same sign-in and
// company as every other call.
import { authFetch } from '@xeplr/ui-account'
import { createFlowsApi } from '@xeplr/ui-factory'

export const flows = createFlowsApi({ fetch: authFetch, base: '/api/workflow' })
