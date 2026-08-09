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
  return (
    <Link to="/" className="brand-logo" aria-label={`${appName} home`}>
      <span className="brand-mark" aria-hidden="true">
        <img src="/brand/campus-angadi-logo.png" alt="" />
      </span>
      <span className="brand-copy">
        <strong>{appName}</strong>
      </span>
    </Link>
  )
}
