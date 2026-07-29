// components/dashboard/ChartSection.tsx

"use client";

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDate, getNextDate, getToday, toLocalDateString } from '@/lib/utils/formatters';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
} from 'chart.js';
import type { TooltipItem } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface FilterState {
  rentang: string;
  dari_tanggal: string;
  sampai_tanggal: string;
  kekeluargaan: string;
  jenis_transaksi: string;
}

interface ChartSectionProps {
  filters?: FilterState;
}

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    borderWidth?: number;
    tension?: number;
    fill?: boolean;
    pointBackgroundColor?: string;
    pointBorderColor?: string;
    pointBorderWidth?: number;
    pointRadius?: number;
  }[];
}

export const ChartSection: React.FC<ChartSectionProps> = ({ filters }) => {
  const [lineData, setLineData] = useState<ChartData | null>(null);
  const [doughnutData, setDoughnutData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChartData();
  }, [filters]);

  const fetchChartData = async () => {
    setLoading(true);
    try {
      // Build date filter
      let dateFilter: { gte?: string; lt?: string } = {};
      if (filters) {
        switch (filters.rentang) {
          case 'hari_ini':
            const today = getToday();
            dateFilter = { gte: today, lt: getNextDate(today) };
            break;
          case '7_hari':
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
            dateFilter = { gte: toLocalDateString(sevenDaysAgo), lt: getNextDate(getToday()) };
            break;
          case 'bulan_ini':
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            dateFilter = { gte: toLocalDateString(monthStart), lt: getNextDate(getToday()) };
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
      }

      // Fetch donatur data for trend chart
      let donaturQuery = supabase
        .from('donatur')
        .select('timestamp, total_egp, total_idr, jenis_pembayaran, kekeluargaan')
        .order('timestamp', { ascending: true });

      if (dateFilter.gte) {
        donaturQuery = donaturQuery.gte('timestamp', dateFilter.gte);
      }
      if (dateFilter.lt) {
        donaturQuery = donaturQuery.lt('timestamp', dateFilter.lt);
      }
      if (filters?.kekeluargaan) {
        donaturQuery = donaturQuery.eq('kekeluargaan', filters.kekeluargaan);
      }

      const { data: donaturData, error: donaturError } = await donaturQuery;
      if (donaturError) throw donaturError;

      const rows = donaturData ?? [];
      const dataToProcess = filters?.jenis_transaksi
        ? rows.filter((row) => {
            if (!Array.isArray(row.jenis_pembayaran)) return false;
            return row.jenis_pembayaran.some((item) => {
              if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
              return item.jenis === filters.jenis_transaksi;
            });
          })
        : rows;

      // Process line chart data (group by date)
      const dateMap: Record<string, number> = {};
      dataToProcess.forEach((row) => {
        const date = formatDate(row.timestamp);
        dateMap[date] = (dateMap[date] || 0) + (row.total_egp || 0);
      });

      const labels = Object.keys(dateMap);
      const values = Object.values(dateMap);

      setLineData({
        labels: labels.length > 0 ? labels : ['Belum ada data'],
        datasets: [
          {
            label: 'Tren Donasi (EGP)',
            data: values.length > 0 ? values : [0],
            borderColor: '#0f7b54',
            backgroundColor: 'rgba(15, 123, 84, 0.1)',
            tension: 0.3,
            fill: true,
            borderWidth: 3,
            pointBackgroundColor: '#0f7b54',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
          },
        ],
      });

      // Process doughnut chart data (payment types)
      const typeMap: Record<string, number> = {};
      dataToProcess.forEach((row) => {
        if (!Array.isArray(row.jenis_pembayaran)) return;

        row.jenis_pembayaran.forEach((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return;

          const jenis = typeof item.jenis === 'string' ? item.jenis : 'Lainnya';
          const nominal = typeof item.nominal_egp === 'number' ? item.nominal_egp : 0;
          typeMap[jenis] = (typeMap[jenis] || 0) + nominal;
        });
      });

      const typeLabels = Object.keys(typeMap);
      const typeValues = Object.values(typeMap);
      const colors = ['#0f7b54', '#14a370', '#fbbf24', '#d97706', '#64748b', '#3b82f6', '#ef4444'];

      setDoughnutData({
        labels: typeLabels.length > 0 ? typeLabels : ['Belum ada data'],
        datasets: [
          {
            label: 'Komposisi Jenis Penerimaan',
            data: typeValues.length > 0 ? typeValues : [1],
            backgroundColor: colors.slice(0, Math.max(typeLabels.length, 1)),
            borderColor: '#ffffff',
            borderWidth: 2,
          },
        ],
      });
    } catch (error) {
      console.error('Error fetching chart data:', error);
      // Set fallback data
      setLineData({
        labels: ['Belum ada data'],
        datasets: [
          {
            label: 'Tren Donasi (EGP)',
            data: [0],
            borderColor: '#0f7b54',
            backgroundColor: 'rgba(15, 123, 84, 0.1)',
            tension: 0.3,
            fill: true,
            borderWidth: 3,
            pointBackgroundColor: '#0f7b54',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
          },
        ],
      });
      setDoughnutData({
        labels: ['Belum ada data'],
        datasets: [
          {
            label: 'Komposisi Jenis Penerimaan',
            data: [1],
            backgroundColor: ['#e2e8f0'],
            borderColor: '#ffffff',
            borderWidth: 2,
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  // 🔥 FIXED: chartOptions dengan weight yang benar
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          font: {
            size: 11,
            weight: 'normal' as const, // 🔥 FIX: '500' -> 'normal'
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(255,255,255,0.95)',
        titleColor: '#0f7b54',
        bodyColor: '#1e293b',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: function(context: TooltipItem<'line'>) {
            return `${context.dataset.label}: ${formatCurrency(context.parsed.y ?? 0, 'EGP')}`;
          }
        }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0,0,0,0.05)',
        },
        ticks: {
          callback: function(value: string | number) {
            return formatCurrency(Number(value), 'EGP');
          },
          font: {
            size: 10,
          },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 10,
          },
          maxTicksLimit: 15,
        },
      },
    },
  };

  // 🔥 FIXED: doughnutOptions dengan weight yang benar
  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
          font: {
            size: 11,
            weight: 'normal' as const, // 🔥 FIX: '500' -> 'normal'
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(255,255,255,0.95)',
        titleColor: '#0f7b54',
        bodyColor: '#1e293b',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: function(context: TooltipItem<'doughnut'>) {
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
            return `${context.label}: ${formatCurrency(context.parsed, 'EGP')} (${percentage}%)`;
          }
        }
      },
    },
    cutout: '60%',
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-semibold text-emerald-dark mb-4">Tren Transaksi</h3>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-brand" />
          </div>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-emerald-dark mb-4">Komposisi Jenis Penerimaan</h3>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-brand" />
          </div>
        </Card>
      </div>
    );
  }

  const hasRealData = (data: ChartData | null): boolean => {
    if (!data) return false;
    return data.datasets.some(ds => ds.data.some(v => v > 0));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <h3 className="text-sm font-semibold text-emerald-dark mb-4">Tren Transaksi</h3>
        {lineData && hasRealData(lineData) ? (
          <div className="h-64">
            <Line data={lineData} options={chartOptions} />
          </div>
        ) : (
          <EmptyState
            title="Grafik akan tampil di sini"
            description="Data transaksi akan divisualisasikan setelah terdapat cukup data"
            icon={
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0f7b54" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            }
          />
        )}
      </Card>
      <Card>
        <h3 className="text-sm font-semibold text-emerald-dark mb-4">Komposisi Jenis Penerimaan</h3>
        {doughnutData && hasRealData(doughnutData) ? (
          <div className="h-64">
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>
        ) : (
          <EmptyState
            title="Grafik akan tampil di sini"
            description="Distribusi jenis pembayaran akan ditampilkan"
            icon={
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0f7b54" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                <path d="M22 12A10 10 0 0 0 12 2v10z" />
              </svg>
            }
          />
        )}
      </Card>
    </div>
  );
};