// /forms/:form/:id — one record in its form; "new" is a new one. Save or Cancel goes back.
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { NativeRecord } from '@xeplr/ui-factory/native'
import { factory } from '../../../lib/app.js'

export default function FormRecord() {
  const { form, id } = useLocalSearchParams()
  return (
    <>
      <Stack.Screen options={{ title: id === 'new' ? 'New' : '' }} />
      <NativeRecord factory={factory} form={String(form)} id={String(id)} onDone={() => router.back()} />
    </>
  )
}
