import { AppError } from '../../../core/errors/app-error.js'
import { StoreModel } from '../infrastructure/store.model.js'

export const STORE_TIME_ZONE = 'Asia/Kolkata'

export const STORE_DAYS = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const

export type StoreDay = (typeof STORE_DAYS)[number]
export type StoreManualOpenOverride = 'AUTO' | 'OPEN' | 'CLOSED'

export interface StoreOpeningHour {
  day: StoreDay
  isOpen: boolean
  openTime: string
  closeTime: string
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const IST_OFFSET_MS = 330 * 60 * 1000

function defaultHour(day: StoreDay): StoreOpeningHour {
  return {
    day,
    isOpen: true,
    openTime: '00:00',
    closeTime: '23:59',
  }
}

export function defaultStoreOpeningHours(): StoreOpeningHour[] {
  return STORE_DAYS.map(defaultHour)
}

function validStoredTime(value: unknown, fallback: string) {
  const normalized = String(value ?? '').trim()
  return TIME_PATTERN.test(normalized) ? normalized : fallback
}

export function normalizeStoreOpeningHours(value: unknown): StoreOpeningHour[] {
  const raw = Array.isArray(value) ? value : []
  const byDay = new Map<string, Record<string, unknown>>()

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const day = String(record.day ?? '').trim().toUpperCase()
    if (STORE_DAYS.includes(day as StoreDay)) byDay.set(day, record)
  }

  return STORE_DAYS.map((day) => {
    const fallback = defaultHour(day)
    const stored = byDay.get(day)

    if (!stored) return fallback

    return {
      day,
      isOpen: typeof stored.isOpen === 'boolean' ? stored.isOpen : fallback.isOpen,
      openTime: validStoredTime(stored.openTime, fallback.openTime),
      closeTime: validStoredTime(stored.closeTime, fallback.closeTime),
    }
  })
}

function manualOverride(value: unknown): StoreManualOpenOverride {
  const normalized = String(value ?? 'AUTO').trim().toUpperCase()
  if (normalized === 'OPEN' || normalized === 'CLOSED') return normalized
  return 'AUTO'
}

function minutes(value: string) {
  const [hourText, minuteText] = value.split(':')
  return Number(hourText) * 60 + Number(minuteText)
}

function istClock(now: Date) {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS)
  return {
    dayIndex: shifted.getUTCDay(),
    minuteOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  }
}

export function storeAvailabilityView(
  store: {
    status?: unknown
    openingHours?: unknown
    manualOpenOverride?: unknown
  },
  now = new Date(),
) {
  const override = manualOverride(store.manualOpenOverride)
  const openingHours = normalizeStoreOpeningHours(store.openingHours)
  const { dayIndex, minuteOfDay } = istClock(now)
  const today = openingHours[dayIndex] ?? defaultHour(STORE_DAYS[dayIndex] ?? 'SUNDAY')

  if (String(store.status ?? 'ACTIVE') !== 'ACTIVE') {
    return {
      isOpen: false,
      status: 'CLOSED' as const,
      source: 'STATUS' as const,
      manualOverride: override,
      timeZone: STORE_TIME_ZONE,
      today,
      message: 'Store unavailable',
    }
  }

  if (override === 'OPEN') {
    return {
      isOpen: true,
      status: 'OPEN' as const,
      source: 'MANUAL' as const,
      manualOverride: override,
      timeZone: STORE_TIME_ZONE,
      today,
      message: 'Manually opened',
    }
  }

  if (override === 'CLOSED') {
    return {
      isOpen: false,
      status: 'CLOSED' as const,
      source: 'MANUAL' as const,
      manualOverride: override,
      timeZone: STORE_TIME_ZONE,
      today,
      message: 'Manually closed',
    }
  }

  if (!today.isOpen) {
    return {
      isOpen: false,
      status: 'CLOSED' as const,
      source: 'SCHEDULE' as const,
      manualOverride: override,
      timeZone: STORE_TIME_ZONE,
      today,
      message: 'Closed today',
    }
  }

  const opensAt = minutes(today.openTime)
  const closesAt = minutes(today.closeTime)
  const isOpen = minuteOfDay >= opensAt && minuteOfDay <= closesAt

  let message: string
  if (isOpen) {
    message = `Open until ${today.closeTime}`
  } else if (minuteOfDay < opensAt) {
    message = `Opens at ${today.openTime}`
  } else {
    message = 'Closed for today'
  }

  return {
    isOpen,
    status: isOpen ? ('OPEN' as const) : ('CLOSED' as const),
    source: 'SCHEDULE' as const,
    manualOverride: override,
    timeZone: STORE_TIME_ZONE,
    today,
    message,
  }
}

