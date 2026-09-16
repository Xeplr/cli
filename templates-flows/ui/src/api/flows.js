// Flows go through this app's API (/api/flows), which forwards them to Xeplr
// Workflow — so they carry the same sign-in and company as everything else.
import { authFetch } from '@xeplr/ui-account'
import { createFlowsApi } from '@xeplr/ui-factory'

export const flows = createFlowsApi({ fetch: authFetch, base: '/api' })
