// THE MENU — what the server says this person may see: every form added to the
// menu in Configure UI (in its order, under its names), and the journeys.
import { Text, View } from 'react-native'
import { Stack, router } from 'expo-router'
import { useSession, signOut } from '@xeplr/ui-account/native'
import { Btn, NativeMenu, phoneMenu, useNativeTheme } from '@xeplr/ui-factory/native'
import { APP_NAME } from '../lib/app.js'

export default function Menu() {
  const t = useNativeTheme()
  const { user, access, server } = useSession()
  const open = (m) => router.push(m.kind === 'flows' ? '/flows' : `/forms/${encodeURIComponent(m.form)}`)
  return (
    <>
      <Stack.Screen options={{ title: APP_NAME }} />
      <NativeMenu items={phoneMenu(access)} onOpen={open}
        header={(
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: t.ink, fontSize: 22, fontWeight: '800' }}>{APP_NAME}</Text>
            {user ? <Text style={{ color: t.muted }}>Signed in as {user.name || user.email}</Text> : null}
          </View>
        )}
        footer={(
          <View style={{ marginTop: 24 }}>
            <Text style={{ color: t.muted, marginBottom: 8, fontSize: 12 }}>{server}</Text>
            <Btn label="Sign out" onPress={() => { signOut(); router.replace('/login') }} />
          </View>
        )} />
    </>
  )
}
