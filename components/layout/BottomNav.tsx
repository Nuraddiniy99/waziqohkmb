"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useResponsive } from '@/lib/hooks/useResponsive';

const bottomItems = [
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: DashboardIcon },
  { id: 'donatur', label: 'Donatur', path: '/donatur', icon: DonaturIcon },
  { id: 'form', label: 'Form', path: '#form', icon: FormIcon, isCenter: true },
  { id: 'hutang', label: 'Hutang', path: '/hutang', icon: HutangIcon },
  { id: 'mustahiq', label: 'Mustahiq', path: '/mustahiq', icon: MustahiqIcon },
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

interface BottomNavProps {
  onFormClick: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onFormClick }) => {
  const pathname = usePathname();
  const { isMobile } = useResponsive();

  if (!isMobile) return null;

  const handleFormClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFormClick();
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-3 pt-2">
      <div className="bg-white/85 backdrop-blur-strong border border-white/40 rounded-3xl shadow-float flex items-center justify-around h-16">
        {bottomItems.map((item) => {
          const active = item.path !== '#form' && pathname === item.path;
          const Icon = item.icon;

          if (item.isCenter) {
            return (
              <button
                key={item.id}
                onClick={handleFormClick}
                type="button"
                className="relative -top-5 w-14 h-14 rounded-full bg-emerald-brand text-white shadow-glow flex items-center justify-center hover:bg-emerald-dark transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-brand/50"
                aria-label="Buka Form"
              >
                <Icon className="w-6 h-6" />
              </button>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.path}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-200
                ${active ? 'text-emerald-brand' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Icon className={active ? 'text-emerald-brand w-5 h-5' : 'w-5 h-5'} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};