// /journey/:flow — a journey, walked: the run says which screen comes next.
import { useState } from 'react'
import { Text, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { Btn, NativeFlowRunner, useNativeHost, useNativeTheme } from '@xeplr/ui-factory/native'
import { factory, flows } from '../../lib/app.js'

export default function Journey() {
  const t = useNativeTheme()
  const host = useNativeHost()
  const { flow } = useLocalSearchParams()
  const [round, setRound] = useState(0)   // Start another: a new run
  return (
    <>
      <Stack.Screen options={{ title: 'Journey' }} />
      <NativeFlowRunner key={round} {...flows.runnerProps} {...factory.screenProps} flowKey={String(flow)} host={host}
        renderDone={() => (
          <View style={{ flex: 1, padding: 16, backgroundColor: t.plane, gap: 12 }}>
            <Text style={{ color: t.ink, fontSize: 20, fontWeight: '800' }}>All done</Text>
            <Text style={{ color: t.muted }}>Everything in this journey is filled in.</Text>
            <Btn label="Start another" variant="primary" onPress={() => setRound((n) => n + 1)} />
            <Btn label="Back to the menu" onPress={() => router.replace('/')} />
          </View>
        )} />
    </>
  )
}
