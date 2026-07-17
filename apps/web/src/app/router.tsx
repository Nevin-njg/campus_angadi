import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '../features/auth/components/ProtectedRoute'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'
import { AccountLayout } from '../layouts/AccountLayout'
import { AdminLayout } from '../layouts/AdminLayout'
import { PublicLayout } from '../layouts/PublicLayout'

const HomePage = lazy(() =>
  import('../pages/HomePage').then((module) => ({ default: module.HomePage })),
)
const NotFoundPage = lazy(() =>
  import('../pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
)
const UnauthorizedPage = lazy(() =>
  import('../pages/UnauthorizedPage').then((module) => ({ default: module.UnauthorizedPage })),
)
const LoginPage = lazy(() =>
  import('../features/auth/pages/LoginPage').then((module) => ({ default: module.LoginPage })),
)
const VerifyOtpPage = lazy(() =>
  import('../features/auth/pages/VerifyOtpPage').then((module) => ({
    default: module.VerifyOtpPage,
  })),
)
const ProfilePage = lazy(() =>
  import('../features/profile/pages/ProfilePage').then((module) => ({
    default: module.ProfilePage,
  })),
)
const OfficialStorePage = lazy(() =>
  import('../features/products/pages/OfficialStorePage').then((module) => ({
    default: module.OfficialStorePage,
  })),
)
const SecondHandStorePage = lazy(() =>
  import('../features/products/pages/SecondHandStorePage').then((module) => ({
    default: module.SecondHandStorePage,
  })),
)
const ProductDetailsPage = lazy(() =>
  import('../features/products/pages/ProductDetailsPage').then((module) => ({
    default: module.ProductDetailsPage,
  })),
)
const CartPage = lazy(() =>
  import('../features/cart/pages/CartPage').then((module) => ({ default: module.CartPage })),
)
const CheckoutPage = lazy(() =>
  import('../features/orders/pages/CheckoutPage').then((module) => ({
    default: module.CheckoutPage,
  })),
)
const MyOrdersPage = lazy(() =>
  import('../features/orders/pages/MyOrdersPage').then((module) => ({
    default: module.MyOrdersPage,
  })),
)
const OrderDetailsPage = lazy(() =>
  import('../features/orders/pages/OrderDetailsPage').then((module) => ({
    default: module.OrderDetailsPage,
  })),
)
const UserOrderChatPage = lazy(() =>
  import('../features/chat/pages/OrderChatPage').then((module) => ({
    default: module.UserOrderChatPage,
  })),
)
const AdminOrderChatPage = lazy(() =>
  import('../features/chat/pages/OrderChatPage').then((module) => ({
    default: module.AdminOrderChatPage,
  })),
)
const MyListingsPage = lazy(() =>
  import('../features/listings/pages/MyListingsPage').then((module) => ({
    default: module.MyListingsPage,
  })),
)
const ListingDetailsPage = lazy(() =>
  import('../features/listings/pages/ListingDetailsPage').then((module) => ({
    default: module.ListingDetailsPage,
  })),
)
const ListingFormPage = lazy(() =>
  import('../features/listings/pages/ListingFormPage').then((module) => ({
    default: module.ListingFormPage,
  })),
)
const NotificationsPage = lazy(() =>
  import('../features/notifications/pages/NotificationsPage').then((module) => ({
    default: module.NotificationsPage,
  })),
)
const MyReportsPage = lazy(() =>
  import('../features/reports/pages/MyReportsPage').then((module) => ({
    default: module.MyReportsPage,
  })),
)
const AdminDashboardPage = lazy(() =>
  import('../features/admin/pages/AdminDashboardPage').then((module) => ({
    default: module.AdminDashboardPage,
  })),
)
const AdminUsersPage = lazy(() =>
  import('../features/admin/pages/AdminUsersPage').then((module) => ({
    default: module.AdminUsersPage,
  })),
)
const AdminUserDetailPage = lazy(() =>
  import('../features/admin/pages/AdminUserDetailPage').then((module) => ({
    default: module.AdminUserDetailPage,
  })),
)
const AdminSalesPage = lazy(() =>
  import('../features/admin/pages/AdminSalesPage').then((module) => ({
    default: module.AdminSalesPage,
  })),
)
const AdminReportsPage = lazy(() =>
  import('../features/admin/pages/AdminReportsPage').then((module) => ({
    default: module.AdminReportsPage,
  })),
)
const AdminNotificationsPage = lazy(() =>
  import('../features/admin/pages/AdminNotificationsPage').then((module) => ({
    default: module.AdminNotificationsPage,
  })),
)
const AdminAuditPage = lazy(() =>
  import('../features/admin/pages/AdminAuditPage').then((module) => ({
    default: module.AdminAuditPage,
  })),
)
const AdminSettingsPage = lazy(() =>
  import('../features/admin/pages/AdminSettingsPage').then((module) => ({
    default: module.AdminSettingsPage,
  })),
)
const AdminProductsPage = lazy(() =>
  import('../features/admin/pages/AdminProductsPage').then((module) => ({
    default: module.AdminProductsPage,
  })),
)
const AdminProductEditPage = lazy(() =>
  import('../features/admin/pages/AdminProductEditPage').then((module) => ({
    default: module.AdminProductEditPage,
  })),
)
const AdminCategoriesPage = lazy(() =>
  import('../features/admin/pages/AdminCategoriesPage').then((module) => ({
    default: module.AdminCategoriesPage,
  })),
)
const AdminHomepagePage = lazy(() =>
  import('../features/admin/pages/AdminHomepagePage').then((module) => ({
    default: module.AdminHomepagePage,
  })),
)
const AdminModerationPage = lazy(() =>
  import('../features/admin/pages/AdminModerationPage').then((module) => ({
    default: module.AdminModerationPage,
  })),
)
const AdminModerationDetailPage = lazy(() =>
  import('../features/admin/pages/AdminModerationDetailPage').then((module) => ({
    default: module.AdminModerationDetailPage,
  })),
)
const AdminOrdersPage = lazy(() =>
  import('../features/admin/pages/AdminOrdersPage').then((module) => ({
    default: module.AdminOrdersPage,
  })),
)
const AdminOrderDetailPage = lazy(() =>
  import('../features/admin/pages/AdminOrderDetailPage').then((module) => ({
    default: module.AdminOrderDetailPage,
  })),
)
const AdminOperationsPage = lazy(() =>
  import('../features/admin/pages/AdminOperationsPage').then((module) => ({
    default: module.AdminOperationsPage,
  })),
)
const AdminDealersPage = lazy(() =>
  import('../features/admin/pages/AdminDealersPage').then((module) => ({
    default: module.AdminDealersPage,
  })),
)

function page(node: ReactNode) {
  return (
    <Suspense
      fallback={
        <div className="route-loading">
          <LoadingSkeleton label="Loading page" />
        </div>
      }
    >
      {node}
    </Suspense>
  )
}

function administratorPage(node: ReactNode) {
  return <ProtectedRoute roles={['ADMIN', 'SUPER_ADMIN']}>{page(node)}</ProtectedRoute>
}

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: page(<HomePage />) },
      { path: '/products/:slug', element: page(<ProductDetailsPage />) },
      { path: '/official-store', element: page(<OfficialStorePage />) },
      { path: '/second-hand-store', element: page(<SecondHandStorePage />) },
      { path: '/cart', element: <ProtectedRoute>{page(<CartPage />)}</ProtectedRoute> },
      { path: '/checkout', element: <ProtectedRoute>{page(<CheckoutPage />)}</ProtectedRoute> },
      {
        path: '/notifications',
        element: <ProtectedRoute>{page(<NotificationsPage />)}</ProtectedRoute>,
      },
      { path: '/unauthorized', element: page(<UnauthorizedPage />) },
    ],
  },
  { path: '/login', element: page(<LoginPage />) },
  { path: '/verify-otp', element: page(<VerifyOtpPage />) },
  {
    path: '/account',
    element: (
      <ProtectedRoute>
        <AccountLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: 'profile', element: page(<ProfilePage />) },
      { path: 'orders', element: page(<MyOrdersPage />) },
      { path: 'orders/:id', element: page(<OrderDetailsPage />) },
      { path: 'orders/:id/chat', element: page(<UserOrderChatPage />) },
      { path: 'listings', element: page(<MyListingsPage />) },
      { path: 'listings/new', element: page(<ListingFormPage />) },
      { path: 'listings/:id', element: page(<ListingDetailsPage />) },
      { path: 'listings/:id/edit', element: page(<ListingFormPage />) },
      { path: 'notifications', element: <Navigate to="/notifications" replace /> },
      { path: 'reports', element: page(<MyReportsPage />) },
    ],
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute roles={['MODERATOR', 'ADMIN', 'SUPER_ADMIN']}>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="orders" replace /> },
      { path: 'dashboard', element: administratorPage(<AdminDashboardPage />) },
      { path: 'users', element: administratorPage(<AdminUsersPage />) },
      { path: 'users/:id', element: administratorPage(<AdminUserDetailPage />) },
      { path: 'sales', element: administratorPage(<AdminSalesPage />) },
      { path: 'reports', element: administratorPage(<AdminReportsPage />) },
      { path: 'notifications', element: administratorPage(<AdminNotificationsPage />) },
      { path: 'audit-logs', element: administratorPage(<AdminAuditPage />) },
      { path: 'settings', element: administratorPage(<AdminSettingsPage />) },
      { path: 'operations', element: administratorPage(<AdminOperationsPage />) },
      { path: 'products', element: administratorPage(<AdminProductsPage />) },
      { path: 'products/:id/edit', element: administratorPage(<AdminProductEditPage />) },
      { path: 'categories', element: administratorPage(<AdminCategoriesPage />) },
      { path: 'homepage', element: administratorPage(<AdminHomepagePage />) },
      { path: 'moderation', element: administratorPage(<AdminModerationPage />) },
      { path: 'moderation/:id', element: administratorPage(<AdminModerationDetailPage />) },
      { path: 'orders', element: page(<AdminOrdersPage />) },
      { path: 'mediator', element: page(<AdminOrdersPage />) },
      { path: 'orders/:id', element: page(<AdminOrderDetailPage />) },
      { path: 'orders/:id/chat', element: page(<AdminOrderChatPage />) },
      { path: 'dealers', element: administratorPage(<AdminDealersPage />) },
    ],
  },
  { path: '*', element: page(<NotFoundPage />) },
])
