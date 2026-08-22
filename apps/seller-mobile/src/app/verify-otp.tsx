import { useState } from 'react'
import {
  router,
  useLocalSearchParams,
} from 'expo-router'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { SellerAuthError } from '../features/auth/auth-api'
import { useSellerSession } from '../features/auth/session'

export default function VerifyOtpScreen() {
  const params = useLocalSearchParams<{
    email?: string
  }>()

  const email =
    typeof params.email === 'string'
      ? params.email
      : ''

  const { verifyOtp } = useSellerSession()

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleVerify() {
    if (code.length !== 6) {
      setError('Enter the 6-digit login code.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await verifyOtp(email, code)

      router.replace('/(tabs)')
    } catch (err) {
      setError(
        err instanceof SellerAuthError
          ? err.message
          : 'Unable to verify the login code.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.brand}>CAMPUS ANGADI</Text>
          <Text style={styles.title}>Enter login code</Text>

          <Text style={styles.description}>
            Enter the 6-digit code sent to
          </Text>

          <Text style={styles.email}>{email}</Text>

          <TextInput
            value={code}
            onChangeText={(value) => {
              setCode(
                value
                  .replace(/\D/g, '')
                  .slice(0, 6),
              )
            }}
            placeholder="000000"
            placeholderTextColor="#d4d4d8"
            keyboardType="number-pad"
            maxLength={6}
            editable={!loading}
            autoFocus
            style={styles.codeInput}
            returnKeyType="done"
            onSubmitEditing={() => {
              void handleVerify()
            }}
          />

          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : null}

          <Pressable
            onPress={() => {
              void handleVerify()
            }}
            disabled={loading}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>
                Verify & sign in
              </Text>
            )}
          </Pressable>

          <Pressable
            disabled={loading}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backText}>
              Change email
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  keyboard: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  brand: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  title: {
    marginTop: 8,
    color: '#18181b',
    fontSize: 30,
    fontWeight: '800',
  },
  description: {
    marginTop: 12,
    color: '#71717a',
    fontSize: 15,
  },
  email: {
    marginTop: 3,
    color: '#27272a',
    fontSize: 15,
    fontWeight: '700',
  },
  codeInput: {
    height: 64,
    marginTop: 30,
    borderWidth: 1,
    borderColor: '#d4d4d8',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    color: '#18181b',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 10,
    textAlign: 'center',
  },
  error: {
    marginTop: 10,
    color: '#b91c1c',
    fontSize: 13,
    textAlign: 'center',
  },
  button: {
    height: 54,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#f59e0b',
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  backButton: {
    alignItems: 'center',
    padding: 16,
  },
  backText: {
    color: '#52525b',
    fontSize: 14,
    fontWeight: '700',
  },
})
