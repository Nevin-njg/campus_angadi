import type { PublicSettings } from '@campusbaza/contracts'
import { apiRequest } from '../../../lib/api-client'
export const settingsApi = { public: () => apiRequest<PublicSettings>('/settings/public') }
