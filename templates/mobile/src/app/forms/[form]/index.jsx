// /forms/:form — a form's records, as on the web. A row opens it; + New a new one.
import { useCallback, useState } from 'react'
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useSession } from '@xeplr/ui-account/native'
import { NativeFormRecords, phoneMenu } from '@xeplr/ui-factory/native'
import { factory } from '../../../lib/app.js'

export default function FormRecords() {
  const { form } = useLocalSearchParams()
  const { access } = useSession()
  const key = String(form)
  const item = phoneMenu(access).find((m) => m.form === key)
  // Coming back from a record reads the list again: what was done there shows here.
  const [tick, setTick] = useState(0)
  useFocusEffect(useCallback(() => { setTick((n) => n + 1) }, []))
  return (
    <>
      <Stack.Screen options={{ title: item ? item.label : key.replace(/_/g, ' ') }} />
      <NativeFormRecords factory={factory} form={key} reloadKey={tick}
        onOpen={({ id }) => router.push(`/forms/${encodeURIComponent(key)}/${id === null || id === undefined ? 'new' : encodeURIComponent(id)}`)} />
    </>
  )
}
