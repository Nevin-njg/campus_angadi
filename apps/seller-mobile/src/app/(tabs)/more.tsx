import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

const items = [
  ['pricetags-outline', 'Categories', '/categories'],
  ['ticket-outline', 'Offers', '/offers'],
  ['wallet-outline', 'Finance', '/finance'],
  ['time-outline', 'Store timings', '/store-timings'],
  ['phone-portrait-outline', 'Logged-in devices', null],
  ['settings-outline', 'Settings', null],
] as const

export default function MoreScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.title}>More</Text>

        <View style={styles.list}>
          {items.map(([icon, label, route], index) => (
            <Pressable
              key={label}
              disabled={!route}
              onPress={() => {
                if (route) router.push(route as never)
              }}
              style={({ pressed }) => [
                styles.item,
                index === items.length - 1 && styles.lastItem,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.icon}>
                <Ionicons name={icon} size={20} color="#52525b" />
              </View>

              <Text style={styles.label}>{label}</Text>

              {label === 'Settings' ? (
                <Ionicons name="lock-closed-outline" size={16} color="#a1a1aa" />
              ) : null}

              <Ionicons
                name="chevron-forward"
                size={19}
                color={route ? '#71717a' : '#d4d4d8'}
                style={styles.chevron}
              />
            </Pressable>
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
  lastItem: {
    borderBottomWidth: 0,
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
  pressed: {
    backgroundColor: '#fafafa',
  },
})
