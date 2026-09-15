// MODEL LAYER — every call the screens and the Forms pages make, to the API's
// @xeplr/factory routes (mounted at /api in api/app.js).
//
// authFetch attaches the signed-in user's token (and the active company, when
// the app has tenancy) and returns the PARSED body. createFactoryApi accepts
// it as it is.
import { authFetch } from '@xeplr/ui-account'
import { createFactoryApi } from '@xeplr/ui-factory'

export const factory = createFactoryApi({ fetch: authFetch, base: '/api' })
