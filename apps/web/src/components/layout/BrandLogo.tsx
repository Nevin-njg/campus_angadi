import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { webEnv } from '../../config/env'
import { settingsApi } from '../../features/settings/api/settings.api'

export function BrandLogo() {
  const settings = useQuery({
    queryKey: ['settings', 'public'],
    queryFn: settingsApi.public,
    staleTime: 5 * 60_000,
  })
  const appName = settings.data?.appName ?? webEnv.appName
  const brandMark = settings.data?.brandMark ?? webEnv.brandMark
  const campusName = settings.data?.campusDisplayName ?? webEnv.campusDisplayName
  return (
    <Link to="/" className="brand-logo" aria-label={`${appName} home`}>
      <span className="brand-mark">{brandMark}</span>
      <span className="brand-copy">
        <strong>{appName}</strong>
        <small>{campusName}</small>
      </span>
    </Link>
  )
}
