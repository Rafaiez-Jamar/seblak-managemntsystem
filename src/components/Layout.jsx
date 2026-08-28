import {
  Bot,
  Bell,
  LayoutDashboard,
  LogOut,
  PackagePlus,
  Users,
  Wallet,
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { enablePushNotifications } from '../lib/notifications'

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

function NotificationButton() {
  const { user } = useAuth()
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')

  async function handleEnable() {
    setState('loading')
    setError('')
    try {
      await enablePushNotifications(user.id)
      setState('enabled')
    } catch (error) {
      setState('idle')
      setError(error.message || 'Notifikasi gagal diaktifkan.')
    }
  }

  if (state === 'enabled') {
    return <span className="hidden items-center gap-2 rounded-full border border-herb/20 bg-herb-bg px-3 py-1.5 text-[10px] text-herb sm:flex"><Bell size={12} /> Notifikasi aktif</span>
  }

  return (
    <div className="relative flex items-center gap-2">
      <button type="button" onClick={handleEnable} disabled={state === 'loading'} title="Aktifkan notifikasi" className="flex items-center gap-2 rounded-full border border-turmeric/20 bg-turmeric-bg px-3 py-1.5 text-[10px] text-turmeric transition-colors hover:border-turmeric/40 disabled:opacity-60">
        <Bell size={12} /> {state === 'loading' ? 'Mengaktifkan...' : 'Aktifkan notifikasi'}
      </button>
      {error && <span role="alert" className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-chili/30 bg-surface px-3 py-2 text-[10px] leading-relaxed text-chili shadow-xl">{error}</span>}
    </div>
  )
}

function SidebarContent({ onNavigate }) {
  const { user, logout } = useAuth()
  const initial = user?.email?.charAt(0)?.toUpperCase() ?? 'U'

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#17151d] via-surface to-base">
      {/* Top accent line */}
      <div className="h-0.5 w-full bg-chili/70" />

      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-line px-5 py-6">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-chili/40 bg-gradient-to-br from-chili/25 via-surface-2 to-turmeric/15 text-[11px] font-bold tracking-tight text-ink shadow-lg shadow-chili/10">
          SH
          <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-[#17151d] bg-turmeric" />
        </span>
        <div className="leading-tight">
          <p className="font-display text-[17px] tracking-tight text-ink">Seblak <span className="text-chili">HQ</span></p>
          <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.22em] text-ink-faint">Operational desk</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 pt-6">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                'group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all duration-200',
                isActive
                  ? 'bg-gradient-to-r from-chili/20 via-chili-bg to-transparent text-ink font-medium shadow-inner shadow-chili/10'
                  : 'text-ink-muted hover:bg-surface-2/70 hover:text-ink',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all ${
                    isActive
                      ? 'bg-chili text-white shadow-md shadow-chili/25'
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
      <div className="border-t border-line bg-black/10 px-3 py-4">
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

function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-2xl border border-line-strong bg-surface/95 p-1.5 shadow-2xl shadow-black/30 backdrop-blur-xl md:hidden">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] transition-colors ${
              isActive ? 'bg-chili-bg text-chili' : 'text-ink-faint hover:text-ink-muted'
            }`
          }
        >
          <Icon size={17} strokeWidth={1.75} />
          <span className="w-full truncate text-center">{label.replace('Pemasukan ', '')}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export default function Layout({ children }) {
  return (
    <div className="flex min-h-svh bg-base text-ink">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-line md:block">
        <SidebarContent />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header glassmorphism */}
        <header className="sticky top-0 z-30 flex min-h-[4.5rem] items-center justify-between gap-3 border-b border-line bg-[#11131d]/90 px-4 backdrop-blur-md md:px-8">
          <div className="flex items-center gap-3"><span className="hidden h-8 w-1 rounded-full bg-gradient-to-b from-chili to-turmeric sm:block" /><PageTitle /></div>
          <NotificationButton />
        </header>
        <main className="flex-1 px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">{children}</main>
      </div>

      <MobileBottomNav />
    </div>
  )
}
