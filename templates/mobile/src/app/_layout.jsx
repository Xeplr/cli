// THE APP'S FRAME — read what the phone remembered, then a stack of pages with
// a header and Back. Nobody signed in: the sign-in page. Light or dark follows
// the phone's own setting.
import { useEffect, useState } from 'react'
import { Platform, Text, View, useColorScheme } from 'react-native'
import { Redirect, Stack, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { CameraView, Camera } from 'expo-camera'
import { hydrateStorage, startSession, useSession } from '@xeplr/ui-account/native'
import { NativeHostProvider, NativeInsets, NativeTheme, DARK, LIGHT, useNativeTheme } from '@xeplr/ui-factory/native'
import { APP_NAME, BUILT_IN_SERVER, devServer } from '../lib/app.js'

const PICKERS = { ImagePicker, DocumentPicker, DateTimePicker, DateTimePickerAndroid, CameraView, Camera }

function Frame() {
  const t = useNativeTheme()
  const insets = useSafeAreaInsets()
  const { signedIn, server } = useSession()
  const segments = useSegments()
  if (!signedIn && segments[0] !== 'login') return <Redirect href="/login" />
  return (
    <NativeInsets value={insets}>
      <NativeHostProvider modules={PICKERS} baseUrl={server} appName={APP_NAME}>
        <StatusBar style={t.dark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerStyle: { backgroundColor: t.surface }, headerTintColor: t.ink, headerTitleStyle: { color: t.ink }, contentStyle: { backgroundColor: t.plane } }} />
      </NativeHostProvider>
    </NativeInsets>
  )
}

export default function RootLayout() {
  const scheme = useColorScheme()
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(null)
  useEffect(() => {
    hydrateStorage({ AsyncStorage, prefix: '__NAME__', web: Platform.OS === 'web' })
      .then(() => { startSession({ builtInServer: BUILT_IN_SERVER, suggested: devServer() }); setReady(true) }, (e) => setFailed(e.message || 'Could not start'))
  }, [])
  if (failed) return <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}><Text>{failed}</Text></View>
  if (!ready) return null
  return <SafeAreaProvider><NativeTheme value={scheme === 'light' ? LIGHT : DARK}><Frame /></NativeTheme></SafeAreaProvider>
}
