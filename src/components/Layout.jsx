import {
  Bot,
  LayoutDashboard,
  LogOut,
  Menu,
  PackagePlus,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/barang', label: 'Pemasukan Barang', icon: PackagePlus },
  { to: '/keuangan', label: 'Keuangan', icon: Wallet },
  { to: '/gaji', label: 'Slip Gaji', icon: Users },
  { to: '/asisten', label: 'Asisten AI', icon: Bot },
]

function PageTitle() {
  const location = useLocation()
  const active = NAV_ITEMS.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  )
  return (
    <h1 className="text-base font-semibold tracking-tight">
      {active?.label ?? 'Dasbor'}
      <span className="ml-2 text-sm font-normal text-ink-faint">· Seblak HQ</span>
    </h1>
  )
}

function SidebarContent({ onNavigate }) {
  const { user, logout } = useAuth()
  const initial = user?.email?.charAt(0)?.toUpperCase() ?? 'U'

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-surface to-base">
      {/* Top accent line */}
      <div className="h-0.5 w-full bg-gradient-to-r from-chili via-turmeric to-transparent" />

      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-line px-5 py-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-chili to-chili-hover text-sm font-bold text-white shadow-lg shadow-chili/30">
          S
        </span>
        <div className="leading-tight">
          <p className="font-display text-[15px]">Seblak HQ</p>
          <p className="text-[10px] uppercase tracking-widest text-ink-faint">
            Manajemen Internal
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 pt-4">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200',
                isActive
                  ? 'bg-gradient-to-r from-chili-bg to-transparent border-l-2 border-chili text-ink font-medium'
                  : 'text-ink-muted hover:bg-surface-2/70 hover:text-ink border-l-2 border-transparent',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all ${
                    isActive
                      ? 'bg-chili/15 text-chili'
                      : 'text-ink-faint group-hover:text-ink-muted'
                  }`}
                >
                  <Icon size={16} strokeWidth={1.75} />
                </span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="border-t border-line px-3 py-4">
        <div className="mb-1 flex items-center gap-2.5 rounded-xl px-2 py-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 border border-line text-[10px] font-semibold text-ink-muted">
            {initial}
          </span>
          <span className="truncate text-xs text-ink-faint">{user?.email}</span>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-muted transition-all hover:bg-chili-bg hover:text-chili"
        >
          <LogOut size={16} strokeWidth={1.75} />
          Keluar
        </button>
      </div>
    </div>
  )
}

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-svh bg-base text-ink">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-line md:block">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-line animate-slide-left">
            <div className="flex justify-end px-3 pt-3">
              <button
                type="button"
                aria-label="Tutup menu"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-2"
              >
                <X size={18} />
              </button>
            </div>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header glassmorphism */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/70 px-4 py-3.5 backdrop-blur-md md:px-8">
          <button
            type="button"
            aria-label="Buka menu"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-2 md:hidden"
          >
            <Menu size={20} />
          </button>
          <PageTitle />
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  )
}
