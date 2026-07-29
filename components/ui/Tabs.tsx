"use client";

import React, { useState } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  variant?: 'default' | 'pills' | 'underline';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultTab,
  variant = 'default',
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const variants = {
    default: 'bg-white/50 backdrop-blur-sm rounded-xl p-1 border border-glass-emerald',
    pills: 'space-x-1',
    underline: 'border-b border-slate-200',
  };

  const tabStyles = {
    default: (isActive: boolean) =>
      `px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
        isActive
          ? 'bg-emerald-brand text-white shadow-sm'
          : 'text-slate-600 hover:text-emerald-brand hover:bg-emerald-brand/5'
      }`,
    pills: (isActive: boolean) =>
      `px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
        isActive
          ? 'bg-emerald-brand text-white shadow-glow'
          : 'text-slate-600 hover:text-emerald-brand hover:bg-slate-100'
      }`,
    underline: (isActive: boolean) =>
      `px-4 py-2 text-sm font-medium transition-all duration-200 border-b-2 ${
        isActive
          ? 'border-emerald-brand text-emerald-brand'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`,
  };

  return (
    <div className={className}>
      <div className={`flex ${variants[variant]} mb-4`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`${tabStyles[variant](activeTab === tab.id)} flex items-center gap-2`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="animate-fade-in">
        {tabs.find((t) => t.id === activeTab)?.content}
      </div>
    </div>
  );
};
