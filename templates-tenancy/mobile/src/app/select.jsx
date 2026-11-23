// WHERE ARE YOU WORKING? — the company (and workspace) this app's data belongs
// to, for apps whose data is split by company: @xeplr/ui-account's own picker,
// the same picking as the website's. What the person may see depends on the
// company (its admin there, a viewer elsewhere), so the menu is read again.
import { Stack, router } from 'expo-router'
import { NativeScopePicker, refreshAccess } from '@xeplr/ui-account/native'
import { TENANCY } from '../lib/app.js'

export default function Select() {
  return (
    <>
      <Stack.Screen options={{ title: 'Choose', headerBackVisible: router.canGoBack() }} />
      <NativeScopePicker levels={TENANCY.levels} onChosen={() => { refreshAccess().finally(() => router.replace('/')) }} />
    </>
  )
}
