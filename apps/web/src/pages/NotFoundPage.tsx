import { Link } from 'react-router-dom'
import { SearchIcon } from '../components/ui/icons'

export function NotFoundPage() {
  return (
    <div className="status-page">
      <SearchIcon />
      <h1>Page not found</h1>
      <p>The page may have moved or does not exist.</p>
      <Link className="button button-primary" to="/">
        Return home
      </Link>
    </div>
  )
}
