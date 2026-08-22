import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { SellerSessionProvider } from '../features/auth/session'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SellerSessionProvider>
        <StatusBar style="dark" />

        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: '#fafafa',
            },
          }}
        />
      </SellerSessionProvider>
    </SafeAreaProvider>
  )
}
