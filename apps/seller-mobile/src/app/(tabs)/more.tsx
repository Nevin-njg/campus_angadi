import { Ionicons } from '@expo/vector-icons'
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

const items = [
  ['pricetags-outline', 'Categories'],
  ['ticket-outline', 'Offers'],
  ['wallet-outline', 'Finance'],
  ['time-outline', 'Store timings'],
  ['phone-portrait-outline', 'Logged-in devices'],
  ['settings-outline', 'Settings'],
] as const

export default function MoreScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.title}>More</Text>

        <View style={styles.list}>
          {items.map(([icon, label]) => (
            <View key={label} style={styles.item}>
              <View style={styles.icon}>
                <Ionicons name={icon} size={20} color="#52525b" />
              </View>

              <Text style={styles.label}>{label}</Text>

              {label === 'Finance' ||
              label === 'Store timings' ||
              label === 'Settings' ? (
                <Ionicons name="lock-closed-outline" size={16} color="#a1a1aa" />
              ) : null}

              <Ionicons
                name="chevron-forward"
                size={19}
                color="#a1a1aa"
                style={styles.chevron}
              />
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  container: {
    padding: 20,
  },
  title: {
    color: '#18181b',
    fontSize: 28,
    fontWeight: '800',
  },
  list: {
    marginTop: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 18,
    backgroundColor: '#ffffff',
  },
  item: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e4e4e7',
  },
  icon: {
    width: 34,
  },
  label: {
    flex: 1,
    color: '#27272a',
    fontSize: 15,
    fontWeight: '600',
  },
  chevron: {
    marginLeft: 7,
  },
})
