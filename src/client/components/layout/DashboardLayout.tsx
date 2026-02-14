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

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // TODO: Get from auth context
  const userRole = 'admin';

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(userRole));

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
            <Shield className="h-6 w-6 text-gov-gold" />
            <span className="text-sm font-semibold text-white hidden sm:block">
              Complaint Triage Platform
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative text-white/70 hover:text-white">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-gov-red text-[10px] font-bold text-white flex items-center justify-center">
                3
              </span>
            </button>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-gov-blue-500 flex items-center justify-center text-xs font-medium text-white">
                DU
              </div>
              <span className="text-sm text-white/80 hidden sm:block">Demo User</span>
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
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8 min-h-[calc(100vh-3.5rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
