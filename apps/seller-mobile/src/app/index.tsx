import { Redirect } from 'expo-router'
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native'

import { useSellerSession } from '../features/auth/session'

export default function IndexScreen() {
  const { loading, session } = useSellerSession()

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    )
  }

  if (session) {
    return <Redirect href="/(tabs)" />
  }

  return <Redirect href="/login" />
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
})
