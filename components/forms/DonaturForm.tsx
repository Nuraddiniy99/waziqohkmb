// components/forms/DonaturForm.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { PaymentItem, Donatur } from '@/types';
import { 
  METODE_PEMBAYARAN_OPTIONS 
} from '@/lib/utils/constants';
import { 
  formatCurrency, 
  generateInvoiceNumber, 
  getNow, 
  getCurrentYear 
} from '@/lib/utils/formatters';
import { useResponsive } from '@/lib/hooks/useResponsive';
import toast from 'react-hot-toast';
import type { Database, Json } from '@/lib/supabase/types';

interface DonaturFormProps {
  editData?: Donatur | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Updated KEKELUARGAAN_OPTIONS
const KEKELUARGAAN_OPTIONS = [
  'KMNTB',
  'KMKM',
  'GAMAJATIM',
  'KKS',
  'FOSGAMA',
  'KMA',
  'KSW',
  'KMM',
  'KPJ',
  'KMB',
  'KPMJB',
  'KMJ',
  'IKMAL',
  'KSMR',
  'KEMASS',
  'HMMSU',
  'Non-Fam',
];

// Updated JENIS_PEMBAYARAN_OPTIONS
const JENIS_PEMBAYARAN_OPTIONS = [
  'Zakat Fitrah',
  'Zakat Maal',
  'Zakat Profesi',
  'Zakat Perdagangan',
  'Zakat Pertanian',
  'Zakat Peternakan',
  'Infaq',
  'Shodaqoh',
  'Wakaf',
  'Fidyah',
  'Kaffarah / Kafarat',
  'Dana Nazar',
  'Hibah / Hadiah',
  'Wasiat / Hibah Wasiat',
  'Penyucian Dana Non-Halal',
  'Luqatah (Harta Temuan)',
  'Dana Kemanusiaan / Bencana',
  'Dana Titipan Ummat',
  'Dana Tabarru',
];

const MATA_UANG_OPTIONS = ['EGP', 'IDR', 'USD'];

export const DonaturForm: React.FC<DonaturFormProps> = ({ 
  editData, 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const { isMobile } = useResponsive();
  const [nama, setNama] = useState('');
  const [kekeluargaan, setKekeluargaan] = useState('');
  const [metodePembayaran, setMetodePembayaran] = useState('Tunai');
  const [paymentItems, setPaymentItems] = useState<PaymentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (editData) {
      setNama(editData.nama);
      setKekeluargaan(editData.kekeluargaan);
      setMetodePembayaran(editData.metode_pembayaran);
      setPaymentItems(editData.jenis_pembayaran);
    } else {
      resetForm();
    }
  }, [editData, isOpen]);

  const resetForm = () => {
    setNama('');
    setKekeluargaan('');
    setMetodePembayaran('Tunai');
    setPaymentItems([]);
  };

  const addPaymentItem = () => {
    setPaymentItems([...paymentItems, { jenis: 'Zakat Fitrah', nominal_egp: 0, nominal_idr: 0, nominal_usd: 0 }]);
  };

  const removePaymentItem = (index: number) => {
    setPaymentItems(paymentItems.filter((_, i) => i !== index));
  };

  // Calculate totals by currency
  const totalEGP = paymentItems.reduce((sum, item) => sum + (item.nominal_egp || 0), 0);
  const totalIDR = paymentItems.reduce((sum, item) => sum + (item.nominal_idr || 0), 0);
  const totalUSD = paymentItems.reduce((sum, item) => sum + (item.nominal_usd || 0), 0);

  // Get currency for an item (which currency has value)
  const getItemCurrency = (item: PaymentItem): string => {
    if (item.nominal_egp && item.nominal_egp > 0) return 'EGP';
    if (item.nominal_idr && item.nominal_idr > 0) return 'IDR';
    if (item.nominal_usd && item.nominal_usd > 0) return 'USD';
    return 'EGP'; // default
  };

  // Get nominal value based on currency
  const getItemNominal = (item: PaymentItem, currency: string): number => {
    if (currency === 'EGP') return item.nominal_egp || 0;
    if (currency === 'IDR') return item.nominal_idr || 0;
    if (currency === 'USD') return item.nominal_usd || 0;
    return 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nama || !kekeluargaan || paymentItems.length === 0) {
      toast.error('Mohon lengkapi semua field wajib');
      return;
    }

    const hasValidNominal = paymentItems.some(item => 
      (item.nominal_egp || 0) > 0 || 
      (item.nominal_idr || 0) > 0 || 
      (item.nominal_usd || 0) > 0
    );
    if (!hasValidNominal) {
      toast.error('Minimal satu item pembayaran harus memiliki nominal > 0');
      return;
    }

    setIsLoading(true);

