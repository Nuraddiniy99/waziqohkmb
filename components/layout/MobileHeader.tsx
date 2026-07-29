"use client";

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';

export const MobileHeader: React.FC = () => {
  const { isAdmin } = useAuth();

  return (
    <header className="h-14 bg-white/70 backdrop-blur-glass border-b border-glass-emerald flex items-center justify-between px-4 sticky top-0 z-30 lg:hidden">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
          <img
            src="https://dsjkuzirvaniunhwwnml.supabase.co/storage/v1/object/public/assets/icon.png"
            alt="WAZIQOH Logo"
            className="w-full h-full object-contain"
            width={32}
            height={32}
          />
        </div>
        <span className="font-bold text-emerald-dark text-sm">WAZIQOH</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 hidden sm:inline">KMB Mesir</span>
        
        {/* Settings icon for admin on mobile */}
        {isAdmin && (
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
      </div>
    </header>
  );
};

export default MobileHeader;