"use client";

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { useResponsive } from '@/lib/hooks/useResponsive';

export const Header: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { isMobile } = useResponsive();

  const userInitial = user?.nama_lengkap?.charAt(0) || 'U';
  const userName = user?.nama_lengkap || 'User';
  const userRole = user?.role || 'user';

  return (
    <header className="h-16 bg-white/70 backdrop-blur-glass border-b border-glass-emerald flex items-center justify-between px-6 sticky top-0 z-30">
      <div>
        <h2 className="text-lg font-bold text-emerald-dark">WAZIQOH Super App</h2>
        <p className="text-xs text-slate-500">Manajemen Zakat & Muamalah</p>
      </div>
      <div className="flex items-center gap-3">
        {/* Settings icon for admin on desktop */}
        {isAdmin && !isMobile && (
          <Link
            href="/pengaturan"
            className="p-2 rounded-lg hover:bg-emerald-brand/10 text-slate-500 hover:text-emerald-brand transition-all duration-200"
            aria-label="Pengaturan"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        )}
        
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-emerald-dark">{userName}</p>
          <p className="text-xs text-slate-500 capitalize">{userRole}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-emerald-brand/10 flex items-center justify-center flex-shrink-0">
          <span className="font-bold text-emerald-brand text-sm">{userInitial}</span>
        </div>
      </div>
    </header>
  );
};