// /flows — the journeys designed in Configure UI → Flows, each with Start.
import { Stack, router } from 'expo-router'
import { NativeFlows } from '@xeplr/ui-factory/native'
import { flows } from '../../lib/app.js'

export default function Flows() {
  return (
    <>
      <Stack.Screen options={{ title: 'Journeys' }} />
      <NativeFlows flows={flows} onStart={(f) => router.push(`/journey/${encodeURIComponent(f.key)}`)} />
    </>
  )
}
