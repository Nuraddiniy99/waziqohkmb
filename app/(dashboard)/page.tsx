// app/(dashboard)/page.tsx

"use client";

import React, { useEffect, useState } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { FilterPanel } from '@/components/dashboard/FilterPanel';
import { ChartSection } from '@/components/dashboard/ChartSection';
import { supabase } from '@/lib/supabase/client';
import { DashboardStats } from '@/types';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatDate, getNextDate, getToday, toLocalDateString } from '@/lib/utils/formatters';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { DEFAULT_SYSTEM_CONFIG } from '@/lib/utils/constants';

interface FilterState {
  rentang: string;
  dari_tanggal: string;
  sampai_tanggal: string;
  kekeluargaan: string;
  jenis_transaksi: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastInvoice, setLastInvoice] = useState<string | null>(null);
  const [lastInvoiceDate, setLastInvoiceDate] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<FilterState>({
    rentang: 'tahun_aktif',
    dari_tanggal: '',
    sampai_tanggal: '',
    kekeluargaan: '',
    jenis_transaksi: '',
  });
  const [config] = useLocalStorage('waziqoh_config', DEFAULT_SYSTEM_CONFIG);

  useEffect(() => {
    fetchStats(activeFilters);
    fetchLastInvoice();
  }, []);

  const handleFilterChange = (filters: FilterState) => {
    setActiveFilters(filters);
    fetchStats(filters);
  };

  const fetchStats = async (filters: FilterState) => {
    setLoading(true);
    try {
      // Build date filter
      let dateFilter: { gte?: string; lt?: string } = {};
      const now = new Date();
      const tahunAktif = config.tahun_aktif || new Date().getFullYear().toString();

      switch (filters.rentang) {
        case 'hari_ini':
          const today = getToday();
          dateFilter = { gte: today, lt: getNextDate(today) };
          break;
        case '7_hari':
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
          dateFilter = { gte: toLocalDateString(sevenDaysAgo), lt: getNextDate(getToday()) };
          break;
        case 'bulan_ini':
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          dateFilter = { gte: toLocalDateString(monthStart), lt: getNextDate(getToday()) };
          break;
        case 'tahun_aktif':
          dateFilter = { gte: `${tahunAktif}-01-01`, lt: `${Number(tahunAktif) + 1}-01-01` };
          break;
        case 'custom':
          if (filters.dari_tanggal) {
            dateFilter = { gte: filters.dari_tanggal };
          }
          if (filters.sampai_tanggal) {
            dateFilter = { ...dateFilter, lt: getNextDate(filters.sampai_tanggal) };
          }
          break;
        default:
          break;
      }

      // Build query for donatur
      let donaturQuery = supabase.from('donatur').select('total_egp, total_idr, jenis_pembayaran, kekeluargaan, timestamp');
      
      if (dateFilter.gte) {
        donaturQuery = donaturQuery.gte('timestamp', dateFilter.gte);
      }
      if (dateFilter.lt) {
        donaturQuery = donaturQuery.lt('timestamp', dateFilter.lt);
      }
      if (filters.kekeluargaan) {
        donaturQuery = donaturQuery.eq('kekeluargaan', filters.kekeluargaan);
      }

      const { data: donaturData, error: donaturError } = await donaturQuery;
      if (donaturError) throw donaturError;

      let hutangQuery = supabase.from('hutang').select('nominal_total, mata_uang, status_hutang, created_date');
      if (dateFilter.gte) {
        hutangQuery = hutangQuery.gte('created_date', dateFilter.gte);
      }
      if (dateFilter.lt) {
        hutangQuery = hutangQuery.lt('created_date', dateFilter.lt);
      }
      const { data: hutangData, error: hutangError } = await hutangQuery;
      if (hutangError) throw hutangError;

      let cicilanQuery = supabase.from('cicilan').select('nominal_bayar, mata_uang, created_date');
      if (dateFilter.gte) {
        cicilanQuery = cicilanQuery.gte('created_date', dateFilter.gte);
      }
      if (dateFilter.lt) {
        cicilanQuery = cicilanQuery.lt('created_date', dateFilter.lt);
      }
      const { data: cicilanData, error: cicilanError } = await cicilanQuery;
      if (cicilanError) throw cicilanError;

      let mustahiqQuery = supabase.from('mustahiq').select('nominal_diterima, mata_uang, tanggal_distribusi');
      if (dateFilter.gte) {
        mustahiqQuery = mustahiqQuery.gte('tanggal_distribusi', dateFilter.gte);
      }
      if (dateFilter.lt) {
        mustahiqQuery = mustahiqQuery.lt('tanggal_distribusi', dateFilter.lt);
      }
      const { data: mustahiqData, error: mustahiqError } = await mustahiqQuery;
      if (mustahiqError) throw mustahiqError;

      const donaturRows = donaturData ?? [];
      const hutangRows = hutangData ?? [];
      const cicilanRows = cicilanData ?? [];
      const mustahiqRows = mustahiqData ?? [];

      const filteredDonaturData = filters.jenis_transaksi
        ? donaturRows.filter((row) => {
            if (!Array.isArray(row.jenis_pembayaran)) return false;
            return row.jenis_pembayaran.some((item) =>
              Boolean(
                item &&
                typeof item === 'object' &&
                !Array.isArray(item) &&
                item.jenis === filters.jenis_transaksi,
              ),
            );
          })
        : donaturRows;

      const totalDonasiEGP = filteredDonaturData.reduce((sum, row) => sum + (row.total_egp || 0), 0);
      const totalDonasiIDR = filteredDonaturData.reduce((sum, row) => sum + (row.total_idr || 0), 0);

      const hutangBeredar = hutangRows.filter((row) => row.status_hutang === 'Belum Lunas');
      const totalHutangIDR = hutangBeredar.filter((row) => row.mata_uang === 'IDR').reduce((sum, row) => sum + row.nominal_total, 0);
      const totalHutangEGP = hutangBeredar.filter((row) => row.mata_uang === 'EGP').reduce((sum, row) => sum + row.nominal_total, 0);
      const totalHutangUSD = hutangBeredar.filter((row) => row.mata_uang === 'USD').reduce((sum, row) => sum + row.nominal_total, 0);

      const totalCicilanIDR = cicilanRows.filter((row) => row.mata_uang === 'IDR').reduce((sum, row) => sum + row.nominal_bayar, 0);
      const totalCicilanEGP = cicilanRows.filter((row) => row.mata_uang === 'EGP').reduce((sum, row) => sum + row.nominal_bayar, 0);
      const totalCicilanUSD = cicilanRows.filter((row) => row.mata_uang === 'USD').reduce((sum, row) => sum + row.nominal_bayar, 0);

      const totalMustahiq = mustahiqRows.length;
      const totalDanaIDR = mustahiqRows.filter((row) => row.mata_uang === 'IDR').reduce((sum, row) => sum + row.nominal_diterima, 0);
      const totalDanaEGP = mustahiqRows.filter((row) => row.mata_uang === 'EGP').reduce((sum, row) => sum + row.nominal_diterima, 0);

      setStats({
        total_donasi_idr: totalDonasiIDR,
        total_donasi_egp: totalDonasiEGP,
        total_hutang_beredar_idr: totalHutangIDR,
        total_hutang_beredar_egp: totalHutangEGP,
        total_hutang_beredar_usd: totalHutangUSD,
        total_cicilan_masuk_idr: totalCicilanIDR,
        total_cicilan_masuk_egp: totalCicilanEGP,
        total_cicilan_masuk_usd: totalCicilanUSD,
        total_mustahiq: totalMustahiq,
        total_dana_disalurkan_idr: totalDanaIDR,
        total_dana_disalurkan_egp: totalDanaEGP,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 FIXED: fetchLastInvoice dengan type assertion
  const fetchLastInvoice = async () => {
    try {
      const { data, error } = await supabase
        .from('donatur')
        .select('invoice_number, timestamp')
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error) throw error;
      if (data && data.length > 0) {
        // 🔥 FIX: Type assertion untuk data
        const item = data[0] as { invoice_number: string; timestamp: string };
        setLastInvoice(item.invoice_number);
        setLastInvoiceDate(item.timestamp);
      }
    } catch (error) {
      console.error('Error fetching last invoice:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const getFilterLabel = () => {
    const rentangMap: Record<string, string> = {
      hari_ini: 'Hari Ini',
      '7_hari': '7 Hari Terakhir',
      bulan_ini: 'Bulan Ini',
      tahun_aktif: 'Tahun Aktif',
      custom: 'Kustom',
    };
    let label = rentangMap[activeFilters.rentang] || 'Semua Waktu';
    if (activeFilters.kekeluargaan) label += ` • ${activeFilters.kekeluargaan}`;
    if (activeFilters.jenis_transaksi) label += ` • ${activeFilters.jenis_transaksi}`;
    return label;
  };

  // Extract invoice number parts
  const getInvoiceParts = (invoice: string | null) => {
    if (!invoice) return { number: '-', year: '-' };
    const parts = invoice.split('/');
    if (parts.length === 3) {
      return { number: parts[2], year: parts[1] };
    }
    return { number: invoice, year: '-' };
  };

  const invoiceParts = getInvoiceParts(lastInvoice);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-emerald-dark">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Pusat kendali informasi eksekutif</p>
      </div>

      {/* Filter Panel */}
      <FilterPanel onFilterChange={handleFilterChange} activeFilters={activeFilters} />

      {/* Active filter indicator */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="font-medium">Filter aktif:</span>
        <Badge variant="primary" size="sm">{getFilterLabel()}</Badge>
        {activeFilters.dari_tanggal && (
          <Badge variant="default" size="sm">Dari: {formatDate(activeFilters.dari_tanggal)}</Badge>
        )}
        {activeFilters.sampai_tanggal && (
          <Badge variant="default" size="sm">Sampai: {formatDate(activeFilters.sampai_tanggal)}</Badge>
        )}
      </div>

      {/* Last Invoice Capsule */}
      <Card 
        padding="md" 
        className="relative overflow-hidden bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-600 border-none shadow-lg"
      >
        {/* Decorative subtle pattern */}
        <div className="absolute inset-0 opacity-5">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Decorative accent circles */}
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute -left-8 -bottom-8 w-24 h-24 rounded-full bg-white/5" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Icon dengan background putih transparan */}
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 border border-white/10">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-white/60 font-medium">Nomor Invoice Terakhir</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white tracking-wide">
                  {invoiceParts.number}
                </span>
                <span className="text-lg font-medium text-white/40">/</span>
                <span className="text-lg font-medium text-white/60">{invoiceParts.year}</span>
              </div>
            </div>
          </div>
          {lastInvoiceDate && (
            <div className="text-right">
              <p className="text-xs text-white/50">Dibuat</p>
              <p className="text-sm font-medium text-white/80">{formatDate(lastInvoiceDate)}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Donasi / Zakat"
          valueEGP={stats?.total_donasi_egp}
          valueIDR={stats?.total_donasi_idr}
          icon={<DonasiIcon />}
          color="emerald"
          trend={12.5}
        />
        <StatCard
          title="Hutang Beredar"
          valueEGP={stats?.total_hutang_beredar_egp}
          valueIDR={stats?.total_hutang_beredar_idr}
          valueUSD={stats?.total_hutang_beredar_usd}
          icon={<HutangIcon />}
          color="gold"
        />
        <StatCard
          title="Cicilan Masuk"
          valueEGP={stats?.total_cicilan_masuk_egp}
          valueIDR={stats?.total_cicilan_masuk_idr}
          valueUSD={stats?.total_cicilan_masuk_usd}
          icon={<CicilanIcon />}
          color="blue"
        />
        <StatCard
          title="Mustahiq & Penyaluran"
          value={stats?.total_mustahiq}
          valueEGP={stats?.total_dana_disalurkan_egp}
          valueIDR={stats?.total_dana_disalurkan_idr}
          subtitle="Mustahiq terverifikasi"
          icon={<MustahiqIcon />}
          color="red"
        />
      </div>

      <ChartSection filters={activeFilters} />
    </div>
  );
}

function DonasiIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  );
}

function HutangIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function CicilanIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    </svg>
  );
}

function MustahiqIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}