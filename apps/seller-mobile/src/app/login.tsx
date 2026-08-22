import { useState } from 'react'
import { router } from 'expo-router'
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

import {
  sellerAuthApi,
  SellerAuthError,
} from '../features/auth/auth-api'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleContinue() {
    const normalizedEmail =
      email.trim().toLowerCase()

    if (!normalizedEmail) {
      setError('Enter your registered store email.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await sellerAuthApi.requestOtp(normalizedEmail)

      router.push({
        pathname: '/verify-otp',
        params: {
          email: normalizedEmail,
        },
      })
    } catch (err) {
      setError(
        err instanceof SellerAuthError
          ? err.message
          : 'Unable to send the login code.',
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
          <Text style={styles.title}>Seller login</Text>

          <Text style={styles.description}>
            Sign in using the registered email address of your official store.
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>Store email</Text>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="seller@example.com"
              placeholderTextColor="#a1a1aa"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              style={styles.input}
              returnKeyType="send"
              onSubmitEditing={() => {
                void handleContinue()
              }}
            />

            {error ? (
              <Text style={styles.error}>{error}</Text>
            ) : null}

            <Pressable
              onPress={() => {
                void handleContinue()
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
                  Send login code
                </Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.help}>
            This app is available only for Campus Angadi official stores.
          </Text>
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
    fontSize: 32,
    fontWeight: '800',
  },
  description: {
    marginTop: 10,
    color: '#71717a',
    fontSize: 15,
    lineHeight: 22,
  },
  form: {
    marginTop: 32,
  },
  label: {
    marginBottom: 8,
    color: '#3f3f46',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    height: 54,
    borderWidth: 1,
    borderColor: '#d4d4d8',
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    color: '#18181b',
    fontSize: 16,
  },
  error: {
    marginTop: 10,
    color: '#b91c1c',
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    height: 54,
    marginTop: 18,
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
  help: {
    marginTop: 24,
    color: '#a1a1aa',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
})
