// SIGNING IN — @xeplr/ui-account's own, the same ways in as the website.
import { Stack, router } from 'expo-router'
import { NativeSignIn } from '@xeplr/ui-account/native'
import { APP_NAME } from '../lib/app.js'

export default function Login() {
  return (
    <>
      <Stack.Screen options={{ title: 'Sign in', headerBackVisible: false }} />
      <NativeSignIn title={APP_NAME} tagline="Sign in to carry on." onSignedIn={() => router.replace('/')} />
    </>
  )
}
