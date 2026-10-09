import { Link, useLocation } from 'react-router-dom'
import {
  LayoutGrid,
  Search,
  ListChecks,
  History,
  BarChart3,
  Plus,
  LogOut,
  SearchCheck,
  Users,
  Database,
  DatabaseBackup
} from 'lucide-react'
import { cn } from '@/utils/utils'
import { getInitials } from '@/utils/utility'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './protected-route'
import { api } from '@/api/client'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid },
  { href: '/iplookup', label: 'IP Lookup', icon: Search },
  { href: '/lookup', label: 'Single Lookup', icon: SearchCheck },
  { href: '/batch', label: 'Batch Lookup', icon: ListChecks },
  { href: '/history', label: 'History', icon: History },
  { href: '/statistics', label: 'Statistics', icon: BarChart3 },
  { href: '/db', label: 'Database References', icon: Database },
  { href: '/db/insert', label: 'Insert DB', icon: DatabaseBackup, adminOnly: true },
  { href: '/users', label: 'Users', icon: Users, adminOnly: true },
]


export function Sidebar() {
  const { pathname } = useLocation()

  const { user } = useAuth() || {};
  const isAdmin = user?.role === 'admin'

  const filteredNavItems = navItems.filter((item) => {
    if (item.adminOnly) {
      return isAdmin
    }
    return true
  })

  const navigate = useNavigate();
  const handleLogout = async (e?: React.MouseEvent) => {
      e?.preventDefault();
      try {
        await api.post(`/auth/logout`);
      } catch (error) {
        console.error("Failed to hit API logout backend:", error);
      } finally {
        navigate('/login', {replace: true});
      }
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
      <div className="px-6 pt-6">
        <h1 className="text-lg font-bold leading-tight text-foreground">
          <a href="/">
            <img src="/NTTDATA_blue.png" alt="" style={{ float: "right", width: "200px", height: "40px", margin: "10px" }}/>
          </a>
        </h1>
      </div>

      <div className="px-4 pt-6">
        <Link
          to="/lookup"
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 font-mono text-sm text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" aria-hidden="true" />
          New Lookup
        </Link>
      </div>

      <nav className="mt-6 flex-1 space-y-1 px-4" aria-label="Main navigation">
        {filteredNavItems.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              to={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-foreground after:absolute after:inset-y-0 after:-left-0 after:w-1 after:rounded-full after:bg-primary'
                  : 'text-foreground/80 hover:bg-secondary hover:text-foreground',
              )}
            >
              <item.icon className="size-5" aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border px-4 py-4">
        <a
          type='button'
          onClick={handleLogout}
          className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="size-5" aria-hidden="true" />
          Sign Out
        </a>
        <div className="mt-3 flex items-center gap-3 px-3">
          <div className="flex shrink-0 size-10 items-center justify-center rounded-full bg-accent font-mono text-xs font-semibold text-accent-foreground">
            {getInitials(user?.email)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground break-words">
              {user?.email.replace('@', '\u200B@')}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}