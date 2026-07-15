import { NavLink, Outlet } from 'react-router-dom'
import { Navbar } from '../components/layout/Navbar'
import { MessageIcon, PackageIcon, ShieldIcon, UserIcon } from '../components/ui/icons'
import { SkipLink } from '../components/accessibility/SkipLink'
import { useAuthStore } from '../features/auth/store/use-auth-store'

export function AdminLayout() {
  const user = useAuthStore((state) => state.user)
  
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
      isActive 
        ? 'bg-indigo-600/20 text-indigo-400 font-medium shadow-[0_0_15px_rgba(79,70,229,0.15)] border border-indigo-500/30' 
        : 'text-gray-400 hover:text-white hover:bg-white/5'
    }`

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#111827] to-black text-gray-100 flex flex-col font-sans">
      <SkipLink />
      {/* Keeping Navbar but ensuring it adapts to dark mode if possible or wraps correctly */}
      <div className="bg-gray-900 border-b border-gray-800">
        <Navbar />
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 flex-shrink-0 bg-white/5 backdrop-blur-xl border-r border-white/10 overflow-y-auto hidden md:flex flex-col" aria-label="Administration navigation">
          <div className="p-8 pb-4">
            <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-gray-500 mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              Admin Control
            </h2>
            <nav className="flex flex-col gap-2">
              <NavLink to="/admin/dashboard" className={navLinkClass}>
                <UserIcon className="w-5 h-5 opacity-80" />
                Dashboard
              </NavLink>
              <NavLink to="/admin/users" className={navLinkClass}>
                <UserIcon className="w-5 h-5 opacity-80" />
                Users
              </NavLink>
              <NavLink to="/admin/products" className={navLinkClass}>
                <PackageIcon className="w-5 h-5 opacity-80" />
                Products
              </NavLink>
              <NavLink to="/admin/categories" className={navLinkClass}>
                <PackageIcon className="w-5 h-5 opacity-80" />
                Categories
              </NavLink>
              <NavLink to="/admin/homepage" className={navLinkClass}>
                <UserIcon className="w-5 h-5 opacity-80" />
                Homepage
              </NavLink>
              <NavLink to="/admin/moderation" className={navLinkClass}>
                <PackageIcon className="w-5 h-5 opacity-80" />
                Moderation
              </NavLink>
              <NavLink to="/admin/orders" className={navLinkClass}>
                <PackageIcon className="w-5 h-5 opacity-80" />
                Orders
              </NavLink>
              <NavLink to="/admin/dealers" className={navLinkClass}>
                <MessageIcon className="w-5 h-5 opacity-80" />
                WhatsApp dealers
              </NavLink>
              <NavLink to="/admin/sales" className={navLinkClass}>
                <PackageIcon className="w-5 h-5 opacity-80" />
                Sales
              </NavLink>
              <NavLink to="/admin/reports" className={navLinkClass}>
                <MessageIcon className="w-5 h-5 opacity-80" />
                Reports
              </NavLink>
              <NavLink to="/admin/notifications" className={navLinkClass}>
                <MessageIcon className="w-5 h-5 opacity-80" />
                Notifications
              </NavLink>
              <NavLink to="/admin/audit-logs" className={navLinkClass}>
                <ShieldIcon className="w-5 h-5 opacity-80" />
                Audit logs
              </NavLink>
              <NavLink to="/admin/settings" className={navLinkClass}>
                <UserIcon className="w-5 h-5 opacity-80" />
                Settings
              </NavLink>
              {user?.role === 'SUPER_ADMIN' ? (
                <NavLink to="/admin/operations" className={navLinkClass}>
                  <ShieldIcon className="w-5 h-5 opacity-80" />
                  Operations
                </NavLink>
              ) : null}
            </nav>
          </div>
        </aside>
        
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-10" id="main-content" tabIndex={-1}>
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
