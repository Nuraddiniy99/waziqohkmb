"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Donatur, PaymentItem, Currency } from '@/types';
import type { Database } from '@/lib/supabase/types';
import { SearchBar } from '@/components/ui/SearchBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ShareButton } from '@/components/ui/ShareButton';
import { DonaturForm } from '@/components/forms/DonaturForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { generateKwitansiPDF } from '@/lib/utils/pdf-generator';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { DEFAULT_SYSTEM_CONFIG } from '@/lib/utils/constants';
import { useResponsive } from '@/lib/hooks/useResponsive';
import toast from 'react-hot-toast';

type DonaturRow = Database['public']['Tables']['donatur']['Row'];

const normalizePaymentItems = (value: DonaturRow['jenis_pembayaran']): PaymentItem[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const jenis = typeof item.jenis === 'string' ? item.jenis : '';
    if (!jenis) return [];

    return [{
      jenis,
      nominal_egp: typeof item.nominal_egp === 'number' ? item.nominal_egp : 0,
      nominal_idr: typeof item.nominal_idr === 'number' ? item.nominal_idr : 0,
      nominal_usd: typeof item.nominal_usd === 'number' ? item.nominal_usd : 0,
    }];
  });
};

const normalizeDonatur = (row: DonaturRow): Donatur => ({
  ...row,
  jenis_pembayaran: normalizePaymentItems(row.jenis_pembayaran),
  metode_pembayaran: row.metode_pembayaran === 'Transfer' ? 'Transfer' : 'Tunai',
});

