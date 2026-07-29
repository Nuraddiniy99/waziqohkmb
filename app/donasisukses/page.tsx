"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Donatur, PaymentItem, Currency } from '@/types';
import type { Database } from '@/lib/supabase/types';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { generateKwitansiPDF } from '@/lib/utils/pdf-generator';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { DEFAULT_SYSTEM_CONFIG } from '@/lib/utils/constants';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import toast from 'react-hot-toast';

type DonaturRow = Database['public']['Tables']['donatur']['Row'];

const normalizeDonatur = (row: DonaturRow): Donatur => {
  const paymentItems: PaymentItem[] = Array.isArray(row.jenis_pembayaran)
    ? row.jenis_pembayaran.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.jenis !== 'string') return [];
        return [{
          jenis: item.jenis,
          nominal_egp: typeof item.nominal_egp === 'number' ? item.nominal_egp : 0,
          nominal_idr: typeof item.nominal_idr === 'number' ? item.nominal_idr : 0,
          nominal_usd: typeof item.nominal_usd === 'number' ? item.nominal_usd : 0,
        }];
      })
    : [];

  return {
    ...row,
    jenis_pembayaran: paymentItems,
    metode_pembayaran: row.metode_pembayaran === 'Transfer' ? 'Transfer' : 'Tunai',
  };
};