function validateTime(value: unknown, day: StoreDay, label: string) {
  const normalized = String(value ?? '').trim()

  if (!TIME_PATTERN.test(normalized)) {
    throw new AppError(
      400,
      'STORE_HOURS_TIME_INVALID',
      `${day}: ${label} must use 24-hour HH:MM format.`,
    )
  }

  return normalized
}

function validateOpeningHours(input: unknown): StoreOpeningHour[] {
  if (!Array.isArray(input)) {
    throw new AppError(
      400,
      'STORE_HOURS_INVALID',
      'Opening hours must include all seven days.',
    )
  }

  const byDay = new Map<StoreDay, StoreOpeningHour>()

  for (const item of input) {
    if (!item || typeof item !== 'object') {
      throw new AppError(400, 'STORE_HOURS_INVALID', 'Each opening-hours entry is invalid.')
    }

    const record = item as Record<string, unknown>
    const day = String(record.day ?? '').trim().toUpperCase() as StoreDay

    if (!STORE_DAYS.includes(day)) {
      throw new AppError(400, 'STORE_HOURS_DAY_INVALID', 'Select a valid day.')
    }
    if (byDay.has(day)) {
      throw new AppError(400, 'STORE_HOURS_DAY_DUPLICATE', `${day} appears more than once.`)
    }

    const isOpen = Boolean(record.isOpen)
    const openTime = validateTime(record.openTime, day, 'Opening time')
    const closeTime = validateTime(record.closeTime, day, 'Closing time')

    if (isOpen && minutes(openTime) >= minutes(closeTime)) {
      throw new AppError(
        400,
        'STORE_HOURS_RANGE_INVALID',
        `${day}: closing time must be later than opening time.`,
      )
    }

    byDay.set(day, {
      day,
      isOpen,
      openTime,
      closeTime,
    })
  }

  if (byDay.size !== STORE_DAYS.length) {
    throw new AppError(
      400,
      'STORE_HOURS_INCOMPLETE',
      'Opening hours must include all seven days.',
    )
  }

  return STORE_DAYS.map((day) => byDay.get(day)!)
}

function timingsView(store: {
  _id: unknown
  name?: unknown
  status?: unknown
  openingHours?: unknown
  manualOpenOverride?: unknown
}) {
  return {
    storeId: String(store._id),
    storeName: String(store.name ?? ''),
    openingHours: normalizeStoreOpeningHours(store.openingHours),
    manualOpenOverride: manualOverride(store.manualOpenOverride),
    availability: storeAvailabilityView(store),
  }
}

async function sellerStoreDocument(sellerId: string) {
  const store = await StoreModel.findOne({ sellerId })

  if (!store) {
    throw new AppError(404, 'STORE_NOT_FOUND', 'No store is assigned to this seller.')
  }

  return store
}

export async function getSellerStoreTimings(sellerId: string) {
  const store = await sellerStoreDocument(sellerId)
  return timingsView(store.toObject())
}

export async function updateSellerStoreTimings(sellerId: string, input: unknown) {
  const store = await sellerStoreDocument(sellerId)
  const body =
    input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const openingHours = validateOpeningHours(body.openingHours)

  store.set('openingHours', openingHours)
  await store.save()

  return timingsView(store.toObject())
}

export async function updateSellerStoreAvailability(sellerId: string, input: unknown) {
  const store = await sellerStoreDocument(sellerId)
  const body =
    input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const override = String(body.override ?? '').trim().toUpperCase()

  if (!['AUTO', 'OPEN', 'CLOSED'].includes(override)) {
    throw new AppError(
      400,
      'STORE_AVAILABILITY_OVERRIDE_INVALID',
      'Choose Automatic, Open, or Closed.',
    )
  }

  store.set('manualOpenOverride', override)
  await store.save()

  return timingsView(store.toObject())
}

export async function permanentlyCloseSellerStore(sellerId: string) {
  const store = await sellerStoreDocument(sellerId)

  store.set('status', 'ARCHIVED')
  store.set('manualOpenOverride', 'CLOSED')
  await store.save()

  return {
    storeId: String(store._id),
    status: 'ARCHIVED' as const,
    manualOpenOverride: 'CLOSED' as const,
  }
}

export async function assertStoreOpenForCheckout(storeId: string) {
  const store = await StoreModel.findById(storeId).lean()

  if (!store || store.status !== 'ACTIVE') {
    throw new AppError(409, 'STORE_CLOSED', 'This store is currently unavailable.')
  }

  const availability = storeAvailabilityView(store)

  if (!availability.isOpen) {
    throw new AppError(
      409,
      'STORE_CLOSED',
      `${store.name} is currently closed. Please order when the store is open.`,
    )
  }

  return availability
}
