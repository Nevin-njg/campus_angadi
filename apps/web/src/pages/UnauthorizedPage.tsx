import { Link } from 'react-router-dom'
import { AlertIcon } from '../components/ui/icons'

export function UnauthorizedPage() {
  return (
    <div className="status-page">
      <AlertIcon />
      <h1>Access restricted</h1>
      <p>Your account does not have permission to open this page.</p>
      <Link className="button button-primary" to="/">
        Return home
      </Link>
    </div>
  )
}