export default function DonasiSuksesPage() {
  const router = useRouter();
  const [invoice, setInvoice] = useState<string | null>(null);
  const [donatur, setDonatur] = useState<Donatur | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [config] = useLocalStorage('waziqoh_config', DEFAULT_SYSTEM_CONFIG);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const invoiceNumber = new URLSearchParams(window.location.search).get('invoice');
    setInvoice(invoiceNumber);

    if (!invoiceNumber) {
      setError(true);
      setLoading(false);
      return;
    }

    void fetchDonaturByInvoice(invoiceNumber);
  }, []);

  const fetchDonaturByInvoice = async (invoiceNumber: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('donatur')
        .select('*')
        .eq('invoice_number', invoiceNumber)
        .single();

      if (error) throw error;
      if (!data) {
        setError(true);
        return;
      }

      setDonatur(normalizeDonatur(data));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!donatur) return;
    setDownloading(true);
    try {
      await generateKwitansiPDF(donatur, config);
      toast.success('PDF berhasil diunduh');
    } catch {
      toast.error('Gagal mengunduh PDF');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/donasisukses?invoice=${invoice}`;
    
    // Coba gunakan Web Share API terlebih dahulu
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Bukti Pembayaran WAZIQOH',
          text: `Bukti pembayaran donasi ${donatur?.nama}`,
          url: url,
        });
        return;
      } catch (err) {
        // User cancelled share atau error, fallback ke clipboard
        console.log('Share cancelled or failed, trying clipboard');
      }
    }
    
    // Fallback: Copy link ke clipboard
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success('Link berhasil disalin ke clipboard');
      } else {
        // Fallback untuk browser lama
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
          toast.success('Link berhasil disalin ke clipboard');
        } catch {
          toast.error('Gagal menyalin link. Silakan screenshot halaman ini.');
        }
        document.body.removeChild(textArea);
      }
    } catch {
      toast.error('Gagal menyalin link. Silakan screenshot halaman ini.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-gold-soft/20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !donatur) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-gold-soft/20 p-4">
        <div className="bg-white/90 backdrop-blur-glass border border-white/40 rounded-3xl shadow-glass p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Data Tidak Ditemukan</h2>
          <p className="text-sm text-slate-500 mb-6">Maaf, data dengan invoice ini tidak ditemukan.</p>
          <Button onClick={() => router.push('/')} className="w-full">
            Kembali ke Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Get ALL totals grouped by currency
  const getTotalsByCurrency = () => {
    const totals: { currency: Currency; amount: number }[] = [];
    if (donatur.total_egp > 0) totals.push({ currency: 'EGP', amount: donatur.total_egp });
    if (donatur.total_idr > 0) totals.push({ currency: 'IDR', amount: donatur.total_idr });
    if (donatur.total_usd > 0) totals.push({ currency: 'USD', amount: donatur.total_usd });
    return totals;
  };

  const totalsByCurrency = getTotalsByCurrency();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-gold-soft/20 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-emerald-brand/5" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-gold-brand/5" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card Utama - Glasmorphic */}
        <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-3xl shadow-2xl overflow-hidden relative">
          
          {/* Watermark "VERIFIED" - Miring dan di tengah */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
            <span 
              className="text-[100px] sm:text-[120px] font-black text-emerald-brand/[0.06] select-none leading-none tracking-widest whitespace-nowrap"
              style={{
                transform: 'rotate(-15deg) translateY(-10%)',
                textShadow: '0 0 60px rgba(15, 123, 84, 0.06), 0 0 120px rgba(15, 123, 84, 0.03)',
              }}
            >
              VERIFIED
            </span>
          </div>

          {/* Content di atas watermark */}
          <div className="relative z-10">
            {/* Header - Hijau dengan logo iconkop */}
            <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-500 px-6 py-8 text-center">
              {/* Logo diubah menjadi putih pekat menggunakan CSS filter */}
              <div className="flex justify-center mb-4">
                <img
                  src="https://dsjkuzirvaniunhwwnml.supabase.co/storage/v1/object/public/assets/iconkop.png"
                  alt="WAZIQOH Logo"
                  className="h-20 w-auto object-contain"
                  style={{
                    filter: 'brightness(0) invert(1)',
                  }}
                />
              </div>
              <h1 className="text-2xl font-bold text-white">Bukti Pembayaran</h1>
              <p className="text-emerald-100/80 text-sm mt-1">WAZIQOH KMB Mesir</p>
              <div className="mt-3 inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="text-xs text-white font-medium">{formatDate(donatur.timestamp)}</span>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Status Badge */}
              <div className="flex items-center justify-center mb-6">
                <Badge variant="success" size="md" className="text-sm px-4 py-1.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Pembayaran Berhasil
                </Badge>
              </div>

              {/* Invoice Number */}
              <div className="text-center mb-6">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Nomor Invoice</p>
                <p className="text-2xl font-bold text-emerald-dark font-mono">{donatur.invoice_number}</p>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-200/60 my-4" />

              {/* Detail Donatur */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Nama Donatur</span>
                  <span className="text-sm font-semibold text-slate-800">{donatur.nama}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Kekeluargaan</span>
                  <span className="text-sm font-semibold text-slate-800">{donatur.kekeluargaan}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Metode</span>
                  <span className="text-sm font-semibold text-slate-800">{donatur.metode_pembayaran}</span>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-200/60 my-4" />

              {/* Rincian Pembayaran */}
              <div className="space-y-2">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Rincian Pembayaran</p>
                {donatur.jenis_pembayaran.map((item, index) => {
                  let nominal = 0;
                  let currency = 'EGP';
                  if (item.nominal_egp > 0) { nominal = item.nominal_egp; currency = 'EGP'; }
                  else if (item.nominal_idr > 0) { nominal = item.nominal_idr; currency = 'IDR'; }
                  else if ((item.nominal_usd ?? 0) > 0) { nominal = item.nominal_usd ?? 0; currency = 'USD'; }

                  return (
                    <div key={index} className="flex justify-between items-center py-1.5 border-b border-slate-100/50 last:border-0">
                      <span className="text-sm text-slate-600">{item.jenis}</span>
                      <span className="text-sm font-semibold text-emerald-brand">{formatCurrency(nominal, currency)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="border-t border-slate-200/60 my-4" />

              {/* Total - Dipisah per mata uang */}
              <div className="space-y-2">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Pembayaran</p>
                {totalsByCurrency.length > 1 ? (
                  // Multiple currencies - tampilkan masing-masing
                  totalsByCurrency.map((item, index) => (
                    <div key={index} className="flex justify-between items-center py-1.5">
                      <span className="text-sm font-semibold text-slate-700">{item.currency}</span>
                      <span className="text-lg font-bold text-emerald-brand">
                        {formatCurrency(item.amount, item.currency)}
                      </span>
                    </div>
                  ))
                ) : totalsByCurrency.length === 1 ? (
                  // Single currency
                  <div className="flex justify-between items-center py-2">
                    <span className="text-base font-bold text-slate-800">Total</span>
                    <span className="text-xl font-bold text-emerald-brand">
                      {formatCurrency(totalsByCurrency[0].amount, totalsByCurrency[0].currency)}
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Pesan Terima Kasih */}
              <div className="mt-6 text-center bg-emerald-50/50 backdrop-blur-sm rounded-xl p-4 border border-emerald-100/50">
                <p className="text-sm text-emerald-700 font-medium">
                  Terima kasih telah menyalurkan sebagian hartanya melalui WAZIQOH KMB Mesir
                </p>
              </div>

              {/* Tombol Aksi */}
              <div className="mt-6 flex flex-col gap-3">
                <Button 
                  onClick={handleDownloadPDF} 
                  className="w-full"
                  isLoading={downloading}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download PDF Invoice
                </Button>

                <Button 
                  variant="outline" 
                  onClick={handleShare} 
                  className="w-full"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  Bagikan Bukti Pembayaran
                </Button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200/50 bg-slate-50/30 backdrop-blur-sm text-center">
              <p className="text-[10px] text-slate-400">
                Dokumen ini adalah bukti pembayaran sah WAZIQOH KMB Mesir
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}