export default function DonaturPage() {
  const { isMobile } = useResponsive();
  const [donaturList, setDonaturList] = useState<Donatur[]>([]);
  const [filteredList, setFilteredList] = useState<Donatur[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<Donatur | null>(null);
  const [config] = useLocalStorage('waziqoh_config', DEFAULT_SYSTEM_CONFIG);

  useEffect(() => {
    fetchDonatur();
    const params = new URLSearchParams(window.location.search);
    if (params.get('form') === 'new') setShowForm(true);
  }, []);

  useEffect(() => {
    const filtered = donaturList.filter(d => 
      d.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.kekeluargaan.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredList(filtered);
  }, [searchQuery, donaturList]);

  const fetchDonatur = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('donatur')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;
      const list = (data ?? []).map(normalizeDonatur);
      setDonaturList(list);
      setFilteredList(list);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Gagal memuat data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data ini?')) return;

    try {
      const { error } = await supabase.from('donatur').delete().eq('id', id);
      if (error) throw error;
      toast.success('Data dihapus');
      fetchDonatur();
    } catch {
      toast.error('Gagal menghapus data');
    }
  };

  const handleEdit = (donatur: Donatur) => {
    setEditData(donatur);
    setShowForm(true);
  };

  const handleKwitansi = (donatur: Donatur) => {
    generateKwitansiPDF(donatur, config);
  };

  const handleShare = (donatur: Donatur) => {
    const url = `${window.location.origin}/donasisukses?invoice=${donatur.invoice_number}`;
    
    // Coba gunakan Web Share API jika tersedia (mobile)
    if (navigator.share) {
      navigator.share({
        title: 'Bukti Pembayaran WAZIQOH',
        text: `Bukti pembayaran donasi ${donatur.nama}`,
        url: url,
      }).catch(() => {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(url).then(() => {
          toast.success('Link berhasil disalin!');
        }).catch(() => {
          toast.success(`Link: ${url}`);
        });
      });
    } else {
      // Desktop: copy to clipboard
      navigator.clipboard.writeText(url).then(() => {
        toast.success('Link berhasil disalin!');
      }).catch(() => {
        // Fallback: tampilkan di alert atau prompt
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        toast.success('Link berhasil disalin!');
      });
    }
  };

  // Get totals by currency
  const getTotalsByCurrency = (donatur: Donatur): { currency: Currency; amount: number }[] => {
    const totals: { currency: Currency; amount: number }[] = [];
    if (donatur.total_egp > 0) totals.push({ currency: 'EGP', amount: donatur.total_egp });
    if (donatur.total_idr > 0) totals.push({ currency: 'IDR', amount: donatur.total_idr });
    if (donatur.total_usd > 0) totals.push({ currency: 'USD', amount: donatur.total_usd });
    return totals;
  };

  // Get payment items with nominal
  const getPaymentItemsWithNominal = (donatur: Donatur): { jenis: string; nominal: number; currency: Currency }[] => {
    const items: { jenis: string; nominal: number; currency: Currency }[] = [];
    
    donatur.jenis_pembayaran.forEach((item) => {
      if (item.nominal_egp > 0) {
        items.push({ jenis: item.jenis, nominal: item.nominal_egp, currency: 'EGP' });
      } else if (item.nominal_idr > 0) {
        items.push({ jenis: item.jenis, nominal: item.nominal_idr, currency: 'IDR' });
      } else if ((item.nominal_usd ?? 0) > 0) {
        items.push({ jenis: item.jenis, nominal: item.nominal_usd ?? 0, currency: 'USD' });
      }
    });
    
    return items;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-emerald-dark">List Donatur</h1>
          <p className="text-sm text-slate-500 mt-1">Riwayat pembayaran donatur & zakat</p>
        </div>
        <Button onClick={() => { setEditData(null); setShowForm(true); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Tambah Donatur
        </Button>
      </div>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Cari nama, invoice, atau kekeluargaan..."
      />

      {filteredList.length === 0 ? (
        <EmptyState
          title="Belum ada data donatur"
          description="Mulai catat transaksi donatur pertama Anda"
          action={
            <Button onClick={() => { setEditData(null); setShowForm(true); }}>
              Tambah Donatur
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredList.map((donatur) => {
            const totals = getTotalsByCurrency(donatur);
            const paymentItems = getPaymentItemsWithNominal(donatur);
            
            return (
              <Card key={donatur.id} hover padding="md" className={`${isMobile ? 'p-3' : 'p-4'}`}>
                {isMobile ? (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <Badge variant="primary" size="sm">{donatur.invoice_number}</Badge>
                        <Badge variant="gold" size="sm">{donatur.kekeluargaan}</Badge>
                        <Badge variant="default" size="sm">{donatur.metode_pembayaran}</Badge>
                      </div>
                      
                      <h3 className="text-base font-semibold text-emerald-dark">
                        {donatur.nama}
                      </h3>
                      
                      <p className="text-xs text-slate-400">{formatDate(donatur.timestamp)}</p>

                      <div className="flex flex-wrap gap-1 mt-2">
                        {paymentItems.map((item, i) => (
                          <span 
                            key={i} 
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-brand/10 text-emerald-brand font-medium whitespace-nowrap"
                          >
                            {item.jenis}: {formatCurrency(item.nominal, item.currency)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="text-right">
                        {totals.map((total, i) => (
                          <p 
                            key={i} 
                            className={`font-bold text-emerald-brand ${i === 0 ? 'text-base' : 'text-sm text-emerald-600'}`}
                          >
                            {formatCurrency(total.amount, total.currency)}
                          </p>
                        ))}
                        {totals.length === 0 && (
                          <p className="text-sm text-slate-400">-</p>
                        )}
                      </div>

                      <div className="flex gap-1.5">
                        <ShareButton donatur={donatur} size="sm" />
                        <button
                          onClick={() => handleKwitansi(donatur)}
                          className="p-1.5 rounded-lg bg-emerald-brand/10 text-emerald-brand hover:bg-emerald-brand hover:text-white transition-colors"
                          title="Download Kwitansi"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleEdit(donatur)}
                          className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white transition-colors"
                          title="Edit"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(donatur.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                          title="Hapus"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <Badge variant="primary" size="sm">{donatur.invoice_number}</Badge>
                        <Badge variant="gold" size="sm">{donatur.kekeluargaan}</Badge>
                        <Badge variant="default" size="sm">{donatur.metode_pembayaran}</Badge>
                      </div>
                      
                      <h3 className="text-lg font-semibold text-emerald-dark">
                        {donatur.nama}
                      </h3>
                      
                      <p className="text-xs text-slate-400">{formatDate(donatur.timestamp)}</p>

                      <div className="flex flex-wrap gap-1 mt-2">
                        {paymentItems.map((item, i) => (
                          <span 
                            key={i} 
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-brand/10 text-emerald-brand font-medium whitespace-nowrap"
                          >
                            {item.jenis}: {formatCurrency(item.nominal, item.currency)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 md:flex-col md:items-end flex-shrink-0">
                      {totals.map((total, i) => (
                        <p 
                          key={i} 
                          className={`font-bold text-emerald-brand ${i === 0 ? 'text-lg' : 'text-sm text-emerald-600'}`}
                        >
                          {formatCurrency(total.amount, total.currency)}
                        </p>
                      ))}
                      {totals.length === 0 && (
                        <p className="text-sm text-slate-400">-</p>
                      )}
                    </div>

                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleShare(donatur)}
                        className="p-2 rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white transition-colors"
                        title="Bagikan Bukti Pembayaran"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="18" cy="5" r="3" />
                          <circle cx="6" cy="12" r="3" />
                          <circle cx="18" cy="19" r="3" />
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleKwitansi(donatur)}
                        className="p-2 rounded-lg bg-emerald-brand/10 text-emerald-brand hover:bg-emerald-brand hover:text-white transition-colors"
                        title="Download Kwitansi"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleEdit(donatur)}
                        className="p-2 rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white transition-colors"
                        title="Edit"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(donatur.id)}
                        className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                        title="Hapus"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <DonaturForm
        editData={editData}
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={fetchDonatur}
      />
    </div>
  );
}