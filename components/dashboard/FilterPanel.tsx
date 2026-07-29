// components/dashboard/FilterPanel.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { Button } from '@/components/ui/Button';
import { RENTANG_WAKTU_OPTIONS, KEKELUARGAAN_OPTIONS, JENIS_PEMBAYARAN_OPTIONS } from '@/lib/utils/constants';
import { useResponsive } from '@/lib/hooks/useResponsive';

interface FilterState {
  rentang: string;
  dari_tanggal: string;
  sampai_tanggal: string;
  kekeluargaan: string;
  jenis_transaksi: string;
}

interface FilterPanelProps {
  onFilterChange: (filters: FilterState) => void;
  activeFilters?: FilterState;
}

const DEFAULT_FILTERS: FilterState = {
  rentang: 'tahun_aktif',
  dari_tanggal: '',
  sampai_tanggal: '',
  kekeluargaan: '',
  jenis_transaksi: '',
};

export const FilterPanel: React.FC<FilterPanelProps> = ({ 
  onFilterChange, 
  activeFilters = DEFAULT_FILTERS 
}) => {
  const { isMobile } = useResponsive();
  const [filters, setFilters] = useState<FilterState>(activeFilters);
  const [showCustom, setShowCustom] = useState(activeFilters.rentang === 'custom');
  const [isExpanded, setIsExpanded] = useState(!isMobile);

  // Sync with parent when activeFilters changes
  useEffect(() => {
    setFilters(activeFilters);
    setShowCustom(activeFilters.rentang === 'custom');
  }, [activeFilters]);

  const handleChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    if (key === 'rentang') {
      setShowCustom(value === 'custom');
      if (value !== 'custom') {
        newFilters.dari_tanggal = '';
        newFilters.sampai_tanggal = '';
      }
    }
    setFilters(newFilters);
  };

  const handleApplyFilter = () => {
    onFilterChange(filters);
    if (isMobile) setIsExpanded(false);
  };

  const handleResetFilter = () => {
    const resetFilters = { ...DEFAULT_FILTERS };
    setFilters(resetFilters);
    setShowCustom(false);
    onFilterChange(resetFilters);
    if (isMobile) setIsExpanded(false);
  };

  // Mobile: compact mode
  if (isMobile) {
    return (
      <Card padding="sm" className="bg-white/80 backdrop-blur-sm">
        {!isExpanded ? (
          // Compact view - hanya menampilkan badge filter
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setIsExpanded(true)}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-brand transition-colors flex-1 text-left"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 3 12 13 2 3" />
                <path d="M12 13v8" />
              </svg>
              <span className="font-medium">Filter</span>
              {activeFilters.kekeluargaan && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-brand/10 text-emerald-brand">
                  {activeFilters.kekeluargaan}
                </span>
              )}
              {activeFilters.jenis_transaksi && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-brand/10 text-emerald-brand">
                  {activeFilters.jenis_transaksi}
                </span>
              )}
              {activeFilters.rentang !== 'tahun_aktif' && activeFilters.rentang !== '' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {RENTANG_WAKTU_OPTIONS.find(o => o.value === activeFilters.rentang)?.label || activeFilters.rentang}
                </span>
              )}
            </button>
            <button
              onClick={handleResetFilter}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </button>
          </div>
        ) : (
          // Expanded view - semua filter
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-emerald-dark">Filter Data</span>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <Select
              label="Rentang"
              value={filters.rentang}
              onChange={(e) => handleChange('rentang', e.target.value)}
              options={RENTANG_WAKTU_OPTIONS}
              size="sm"
            />

            {showCustom && (
              <div className="grid grid-cols-2 gap-2">
                <DatePicker 
                  label="Dari" 
                  value={filters.dari_tanggal}
                  onChange={(e) => handleChange('dari_tanggal', e.target.value)}
                />
                <DatePicker 
                  label="Sampai"
                  value={filters.sampai_tanggal}
                  onChange={(e) => handleChange('sampai_tanggal', e.target.value)}
                />
              </div>
            )}

            <Select
              label="Kekeluargaan"
              value={filters.kekeluargaan}
              onChange={(e) => handleChange('kekeluargaan', e.target.value)}
              options={[{ value: '', label: 'Semua' }, ...KEKELUARGAAN_OPTIONS.map(k => ({ value: k, label: k }))]}
              size="sm"
            />

            <Select
              label="Jenis Transaksi"
              value={filters.jenis_transaksi}
              onChange={(e) => handleChange('jenis_transaksi', e.target.value)}
              options={[{ value: '', label: 'Semua' }, ...JENIS_PEMBAYARAN_OPTIONS.map(j => ({ value: j, label: j }))]}
              size="sm"
            />

            <div className="flex gap-2">
              <Button size="sm" onClick={handleApplyFilter} className="flex-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
                  <polyline points="22 3 12 13 2 3" />
                  <path d="M12 13v8" />
                </svg>
                Terapkan
              </Button>
              <Button size="sm" variant="ghost" onClick={handleResetFilter} className="flex-1">
                Reset
              </Button>
            </div>
          </div>
        )}
      </Card>
    );
  }

  // Desktop: full view
  return (
    <Card padding="md" className="bg-white/80 backdrop-blur-sm">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-full sm:w-auto flex-1 min-w-[180px]">
          <Select
            label="Rentang Waktu"
            value={filters.rentang}
            onChange={(e) => handleChange('rentang', e.target.value)}
            options={RENTANG_WAKTU_OPTIONS}
          />
        </div>

        {showCustom && (
          <>
            <div className="w-full sm:w-auto">
              <DatePicker 
                label="Dari Tanggal" 
                value={filters.dari_tanggal}
                onChange={(e) => handleChange('dari_tanggal', e.target.value)}
              />
            </div>
            <div className="w-full sm:w-auto">
              <DatePicker 
                label="Sampai Tanggal"
                value={filters.sampai_tanggal}
                onChange={(e) => handleChange('sampai_tanggal', e.target.value)}
              />
            </div>
          </>
        )}

        <div className="w-full sm:w-auto flex-1 min-w-[180px]">
          <Select
            label="Kekeluargaan"
            value={filters.kekeluargaan}
            onChange={(e) => handleChange('kekeluargaan', e.target.value)}
            options={[{ value: '', label: 'Semua' }, ...KEKELUARGAAN_OPTIONS.map(k => ({ value: k, label: k }))]}
          />
        </div>

        <div className="w-full sm:w-auto flex-1 min-w-[180px]">
          <Select
            label="Jenis Transaksi"
            value={filters.jenis_transaksi}
            onChange={(e) => handleChange('jenis_transaksi', e.target.value)}
            options={[{ value: '', label: 'Semua' }, ...JENIS_PEMBAYARAN_OPTIONS.map(j => ({ value: j, label: j }))]}
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <Button size="sm" onClick={handleApplyFilter} className="flex-1 sm:flex-none">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
              <polyline points="22 3 12 13 2 3" />
              <path d="M12 13v8" />
            </svg>
            Terapkan
          </Button>
          <Button size="sm" variant="ghost" onClick={handleResetFilter} className="flex-1 sm:flex-none">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            Reset
          </Button>
        </div>
      </div>
    </Card>
  );
};