import { SafeAreaView, StyleSheet, Text, View } from 'react-native'

export default function OrdersScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.subtitle}>Pending and previous store orders</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fafafa' },
  container: { padding: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#18181b' },
  subtitle: { marginTop: 6, fontSize: 14, color: '#71717a' },
})
