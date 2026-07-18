import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { BrandLogo } from "../components/layout/BrandLogo";
import {
  ActivityIcon,
  AlertIcon,
  BellIcon,
  CartIcon,
  CloseIcon,
  FileTextIcon,
  LayersIcon,
  LogOutIcon,
  MenuIcon,
  MessageIcon,
  PackageIcon,
  SettingsIcon,
  ShieldIcon,
  ShoppingBagIcon,
  UserIcon,
} from "../components/ui/icons";
import { SkipLink } from "../components/accessibility/SkipLink";
import { useAuthStore } from "../features/auth/store/use-auth-store";
import { useConfirmation } from "../components/feedback/ConfirmationProvider";

const navigation = [
  {
    label: "Overview",
    items: [
      { to: "/admin/dashboard", label: "Dashboard", icon: ActivityIcon },
      { to: "/admin/sales", label: "Sales analytics", icon: CartIcon },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { to: "/admin/orders", label: "Orders", icon: ShoppingBagIcon },
      { to: "/admin/products", label: "Products", icon: PackageIcon },
      { to: "/admin/categories", label: "Categories", icon: LayersIcon },
      { to: "/admin/homepage", label: "Homepage", icon: FileTextIcon },
      { to: "/admin/dealers", label: "Order mediators", icon: MessageIcon },
    ],
  },
  {
    label: "Trust & safety",
    items: [
      { to: "/admin/moderation", label: "Moderation", icon: ShieldIcon },
      { to: "/admin/reports", label: "Reports", icon: AlertIcon },
      { to: "/admin/users", label: "Users", icon: UserIcon },
      { to: "/admin/notifications", label: "Notifications", icon: BellIcon },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin/audit-logs", label: "Audit logs", icon: FileTextIcon },
      { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

const routeTitles: Record<string, string> = {
  dashboard: "Dashboard",
  users: "Users",
  products: "Products",
  categories: "Categories",
  homepage: "Homepage",
  moderation: "Moderation",
  orders: "Orders",
  mediator: "Mediator inbox",
  dealers: "Order mediators",
  sales: "Sales analytics",
  reports: "Reports",
  notifications: "Notifications",
  "audit-logs": "Audit logs",
  settings: "Settings",
  operations: "Operations",
};

export function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const confirm = useConfirmation();
  const location = useLocation();
  const routeKey = location.pathname.split("/")[2] || "dashboard";
  const title = routeTitles[routeKey] ?? "Admin console";
  const displayName =
    user?.profile.displayName ?? user?.email.split("@")[0] ?? "Administrator";
  const moderator = user?.role === "MODERATOR";
  const mediator = moderator || Boolean(user?.canMediateOrders);
  const visibleNavigation = moderator
    ? [
        {
          label: "Mediator workspace",
          items: [
            {
              to: "/admin/mediator",
              label: "Mediator inbox",
              icon: MessageIcon,
            },
          ],
        },
      ]
    : navigation;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("admin-dark");
    return () => root.classList.remove("admin-dark");
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      window.requestAnimationFrame(() => menuButtonRef.current?.focus());
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
    window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  }

  return (
    <div className="admin-app-shell">
      <SkipLink />
      <button
        className={`admin-drawer-overlay ${menuOpen ? "open" : ""}`}
        onClick={closeMenu}
        aria-label="Close admin navigation"
        tabIndex={menuOpen ? 0 : -1}
      />
      <aside
        id="admin-navigation"
        className={`admin-command-sidebar ${menuOpen ? "open" : ""}`}
        aria-label="Administration navigation"
        aria-hidden={!menuOpen ? undefined : false}
      >
        <div className="admin-brand-row">
          <BrandLogo />
          <button
            ref={closeButtonRef}
            className="icon-button admin-sidebar-close"
            onClick={closeMenu}
          >
            <CloseIcon />
            <span className="sr-only">Close navigation</span>
          </button>
        </div>

        <div className="admin-workspace-badge">
          <span className="admin-live-dot" />
          <div>
            <strong>
              {moderator
                ? "Mediator workspace"
                : mediator
                  ? "Admin + mediator"
                  : "Admin workspace"}
            </strong>
            <small>
              {moderator
                ? "Assigned conversations only"
                : "Marketplace is operational"}
            </small>
          </div>
        </div>

        {!moderator && mediator ? (
          <div className="admin-nav-group admin-workspace-switcher">
            <span>Workspaces</span>
            <NavLink to="/admin/dashboard">
              <ShieldIcon />
              <span>Admin page</span>
            </NavLink>
            <NavLink to="/admin/mediator">
              <MessageIcon />
              <span>Mediator page</span>
            </NavLink>
          </div>
        ) : null}

        <nav className="admin-command-nav">
          {visibleNavigation.map((group) => (
            <div className="admin-nav-group" key={group.label}>
              <span>{group.label}</span>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
          {user?.role === "SUPER_ADMIN" ? (
            <div className="admin-nav-group">
              <span>Infrastructure</span>
              <NavLink
                to="/admin/operations"
                onClick={() => setMenuOpen(false)}
              >
                <ActivityIcon />
                <span>Operations</span>
              </NavLink>
            </div>
          ) : null}
        </nav>

        <div className="admin-sidebar-profile">
          <div className="admin-avatar">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <strong>{displayName}</strong>
            <small>{user?.role?.replace("_", " ")}</small>
          </div>
          <button
            onClick={async () => {
              if (
                await confirm({
                  title: "Sign out of the admin workspace?",
                  description:
                    "Your current admin session will end on this device.",
                  confirmLabel: "Sign out",
                })
              )
                await logout();
            }}
            aria-label="Sign out"
          >
            <LogOutIcon />
          </button>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="admin-topbar-leading">
            <button
              ref={menuButtonRef}
              className="icon-button admin-menu-button"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              aria-controls="admin-navigation"
            >
              <MenuIcon />
              <span className="sr-only">Open admin navigation</span>
            </button>
            <div>
              <span>Campus Angadi / Admin</span>
              <strong>{title}</strong>
            </div>
          </div>
          <div className="admin-topbar-actions">
            <Link className="button button-outline" to="/">
              View storefront
            </Link>
            {!moderator ? (
              <Link
                className="icon-button"
                to="/admin/notifications"
                aria-label="Notifications"
              >
                <BellIcon />
              </Link>
            ) : null}
            <div className="admin-topbar-avatar" title={displayName}>
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="admin-main" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
