// components/layout/Sidebar.tsx

"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useResponsive } from '@/lib/hooks/useResponsive';

// 🔥 FIX: Tambahkan isAction ke tipe menu item
interface MenuItem {
  id: string;
  label: string;
  path: string;
  icon: React.FC<{ className?: string }>;
  isAction?: boolean;  // 🔥 TAMBAHKAN INI
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: DashboardIcon },
  { id: 'donatur', label: 'List Donatur', path: '/donatur', icon: DonaturIcon },
  { id: 'form', label: 'Form', path: '#form', icon: FormIcon, isAction: true },
  { id: 'hutang', label: 'Hutang Piutang', path: '/hutang', icon: HutangIcon },
  { id: 'mustahiq', label: 'Mustahiq', path: '/mustahiq', icon: MustahiqIcon },
];

const adminMenu: MenuItem[] = [
  { id: 'pengaturan', label: 'Pengaturan', path: '/pengaturan', icon: SettingsIcon },
];

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function DonaturIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function FormIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function HutangIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function MustahiqIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

interface SidebarProps {
  onFormClick: () => void;
  masaJabatan: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ onFormClick, masaJabatan }) => {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();
  const { isDesktop } = useResponsive();
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!isDesktop) return null;

  const allMenuItems = isAdmin ? [...menuItems, ...adminMenu] : menuItems;

  const getMenuPath = (item: MenuItem) => {
    if (item.isAction) return '#';
    return item.path;
  };

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  const userInitial = user?.nama_lengkap?.charAt(0) || 'U';
  const userName = user?.nama_lengkap || 'User';
  const userRole = user?.role || 'user';

  return (
    <aside className="fixed left-0 top-0 h-screen w-[260px] bg-white/80 backdrop-blur-glass border-r border-white/40 z-40 flex flex-col shadow-glass">
      {/* Logo Section */}
      <div className="px-6 py-5 border-b border-glass-emerald">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
            <img
              src="https://dsjkuzirvaniunhwwnml.supabase.co/storage/v1/object/public/assets/icon.png"
              alt="WAZIQOH Logo"
              className="w-full h-full object-contain"
              width={40}
              height={40}
            />
          </div>
          <div>
            <h1 className="text-lg font-bold text-emerald-dark leading-tight">WAZIQOH</h1>
            <p className="text-[10px] text-slate-500 font-medium">KMB Mesir</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <ClockIcon className="text-emerald-brand" />
          <span className="font-medium">{masaJabatan}</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-emerald-brand font-semibold">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-brand animate-pulse" />
          {currentTime}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-1">
          {allMenuItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            if (item.isAction) {
              return (
                <button
                  key={item.id}
                  onClick={onFormClick}
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                    bg-emerald-brand text-white shadow-glow hover:bg-emerald-dark
                    transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-brand/50"
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.id}
                href={getMenuPath(item)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                  ${active
                    ? 'bg-emerald-brand/10 text-emerald-brand border border-emerald-brand/20 shadow-glow'
                    : 'text-slate-600 hover:bg-emerald-brand/5 hover:text-emerald-brand'
                  }`}
              >
                <Icon className={active ? 'text-emerald-brand w-5 h-5' : 'w-5 h-5'} />
                <span>{item.label}</span>
                {active && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-brand" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User Profile */}
      <div className="px-3 py-4 border-t border-glass-emerald">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/50 border border-glass-emerald">
          <div className="w-9 h-9 rounded-full bg-emerald-brand/10 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-emerald-brand">{userInitial}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-dark truncate">{userName}</p>
            <p className="text-xs text-slate-500 capitalize">{userRole}</p>
          </div>
        </div>
        <button
          onClick={logout}
          type="button"
          className="w-full mt-2 flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium
            text-red-500 hover:bg-red-50 transition-all duration-200 focus:outline-none"
        >
          <LogoutIcon className="w-5 h-5" />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
};