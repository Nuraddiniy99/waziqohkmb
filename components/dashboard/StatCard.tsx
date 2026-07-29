"use client";

import React from 'react';
import { Card } from '@/components/ui/Card';

interface StatCardProps {
  title: string;
  valueEGP?: number;
  valueIDR?: number;
  valueUSD?: number;
  value?: number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: 'emerald' | 'gold' | 'blue' | 'red';
  trend?: number;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  valueEGP,
  valueIDR,
  valueUSD,
  value,
  subtitle,
  icon,
  color = 'emerald',
  trend,
}) => {
  const colors = {
    emerald: {
      bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/70',
      border: 'border-emerald-200/60',
      iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
      text: 'text-emerald-700',
      trendUp: 'text-emerald-600',
      trendDown: 'text-red-500',
      shadow: 'shadow-emerald-100/50',
    },
    gold: {
      bg: 'bg-gradient-to-br from-amber-50 to-amber-100/70',
      border: 'border-amber-200/60',
      iconBg: 'bg-gradient-to-br from-amber-500 to-amber-600',
      text: 'text-amber-700',
      trendUp: 'text-amber-600',
      trendDown: 'text-red-500',
      shadow: 'shadow-amber-100/50',
    },
    blue: {
      bg: 'bg-gradient-to-br from-blue-50 to-blue-100/70',
      border: 'border-blue-200/60',
      iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
      text: 'text-blue-700',
      trendUp: 'text-blue-600',
      trendDown: 'text-red-500',
      shadow: 'shadow-blue-100/50',
    },
    red: {
      bg: 'bg-gradient-to-br from-rose-50 to-rose-100/70',
      border: 'border-rose-200/60',
      iconBg: 'bg-gradient-to-br from-rose-500 to-rose-600',
      text: 'text-rose-700',
      trendUp: 'text-rose-600',
      trendDown: 'text-red-500',
      shadow: 'shadow-rose-100/50',
    },
  };

  const colorStyle = colors[color];

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('id-ID').format(num);
  };

  const formatCurrency = (amount: number, currency: 'IDR' | 'EGP' | 'USD'): string => {
    switch (currency) {
      case 'IDR': return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
      case 'EGP': return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EGP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
      case 'USD': return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
      default: return `${amount}`;
    }
  };

  return (
    <Card 
      hover 
      className={`relative overflow-hidden ${colorStyle.bg} ${colorStyle.border} border ${colorStyle.shadow} transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}
      padding="md"
    >
      {/* Decorative gradient accent */}
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full ${colorStyle.iconBg} opacity-5 -translate-y-1/2 translate-x-1/2`} />
      <div className={`absolute bottom-0 left-0 w-24 h-24 rounded-full ${colorStyle.iconBg} opacity-5 translate-y-1/2 -translate-x-1/2`} />
      
      <div className="flex items-start justify-between relative z-10">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-500 mb-2">{title}</p>
          {value !== undefined && (
            <p className="text-2xl font-extrabold text-slate-800">{formatNumber(value)}</p>
          )}
          {valueEGP !== undefined && (
            <p className="text-lg font-bold text-slate-800">{formatCurrency(valueEGP, 'EGP')}</p>
          )}
          {valueIDR !== undefined && (
            <p className="text-sm font-semibold text-slate-600 mt-0.5">{formatCurrency(valueIDR, 'IDR')}</p>
          )}
          {valueUSD !== undefined && (
            <p className="text-sm font-semibold text-slate-600 mt-0.5">{formatCurrency(valueUSD, 'USD')}</p>
          )}
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? colorStyle.trendUp : colorStyle.trendDown}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {trend >= 0 ? (
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                ) : (
                  <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                )}
              </svg>
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorStyle.iconBg} text-white shadow-lg flex-shrink-0`}>
          {icon}
        </div>
      </div>
    </Card>
  );
};