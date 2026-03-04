'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Shield,
  LayoutDashboard,
  FileText,
  AlertTriangle,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'My Queue',
    href: '/dashboard/officer',
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ['complaint_officer', 'supervisor', 'admin'],
  },
  {
    label: 'All Complaints',
    href: '/dashboard/complaints',
    icon: <FileText className="h-5 w-5" />,
    roles: ['complaint_officer', 'supervisor', 'executive', 'admin'],
  },
  {
    label: 'Systemic Issues',
    href: '/dashboard/systemic',
    icon: <AlertTriangle className="h-5 w-5" />,
    roles: ['supervisor', 'executive', 'admin'],
  },
  {
    label: 'Team Overview',
    href: '/dashboard/supervisor',
    icon: <Users className="h-5 w-5" />,
    roles: ['supervisor', 'admin'],
  },
  {
    label: 'Executive View',
    href: '/dashboard/executive',
    icon: <BarChart3 className="h-5 w-5" />,
    roles: ['executive', 'admin'],
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: <Settings className="h-5 w-5" />,
    roles: ['admin'],
  },
];

const ROLE_CONFIG = {
  admin: { label: 'Administrator', initials: 'AD', name: 'Admin User' },
  supervisor: { label: 'Supervisor', initials: 'JM', name: 'Jane Morrison' },
  complaint_officer: { label: 'Complaint Officer', initials: 'SC', name: 'Sarah Chen' },
  executive: { label: 'Executive', initials: 'RD', name: 'Robert Davis' },
} as const;

type RoleKey = keyof typeof ROLE_CONFIG;

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  // Role selector for demo — in production, this comes from JWT/auth context
  const [userRole, setUserRole] = useState<RoleKey>('admin');

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(userRole));
  const currentRole = ROLE_CONFIG[userRole];

  return (
    <div className="min-h-screen bg-gov-grey-50">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-gov-navy shadow-sm">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-white/80 hover:text-white"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link href="/" className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-gov-gold" />
              <span className="text-sm font-semibold text-white hidden sm:block">
                Complaint Triage Platform
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications */}
            <button className="relative text-white/70 hover:text-white">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-gov-red text-[10px] font-bold text-white flex items-center justify-center">
                3
              </span>
            </button>

            {/* Role Selector (demo) */}
            <div className="relative">
              <button
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-white/10 transition-colors"
              >
                <div className="h-7 w-7 rounded-full bg-gov-blue-500 flex items-center justify-center text-xs font-medium text-white">
                  {currentRole.initials}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm text-white/90 font-medium leading-tight">{currentRole.name}</p>
                  <p className="text-[10px] text-white/50 leading-tight">{currentRole.label}</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-white/50" />
              </button>

              {roleMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setRoleMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg bg-white shadow-xl ring-1 ring-gov-grey-200 py-1">
                    <div className="px-3 py-2 border-b border-gov-grey-100">
                      <p className="text-[10px] font-medium text-gov-grey-400 uppercase tracking-wider">Switch Role (Demo)</p>
                    </div>
                    {(Object.entries(ROLE_CONFIG) as [RoleKey, typeof ROLE_CONFIG[RoleKey]][]).map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => { setUserRole(key); setRoleMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gov-grey-50 transition-colors ${
                          userRole === key ? 'bg-gov-blue-50' : ''
                        }`}
                      >
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium text-white ${
                          userRole === key ? 'bg-gov-blue-600' : 'bg-gov-grey-400'
                        }`}>
                          {cfg.initials}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${userRole === key ? 'text-gov-blue-700' : 'text-gov-grey-700'}`}>
                            {cfg.name}
                          </p>
                          <p className="text-xs text-gov-grey-500">{cfg.label}</p>
                        </div>
                      </button>
                    ))}
                    <div className="border-t border-gov-grey-100 mt-1 pt-1">
                      <Link
                        href="/"
                        className="flex items-center gap-3 px-3 py-2 text-sm text-gov-grey-600 hover:bg-gov-grey-50 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-14 left-0 z-20 w-60 bg-white border-r border-gov-grey-200 transform transition-transform lg:translate-x-0 lg:static lg:inset-auto ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <nav className="p-3 space-y-1">
            {visibleItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-gov-blue-50 text-gov-blue-700'
                      : 'text-gov-grey-600 hover:bg-gov-grey-50 hover:text-gov-grey-900'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gov-grey-100">
            <div className="rounded-md bg-gov-grey-50 px-3 py-2">
              <p className="text-[10px] font-medium text-gov-grey-400 uppercase tracking-wider">Viewing as</p>
              <p className="text-sm font-medium text-gov-grey-700">{currentRole.label}</p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8 min-h-[calc(100vh-3.5rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