    try {
      const tahun = getCurrentYear();

      // Clean payment items - only include currencies with value
      const cleanedPaymentItems: Json = paymentItems.map(item => {
        const cleaned: Record<string, Json> = { jenis: item.jenis };
        const nominalEgp = item.nominal_egp ?? 0;
        const nominalIdr = item.nominal_idr ?? 0;
        const nominalUsd = item.nominal_usd ?? 0;
        if (nominalEgp > 0) cleaned.nominal_egp = nominalEgp;
        if (nominalIdr > 0) cleaned.nominal_idr = nominalIdr;
        if (nominalUsd > 0) cleaned.nominal_usd = nominalUsd;
        return cleaned;
      });

      const donaturData = {
        nama,
        kekeluargaan,
        jenis_pembayaran: cleanedPaymentItems,
        metode_pembayaran: metodePembayaran,
        total_egp: totalEGP,
        total_idr: totalIDR,
        total_usd: totalUSD,
        last_modified: getNow(),
      } satisfies Database['public']['Tables']['donatur']['Update'];

      console.log('Saving donatur data:', JSON.stringify(donaturData, null, 2));

      // 🔥 FIXED: Type assertion untuk Supabase
      if (editData) {
        const { error } = await supabase
          .from('donatur')
          .update(donaturData)
          .eq('id', editData.id);

        if (error) {
          console.error('Supabase update error:', error);
          throw new Error(error.message);
        }
        toast.success('Data donatur berhasil diperbarui');
        
      } else {
        // Get next invoice number
        const { data: existing, error: fetchError } = await supabase
          .from('donatur')
          .select('invoice_number')
          .eq('tahun', tahun)
          .order('invoice_number', { ascending: false })
          .limit(1);

        if (fetchError) {
          console.error('Fetch existing error:', fetchError);
          throw new Error(fetchError.message);
        }

        let sequence = 1;
        if (existing && existing.length > 0) {
          // 🔥 FIX: Type assertion untuk data
          const typedExisting = existing as { invoice_number: string }[];
          const lastNum = parseInt(typedExisting[0].invoice_number.split('/').pop() || '0');
          sequence = lastNum + 1;
        }

        const invoiceNumber = generateInvoiceNumber(tahun, sequence);

        const insertData: Database['public']['Tables']['donatur']['Insert'] = {
          ...donaturData,
          invoice_number: invoiceNumber,
          tahun,
          timestamp: getNow(),
        };

        console.log('Inserting donatur:', JSON.stringify(insertData, null, 2));

        // 🔥 FIXED: Type assertion untuk Supabase
        const { error } = await supabase
          .from('donatur')
          .insert(insertData);

        if (error) {
          console.error('Supabase insert error:', error);
          throw new Error(error.message);
        }
        toast.success('Donatur berhasil ditambahkan');
      }

      resetForm();
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving donatur:', error);
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat menyimpan data';
      toast.error(`Gagal menyimpan data: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const formatNominalDisplay = (value: number): string => {
    if (!value || value === 0) return '';
    return new Intl.NumberFormat('id-ID').format(value);
  };

  const handleNominalChange = (index: number, currency: string, rawValue: string) => {
    const cleanValue = rawValue.replace(/\./g, '');
    const numValue = parseFloat(cleanValue) || 0;
    
    const updated = [...paymentItems];
    const currentItem = updated[index];
    
    if (currency === 'EGP') {
      updated[index] = { ...currentItem, nominal_egp: numValue };
    } else if (currency === 'IDR') {
      updated[index] = { ...currentItem, nominal_idr: numValue };
    } else if (currency === 'USD') {
      updated[index] = { ...currentItem, nominal_usd: numValue };
    }
    setPaymentItems(updated);
  };

  const handleJenisChange = (index: number, value: string) => {
    const updated = [...paymentItems];
    updated[index] = { ...updated[index], jenis: value };
    setPaymentItems(updated);
  };

  const handleCurrencyChange = (index: number, newCurrency: string) => {
    const currentItem = paymentItems[index];
    const currentCurrency = getItemCurrency(currentItem);
    const currentNominal = getItemNominal(currentItem, currentCurrency);
    
    const updated = [...paymentItems];
    // Reset all currency values
    updated[index] = { 
      ...updated[index], 
      nominal_egp: 0, 
      nominal_idr: 0,
      nominal_usd: 0 
    };
    // Set the new currency value
    if (newCurrency === 'EGP') {
      updated[index] = { ...updated[index], nominal_egp: currentNominal };
    } else if (newCurrency === 'IDR') {
      updated[index] = { ...updated[index], nominal_idr: currentNominal };
    } else if (newCurrency === 'USD') {
      updated[index] = { ...updated[index], nominal_usd: currentNominal };
    }
    setPaymentItems(updated);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={editData ? 'Edit Data Donatur' : 'Form Transaksi Donatur'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Nama Lengkap"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Masukkan nama donatur"
            required
          />
          <Select
            label="Kekeluargaan"
            value={kekeluargaan}
            onChange={(e) => setKekeluargaan(e.target.value)}
            options={KEKELUARGAAN_OPTIONS.map(k => ({ value: k, label: k }))}
            placeholder="Pilih kekeluargaan"
            required
          />
        </div>

        <Select
          label="Metode Pembayaran"
          value={metodePembayaran}
          onChange={(e) => setMetodePembayaran(e.target.value)}
          options={METODE_PEMBAYARAN_OPTIONS.map(m => ({ value: m, label: m }))}
        />

        {/* Payment Items - Responsive Layout */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-emerald-dark">Rincian Pembayaran</h4>
            <Button type="button" variant="outline" size="sm" onClick={addPaymentItem}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Tambah Item
            </Button>
          </div>

          {paymentItems.map((item, index) => {
            const currency = getItemCurrency(item);
            const nominal = getItemNominal(item, currency);
            
            return (
              <div 
                key={index} 
                className={`bg-slate-50/50 border border-slate-200 rounded-xl p-2 ${
                  isMobile ? 'space-y-2' : ''
                }`}
              >
                {isMobile ? (
                  // Mobile Layout: 2 baris
                  <>
                    {/* Baris 1: Jenis + Delete */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Select
                          value={item.jenis}
                          onChange={(e) => handleJenisChange(index, e.target.value)}
                          options={JENIS_PEMBAYARAN_OPTIONS.map(j => ({ value: j, label: j }))}
                          className="text-sm"
                          placeholder="Jenis"
                        />
                      </div>
                      {paymentItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePaymentItem(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          aria-label="Hapus item"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {/* Baris 2: Nominal + Mata Uang */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Input
                          type="text"
                          value={formatNominalDisplay(nominal)}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\./g, '');
                            if (raw === '' || /^\d*$/.test(raw)) {
                              handleNominalChange(index, currency, raw);
                            }
                          }}
                          placeholder="0"
                          className="text-sm text-right"
                        />
                      </div>
                      <div className="w-[90px] flex-shrink-0">
                        <Select
                          value={currency}
                          onChange={(e) => handleCurrencyChange(index, e.target.value)}
                          options={MATA_UANG_OPTIONS.map(m => ({ value: m, label: m }))}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  // Desktop Layout: 3 kolom dalam satu baris
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-[120px]">
                      <Select
                        value={item.jenis}
                        onChange={(e) => handleJenisChange(index, e.target.value)}
                        options={JENIS_PEMBAYARAN_OPTIONS.map(j => ({ value: j, label: j }))}
                        className="text-sm"
                        placeholder="Jenis"
                      />
                    </div>

                    <div className="flex-1 min-w-[100px]">
                      <Input
                        type="text"
                        value={formatNominalDisplay(nominal)}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\./g, '');
                          if (raw === '' || /^\d*$/.test(raw)) {
                            handleNominalChange(index, currency, raw);
                          }
                        }}
                        placeholder="0"
                        className="text-sm text-right"
                      />
                    </div>

                    <div className="w-[80px] flex-shrink-0">
                      <Select
                        value={currency}
                        onChange={(e) => handleCurrencyChange(index, e.target.value)}
                        options={MATA_UANG_OPTIONS.map(m => ({ value: m, label: m }))}
                        className="text-sm"
                      />
                    </div>

                    {paymentItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePaymentItem(index)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                        aria-label="Hapus item"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {paymentItems.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">Belum ada item pembayaran. Klik "Tambah Item" untuk menambahkan.</p>
          )}
        </div>

        {/* Total Card */}
        <Card className="bg-emerald-brand/5 border-emerald-brand/20">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-emerald-dark">Total Pembayaran:</span>
            <div className="text-right">
              {totalEGP > 0 && <p className="text-lg font-bold text-emerald-brand">{formatCurrency(totalEGP, 'EGP')}</p>}
              {totalIDR > 0 && <p className="text-lg font-bold text-emerald-brand">{formatCurrency(totalIDR, 'IDR')}</p>}
              {totalUSD > 0 && <p className="text-lg font-bold text-emerald-brand">{formatCurrency(totalUSD, 'USD')}</p>}
              {totalEGP === 0 && totalIDR === 0 && totalUSD === 0 && (
                <p className="text-sm text-slate-400">Belum ada nominal</p>
              )}
            </div>
          </div>
        </Card>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose} className="flex-1">
            Batal
          </Button>
          <Button type="submit" isLoading={isLoading} className="flex-1">
            {editData ? 'Simpan Perubahan' : 'Simpan Transaksi'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};