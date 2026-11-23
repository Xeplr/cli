// THIS APP, ON A PHONE — its name, the server, and the calls every page makes.
//
// Nothing here is a screen: the forms, lists, buttons and journeys are the ones
// designed in Configure UI, read from the server and drawn natively by
// @xeplr/ui-factory/native. Add a form to the menu in Configure UI and it is on
// the phone too — no change here, no new build.
import Constants from 'expo-constants'
import { authFetch, authFetchFile } from '@xeplr/ui-account/native'
import { createFactoryApi, createFlowsApi } from '@xeplr/ui-factory/model'

export const APP_NAME = '__TITLE__'

/**
 * The server this build is for — EXPO_PUBLIC_SERVER_URL, written in when the
 * app is built (eas.json). Set, the app goes there and asks for no address.
 * Empty (Expo Go while developing), the address is typed on the sign-in
 * screen, starting from this Mac's own web app (port __UI_PORT__) — run it with
 * `npm run dev -- --host` so the phone can reach it.
 */
export const BUILT_IN_SERVER = process.env.EXPO_PUBLIC_SERVER_URL || ''

export function devServer() {
  const host = Constants.expoConfig && Constants.expoConfig.hostUri ? Constants.expoConfig.hostUri.split(':')[0] : null
  return process.env.NODE_ENV !== 'production' && host ? `http://${host}:__UI_PORT__` : ''
}

// The calls, signed with the session's tokens; they read the server's address
// when they are made, so one of each is enough.
export const factory = createFactoryApi({ fetch: authFetch, fetchFile: authFetchFile, base: '/api' })
export const flows = createFlowsApi({ fetch: authFetch, base: '/api/workflow' })
