// app/(dashboard)/mustahiq/page.tsx

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Mustahiq, MustahiqData } from '@/types';
import { SearchBar } from '@/components/ui/SearchBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { fetchExchangeRates, ExchangeRates, initializeScoringRates, forceUpdateRates } from '@/lib/utils/scoring';
import { calculateMustahiqScore, ScoreResult } from '@/lib/utils/scoring';
import { MustahiqForm } from '@/components/forms/MustahiqForm';
import toast from 'react-hot-toast';
import type { Database } from '@/lib/supabase/types';

const ASNAF_OPTIONS = [
  'Fakir', 'Miskin', 'Amil', 'Muallaf', 'Riqab', 'Gharimin', 'Fisabilillah', 'Ibnu Sabil'
];

const MATA_UANG_OPTIONS = ['EGP', 'USD', 'IDR'];

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Semua Status' },
  { value: 'Layak Menerima', label: 'Layak Menerima' },
  { value: 'Proses Survei', label: 'Proses Survei' },
  { value: 'Tidak Layak', label: 'Tidak Layak' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Terbaru' },
  { value: 'oldest', label: 'Terlama' },
  { value: 'name_asc', label: 'Nama A-Z' },
  { value: 'name_desc', label: 'Nama Z-A' },
  { value: 'score_desc', label: 'Skor Tertinggi' },
  { value: 'score_asc', label: 'Skor Terendah' },
];

type MustahiqRow = Database['public']['Tables']['mustahiq']['Row'];
type MustahiqUpdate = Database['public']['Tables']['mustahiq']['Update'];

type DistribusiDraft = {
  nominal: string;
  mata_uang: string;
  asnaf: string;
  tanggal: string;
  keterangan: string;
};


const normalizeKendaraanList = (value: MustahiqRow['kendaraan_list']): import('@/types').Kendaraan[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const jenis = typeof entry.jenis === 'string' ? entry.jenis : '';
    const rincian = typeof entry.rincian === 'string' ? entry.rincian : '';
    return jenis && rincian ? [{ jenis, rincian }] : [];
  });
};

const normalizeHutangList = (value: MustahiqRow['hutang_list']): import('@/types').HutangData[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const kepada = typeof entry.kepada === 'string' ? entry.kepada : '';
    const kekeluargaan = typeof entry.kekeluargaan === 'string' ? entry.kekeluargaan : '';
    const nominal = typeof entry.nominal === 'number' ? entry.nominal : Number(entry.nominal);
    const mata_uang = typeof entry.mata_uang === 'string' ? entry.mata_uang : 'EGP';
    const tujuan = typeof entry.tujuan === 'string' ? entry.tujuan : '';
    const tujuan_lainnya = typeof entry.tujuan_lainnya === 'string' ? entry.tujuan_lainnya : undefined;
    if (!kepada || !Number.isFinite(nominal) || nominal <= 0) return [];
    return [{ kepada, kekeluargaan, nominal, mata_uang, tujuan, tujuan_lainnya }];
  });
};

const createDistribusiDraft = (item: Mustahiq): DistribusiDraft => ({
  nominal: item.nominal_diterima?.toString() || '',
  mata_uang: item.mata_uang || 'EGP',
  asnaf: item.asnaf || '',
  tanggal: item.tanggal_distribusi || '',
  keterangan: item.keterangan || '',
});

const normalizeMustahiqRow = (row: MustahiqRow): Mustahiq => ({
  ...row,
  almamater: row.almamater,
  no_telp_mesir: row.no_telp_mesir,
  jenjang_pendidikan: row.jenjang_pendidikan,
  mustawa_tingkat: row.mustawa_tingkat,
  nama_fakultas: row.nama_fakultas,
  nama_jurusan: row.nama_jurusan,
  tingkat_kuliah: row.tingkat_kuliah,
  pendidikan_lainnya: row.pendidikan_lainnya,
  status_tempat_tinggal: row.status_tempat_tinggal || '',
  pekerjaan_ayah: row.pekerjaan_ayah || '',
  pekerjaan_ibu: row.pekerjaan_ibu || '',
  kiriman_orangtua: row.kiriman_orangtua || '',
  status_menikah: row.status_menikah || '',
  punya_tanggungan: row.punya_tanggungan || '',
  punya_hutang: row.punya_hutang || '',
  punya_beasiswa: row.punya_beasiswa || '',
  merokok: row.merokok || '',
  kendaraan_list: normalizeKendaraanList(row.kendaraan_list),
  hutang_list: normalizeHutangList(row.hutang_list),
  scoring: row.scoring ?? undefined,
  scoring_details: row.scoring_details ?? undefined,
  last_modified: row.last_modified ?? undefined,
});

export default function MustahiqPage() {
  const [mustahiqList, setMustahiqList] = useState<Mustahiq[]>([]);
  const [filteredList, setFilteredList] = useState<Mustahiq[]>([]);
  const [selectedMustahiq, setSelectedMustahiq] = useState<Mustahiq | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [scoringCache, setScoringCache] = useState<Record<string, ScoreResult>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<Mustahiq | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkNominal, setBulkNominal] = useState('');
  const [bulkMataUang, setBulkMataUang] = useState('EGP');
  const [bulkTanggal, setBulkTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [bulkAsnaf, setBulkAsnaf] = useState('');
  const [currentRates, setCurrentRates] = useState<ExchangeRates | null>(null);
  const [ratesLoading, setRatesLoading] = useState(true);

  const [distribusiForm, setDistribusiForm] = useState<Record<string, DistribusiDraft>>({});

  useEffect(() => {
    initializeScoringRates().catch(err => {
      console.warn('[MustahiqPage] ⚠️ Gagal inisialisasi kurs:', err);
    });
  }, []);

  useEffect(() => { fetchMustahiq(); }, []);

  useEffect(() => {
    const loadRates = async () => {
      try {
        setRatesLoading(true);
        const rates = await fetchExchangeRates();
        setCurrentRates(rates);
      } catch (error) {
        console.warn('[MustahiqPage] Gagal load kurs:', error);
      } finally {
        setRatesLoading(false);
      }
    };
    
    loadRates();
    
    const interval = setInterval(loadRates, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let filtered = [...mustahiqList];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(m =>
        (m.nama_lengkap || '').toLowerCase().includes(query) ||
        (m.id_mustahiq || '').toLowerCase().includes(query) ||
        (m.almamater || '').toLowerCase().includes(query) ||
        (m.alamat_mesir || '').toLowerCase().includes(query) ||
        (m.jenjang_pendidikan || '').toLowerCase().includes(query)
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(m => m.status_verifikasi === statusFilter);
    }
    
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime());
        break;
      case 'name_asc':
        filtered.sort((a, b) => (a.nama_lengkap || '').localeCompare(b.nama_lengkap || ''));
        break;
      case 'name_desc':
        filtered.sort((a, b) => (b.nama_lengkap || '').localeCompare(a.nama_lengkap || ''));
        break;
      case 'score_desc':
        filtered.sort((a, b) => (scoringCache[b.id]?.percentage || 0) - (scoringCache[a.id]?.percentage || 0));
        break;
      case 'score_asc':
        filtered.sort((a, b) => (scoringCache[a.id]?.percentage || 0) - (scoringCache[b.id]?.percentage || 0));
        break;
    }
    
    setFilteredList(filtered);
  }, [searchQuery, mustahiqList, statusFilter, sortBy, scoringCache]);

  useEffect(() => {
    if (!selectedMustahiq) return;

    setDistribusiForm((previous) => {
      if (previous[selectedMustahiq.id]) return previous;
      return {
        ...previous,
        [selectedMustahiq.id]: createDistribusiDraft(selectedMustahiq),
      };
    });
  }, [selectedMustahiq]);

  const handleRefreshRates = async () => {
    console.log('[UI] 🔄 Tombol Refresh Kurs diklik!');
    setRatesLoading(true);
    
    try {
      const rates = await forceUpdateRates();
      setCurrentRates(rates);
      toast.success(
        `✅ Kurs diperbarui!\n1 USD = ${rates.USD_TO_EGP} EGP\n1 IDR = ${rates.IDR_TO_EGP} EGP`
      );
    } catch (error) {
      console.error('[UI] ❌ Gagal memperbarui kurs:', error);
      toast.error('❌ Gagal memperbarui kurs');
    } finally {
      setRatesLoading(false);
    }
  };

  // 🔥 FIXED: FETCH MUSTAHIQ dengan konversi null → string
  const fetchMustahiq = async (): Promise<Mustahiq[]> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('mustahiq')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const list = (data ?? []).map(normalizeMustahiqRow);
      setMustahiqList(list);
      setFilteredList(list);
      
      const cache: Record<string, ScoreResult> = {};
      list.forEach((m) => {
        // 🔥 FIX: Semua properti yang mungkin null diubah ke string kosong
        const mustahiqData: MustahiqData = {
          ...m,
          biaya_sewa: m.biaya_sewa || undefined,
          nominal_pendapatan: m.nominal_pendapatan || undefined,
          nominal_beasiswa: m.nominal_beasiswa || undefined,
          hutang_list: m.hutang_list || [],
          kendaraan_list: m.kendaraan_list || [],
          sumber_dana_utama: m.sumber_dana_utama || undefined,
          sumber_dana_lainnya: m.sumber_dana_lainnya || undefined,
          nominal_kiriman: m.nominal_kiriman || undefined,
          rincian_tanggungan: m.rincian_tanggungan || undefined,
          status_beasiswa: m.status_beasiswa || undefined,
          cakupan_beasiswa: m.cakupan_beasiswa || undefined,
          // 🔥 FIX: null → string kosong
          penghasilan_ayah: m.penghasilan_ayah || '',
          penghasilan_ibu: m.penghasilan_ibu || '',
          pekerjaan_ayah: m.pekerjaan_ayah || '',
          pekerjaan_ibu: m.pekerjaan_ibu || '',
          anak_keberapa: m.anak_keberapa || '',
          jenjang_pendidikan: m.jenjang_pendidikan || '',
          status_tempat_tinggal: m.status_tempat_tinggal || '',
          kiriman_orangtua: m.kiriman_orangtua || '',
          status_menikah: m.status_menikah || '',
          punya_tanggungan: m.punya_tanggungan || '',
          punya_hutang: m.punya_hutang || '',
          punya_beasiswa: m.punya_beasiswa || '',
          merokok: m.merokok || '',
        };
        cache[m.id] = calculateMustahiqScore(mustahiqData);
      });
      setScoringCache(cache);
      return list;
    } catch (error) {
      console.error('Error fetching mustahiq:', error);
      toast.error('Gagal memuat data mustahiq');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const getScoring = useCallback((mustahiq: Mustahiq): ScoreResult => {
    if (scoringCache[mustahiq.id]) return scoringCache[mustahiq.id];
    
    const mustahiqData: MustahiqData = {
      ...mustahiq,
      biaya_sewa: mustahiq.biaya_sewa || undefined,
      nominal_pendapatan: mustahiq.nominal_pendapatan || undefined,
      nominal_beasiswa: mustahiq.nominal_beasiswa || undefined,
      hutang_list: mustahiq.hutang_list || [],
      kendaraan_list: mustahiq.kendaraan_list || [],
      sumber_dana_utama: mustahiq.sumber_dana_utama || undefined,
      sumber_dana_lainnya: mustahiq.sumber_dana_lainnya || undefined,
      nominal_kiriman: mustahiq.nominal_kiriman || undefined,
      rincian_tanggungan: mustahiq.rincian_tanggungan || undefined,
      status_beasiswa: mustahiq.status_beasiswa || undefined,
      cakupan_beasiswa: mustahiq.cakupan_beasiswa || undefined,
      penghasilan_ayah: mustahiq.penghasilan_ayah || '',
      penghasilan_ibu: mustahiq.penghasilan_ibu || '',
      pekerjaan_ayah: mustahiq.pekerjaan_ayah || '',
      pekerjaan_ibu: mustahiq.pekerjaan_ibu || '',
      anak_keberapa: mustahiq.anak_keberapa || '',
      jenjang_pendidikan: mustahiq.jenjang_pendidikan || '',
      status_tempat_tinggal: mustahiq.status_tempat_tinggal || '',
      kiriman_orangtua: mustahiq.kiriman_orangtua || '',
      status_menikah: mustahiq.status_menikah || '',
      punya_tanggungan: mustahiq.punya_tanggungan || '',
      punya_hutang: mustahiq.punya_hutang || '',
      punya_beasiswa: mustahiq.punya_beasiswa || '',
      merokok: mustahiq.merokok || '',
    };
    return calculateMustahiqScore(mustahiqData);
  }, [scoringCache]);

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-gradient-to-r from-emerald-400 to-emerald-600', border: 'border-emerald-200', badge: 'success' as const, shadow: 'shadow-emerald-100' };
    if (percentage >= 65) return { bg: 'bg-green-50', text: 'text-green-700', bar: 'bg-gradient-to-r from-green-400 to-green-600', border: 'border-green-200', badge: 'success' as const, shadow: 'shadow-green-100' };
    if (percentage >= 50) return { bg: 'bg-yellow-50', text: 'text-yellow-700', bar: 'bg-gradient-to-r from-yellow-400 to-yellow-600', border: 'border-yellow-200', badge: 'warning' as const, shadow: 'shadow-yellow-100' };
    if (percentage >= 35) return { bg: 'bg-orange-50', text: 'text-orange-700', bar: 'bg-gradient-to-r from-orange-400 to-orange-600', border: 'border-orange-200', badge: 'warning' as const, shadow: 'shadow-orange-100' };
    return { bg: 'bg-red-50', text: 'text-red-700', bar: 'bg-gradient-to-r from-red-400 to-red-600', border: 'border-red-200', badge: 'danger' as const, shadow: 'shadow-red-100' };
  };

  const getStatusBadge = (status: string): "success" | "danger" | "warning" | "default" => {
    switch (status) {
      case 'Layak Menerima': return 'success';
      case 'Tidak Layak': return 'danger';
      case 'Proses Survei': return 'warning';
      default: return 'default';
    }
  };

  const handleCardClick = (m: Mustahiq) => {
    setSelectedMustahiq(m);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToList = () => {
    setSelectedMustahiq(null);
    setEditData(null);
    setShowForm(false);
  };

  const handleEdit = (m: Mustahiq) => {
    setEditData(m);
    setShowForm(true);
  };

  const handleAddNew = () => {
    setEditData(null);
    setShowForm(true);
  };

  const handleDelete = async (id: string, fotoUrl?: string | null) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus data mustahiq ini?')) return;
    
    try {
      const { error } = await supabase.from('mustahiq').delete().eq('id', id);
      if (error) throw error;

      // Hapus file setelah row database berhasil dihapus. Jika storage gagal,
      // dampaknya hanya file yatim, bukan data aktif dengan URL yang rusak.
      if (fotoUrl) {
        const fileName = fotoUrl.split('/').pop()?.split('?')[0];
        if (fileName) {
          const { error: storageError } = await supabase.storage
            .from('mustahiq-photos')
            .remove([fileName]);
          if (storageError) console.warn('Gagal membersihkan foto:', storageError);
        }
      }

      toast.success('Data mustahiq berhasil dihapus');
      setSelectedMustahiq(null);
      fetchMustahiq();
    } catch (error) {
      console.error('Error deleting mustahiq:', error);
      toast.error('Gagal menghapus data');
    }
  };

  // Update status verifikasi
  const updateVerificationStatus = async (id: string, status: string) => {
    try {
      const updateData: MustahiqUpdate = {
        status_verifikasi: status,
        last_modified: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('mustahiq')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success(`Status diubah menjadi "${status}"`);
      
      if (selectedMustahiq?.id === id) {
        setSelectedMustahiq(prev => prev ? { ...prev, status_verifikasi: status } : null);
      }
      
      fetchMustahiq();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Gagal mengubah status');
    }
  };

  // Simpan distribusi dan keterangan
  const saveDistribusiDanKeterangan = async (id: string) => {
    const form = distribusiForm[id];
    if (!form) return;

    try {
      const updates: MustahiqUpdate = {
        last_modified: new Date().toISOString(),
        mata_uang: form.mata_uang,
        asnaf: form.asnaf || null,
        tanggal_distribusi: form.tanggal,
        keterangan: form.keterangan,
      };

      if (form.nominal) updates.nominal_diterima = parseFloat(form.nominal);
      
      const { error } = await supabase
        .from('mustahiq')
        .update(updates)
        .eq('id', id);
        
      if (error) throw error;
      
      const applyLocalUpdate = (mustahiq: Mustahiq): Mustahiq => ({
        ...mustahiq,
        mata_uang: form.mata_uang,
        asnaf: form.asnaf || null,
        tanggal_distribusi: form.tanggal,
        keterangan: form.keterangan,
        last_modified: updates.last_modified ?? new Date().toISOString(),
        ...(form.nominal ? { nominal_diterima: parseFloat(form.nominal) } : {}),
      });

      setSelectedMustahiq(prev => prev?.id === id ? applyLocalUpdate(prev) : prev);
      setMustahiqList(prev => prev.map(m => m.id === id ? applyLocalUpdate(m) : m));
      
      setDistribusiForm(prev => ({ ...prev, [id]: { nominal: '', mata_uang: 'EGP', asnaf: '', tanggal: '', keterangan: '' } }));
      
      toast.success('Data berhasil disimpan');
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Gagal menyimpan data');
    }
  };

  const updateDistribusiField = (
    id: string,
    field: keyof DistribusiDraft,
    value: string,
  ) => {
    setDistribusiForm(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { nominal: '', mata_uang: 'EGP', asnaf: '', tanggal: '', keterangan: '' }), [field]: value }
    }));
  };

  // Distribusi kolektif
  const handleBulkDistribution = async () => {
    const nominal = parseFloat(bulkNominal);
    if (!nominal || nominal <= 0) {
      toast.error('Masukkan nominal yang valid');
      return;
    }
    
    const layakList = mustahiqList.filter(m => m.status_verifikasi === 'Layak Menerima');
    
    if (layakList.length === 0) {
      toast.error('Tidak ada mustahiq dengan status Layak Menerima');
      return;
    }
    
    const totalAmount = nominal * layakList.length;
    if (!window.confirm(`Distribusikan ${formatCurrency(nominal, bulkMataUang)} per orang (Total: ${formatCurrency(totalAmount, bulkMataUang)}) ke ${layakList.length} mustahiq?`)) return;
    
    setIsLoading(true);
    
    try {
      const updateData: MustahiqUpdate = {
        nominal_diterima: nominal,
        mata_uang: bulkMataUang,
        tanggal_distribusi: bulkTanggal,
        last_modified: new Date().toISOString(),
        asnaf: bulkAsnaf || null,
      };

      const { error } = await supabase
        .from('mustahiq')
        .update(updateData)
        .in('id', layakList.map((item) => item.id));

      if (error) throw error;
      
      toast.success(`Berhasil distribusi ke ${layakList.length} mustahiq`);
      setShowBulkModal(false);
      setBulkNominal('');
      setBulkAsnaf('');
      fetchMustahiq();
    } catch (error) {
      console.error('Bulk distribution error:', error);
      toast.error('Gagal distribusi kolektif');
    } finally {
      setIsLoading(false);
    }
  };

  const stats = {
    total: mustahiqList.length,
    layak: mustahiqList.filter(m => m.status_verifikasi === 'Layak Menerima').length,
    survei: mustahiqList.filter(m => m.status_verifikasi === 'Proses Survei').length,
    tidakLayak: mustahiqList.filter(m => m.status_verifikasi === 'Tidak Layak').length,
    avgScore: mustahiqList.length > 0 
      ? Math.round(mustahiqList.reduce((acc, m) => acc + (scoringCache[m.id]?.percentage || 0), 0) / mustahiqList.length) 
      : 0,
  };

  // ============================================================
  // DETAIL VIEW
  // ============================================================
  if (selectedMustahiq) {
    const item = selectedMustahiq;
    const scoring = getScoring(item);
    const scoreColor = getScoreColor(scoring.percentage);
    const isLayak = item.status_verifikasi === 'Layak Menerima';
    
    const dForm = distribusiForm[item.id] || createDistribusiDraft(item);

    return (
      <div className="space-y-4 sm:space-y-5 lg:space-y-6 animate-fadeIn">
        {/* Header Bar - Detail View */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
            <button 
              onClick={handleBackToList} 
              className="flex items-center gap-2 text-slate-600 hover:text-emerald-700 transition-colors group flex-shrink-0"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-1 transition-transform">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span className="text-sm font-medium">Kembali</span>
            </button>
            
            <div className="sm:hidden">
              <Badge variant={getStatusBadge(item.status_verifikasi)}>
                {item.status_verifikasi || 'Proses Survei'}
              </Badge>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="hidden sm:block">
              <Badge variant={getStatusBadge(item.status_verifikasi)}>
                {item.status_verifikasi || 'Proses Survei'}
              </Badge>
            </div>
            
            <div className="hidden sm:block w-px h-6 bg-slate-200" />
            
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <button
                onClick={() => handleEdit(item)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all duration-200 shadow-sm"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <span>Edit</span>
              </button>
              
              <a
                href={`https://wa.me/${(item.no_wa_aktif || '').replace(/\+/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-medium bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 hover:border-green-300 transition-all duration-200 shadow-sm"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span>WA</span>
              </a>
              
              <button
                onClick={() => handleDelete(item.id, item.foto_url)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-medium bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300 transition-all duration-200 shadow-sm"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>Hapus</span>
              </button>
            </div>
          </div>
        </div>

        {/* HEADER DENGAN INDIKATOR KURS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 lg:gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-emerald-dark truncate">
              Data Mustahiq
            </h1>
            <p className="text-[10px] sm:text-xs lg:text-sm text-slate-500 mt-0.5 truncate">
              Kelola data calon penerima zakat dan bantuan
            </p>
            
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 lg:gap-2 mt-1.5 sm:mt-2">
              <KursIndicator rates={currentRates} loading={ratesLoading} />
              <button
                onClick={handleRefreshRates}
                disabled={ratesLoading}
                className="text-[9px] sm:text-[10px] px-1.5 sm:px-2.5 py-1 sm:py-1.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition-all flex items-center gap-0.5 sm:gap-1.5 flex-shrink-0 hover:shadow-md active:scale-95"
              >
                {ratesLoading ? (
                  <>
                    <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeLinecap="round" />
                    </svg>
                    <span className="hidden sm:inline">Memperbarui...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="23 4 23 10 17 10" />
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                    <span className="hidden sm:inline">Refresh Kurs</span>
                    <span className="sm:hidden">Refresh</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Score Hero + Status */}
        <div className={`${scoreColor.bg} rounded-2xl p-4 sm:p-6 lg:p-8 border ${scoreColor.border} shadow-lg`}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6">
            <div className="flex-1">
              <div className="flex items-end gap-3 sm:gap-4 mb-3 sm:mb-4">
                <span className={`text-5xl sm:text-7xl lg:text-8xl font-black ${scoreColor.text} leading-none`}>{scoring.percentage}</span>
                <div className="mb-1 sm:mb-2">
                  <p className="text-xs sm:text-sm text-slate-500">dari 100 poin</p>
                  <p className={`text-sm sm:text-lg font-bold ${scoreColor.text}`}>Grade {scoring.grade}</p>
                </div>
              </div>
              
              <div className="w-full h-4 sm:h-5 bg-white/60 rounded-full overflow-hidden mb-2 sm:mb-3 shadow-inner">
                <div className={`h-full rounded-full transition-all duration-1000 ${scoreColor.bar} shadow-lg`} style={{ width: `${Math.min(scoring.percentage, 100)}%` }} />
              </div>
              
              <span className={`text-lg sm:text-xl lg:text-2xl font-bold ${scoreColor.text}`}>{scoring.recommendation}</span>
              {scoring.asnafRecommendation && (
                <p className="text-xs sm:text-sm text-slate-500 mt-1">Rekomendasi Asnaf: <span className="font-semibold text-slate-700">{scoring.asnafRecommendation}</span></p>
              )}
            </div>
            
            <div className="flex lg:flex-col gap-2 min-w-[140px] sm:min-w-[160px]">
              <button onClick={() => updateVerificationStatus(item.id, 'Layak Menerima')}
                className={`flex-1 lg:flex-none px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
                  isLayak ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 scale-105' : 'bg-white text-emerald-700 hover:bg-emerald-50 border-2 border-emerald-200'
                }`}>Layak</button>
              <button onClick={() => updateVerificationStatus(item.id, 'Proses Survei')}
                className={`flex-1 lg:flex-none px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
                  item.status_verifikasi === 'Proses Survei' ? 'bg-amber-500 text-white shadow-lg shadow-amber-200 scale-105' : 'bg-white text-amber-700 hover:bg-amber-50 border-2 border-amber-200'
                }`}>Survei</button>
              <button onClick={() => updateVerificationStatus(item.id, 'Tidak Layak')}
                className={`flex-1 lg:flex-none px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
                  item.status_verifikasi === 'Tidak Layak' ? 'bg-red-500 text-white shadow-lg shadow-red-200 scale-105' : 'bg-white text-red-700 hover:bg-red-50 border-2 border-red-200'
                }`}>Tolak</button>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-5">
            {/* User Info Header */}
            <Card padding="lg">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xl sm:text-2xl lg:text-3xl font-bold shadow-lg flex-shrink-0">
                  {(item.nama_lengkap || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-800 truncate">{item.nama_lengkap}</h1>
                  <p className="text-xs sm:text-sm text-slate-500">{item.id_mustahiq}</p>
                  <p className="text-xs sm:text-sm text-slate-500">{item.almamater || '-'}</p>
                </div>
              </div>
            </Card>

            {/* Scoring Details */}
            {scoring.details?.length > 0 && (
              <Card padding="lg">
                <h3 className="text-sm sm:text-base font-bold text-slate-700 mb-3 sm:mb-4 flex items-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>
                  Rincian Skor Kelayakan
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {scoring.details.map((detail, idx) => (
                    <div key={idx} className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 bg-slate-50 rounded-xl">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-xs sm:text-sm ${
                        detail.score >= detail.maxScore * 0.7 ? 'bg-emerald-100 text-emerald-600' :
                        detail.score >= detail.maxScore * 0.4 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'
                      }`}>{detail.score}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-slate-700">{detail.category}</p>
                        <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">{detail.reason}</p>
                        <div className="mt-1.5 sm:mt-2 w-full h-1.5 sm:h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${detail.score >= detail.maxScore * 0.7 ? 'bg-emerald-400' : detail.score >= detail.maxScore * 0.4 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${(detail.score / detail.maxScore) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-[10px] sm:text-xs text-slate-400 flex-shrink-0">/{detail.maxScore}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Data Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <DetailCard icon={<UserIcon />} title="Data Diri & Identitas">
                <InfoRow label="Tahun Kedatangan" value={item.tahun_kedatangan ? String(item.tahun_kedatangan) : '-'} />
                <InfoRow label="No. Telp Mesir" value={item.no_telp_mesir || '-'} />
                <InfoRow label="No. WA Aktif" value={item.no_wa_aktif || '-'} />
                <InfoRow label="Alamat Mesir" value={item.alamat_mesir || '-'} />
                <InfoRow label="Alamat Indonesia" value={item.alamat_indonesia || '-'} />
              </DetailCard>

              <DetailCard icon={<AcademicIcon />} title="Akademik & Pendidikan">
                <InfoRow label="Jenjang" value={item.jenjang_pendidikan || '-'} />
                {item.mustawa_tingkat && <InfoRow label="Mustawa" value={item.mustawa_tingkat} />}
                {item.nama_fakultas && <InfoRow label="Fakultas" value={item.nama_fakultas} />}
                {item.nama_jurusan && <InfoRow label="Jurusan" value={item.nama_jurusan} />}
                {item.tingkat_kuliah && <InfoRow label="Tingkat" value={item.tingkat_kuliah} />}
                {item.pendidikan_lainnya && <InfoRow label="Lainnya" value={item.pendidikan_lainnya} />}
              </DetailCard>

              <DetailCard icon={<ParentsIcon />} title="Orang Tua & Aset">
                <InfoRow label="Pekerjaan Ayah" value={item.pekerjaan_ayah || '-'} />
                <InfoRow label="Pekerjaan Ibu" value={item.pekerjaan_ibu || '-'} />
                <InfoRow label="Penghasilan Ayah" value={item.penghasilan_ayah || '-'} />
                <InfoRow label="Penghasilan Ibu" value={item.penghasilan_ibu || '-'} />
                <InfoRow label="Anak ke" value={item.anak_keberapa || '-'} />
                <InfoRow label="Kendaraan" value={item.jumlah_kendaraan ? String(item.jumlah_kendaraan) : '0'} />
              </DetailCard>

              <DetailCard icon={<FinanceIcon />} title="Finansial">
                <InfoRow label="Kiriman" value={item.kiriman_orangtua || '-'} />
                {item.nominal_kiriman && <InfoRow label="Nominal Kiriman" value={item.nominal_kiriman} />}
                {item.sumber_dana_utama && <InfoRow label="Sumber Dana" value={item.sumber_dana_utama} />}
                <InfoRow label="Pendapatan/Bulan" value={item.nominal_pendapatan || '-'} />
                <InfoRow label="Menikah" value={item.status_menikah || '-'} />
                <InfoRow label="Tanggungan" value={item.punya_tanggungan === 'Ya' ? `${item.jumlah_tanggungan} orang` : 'Tidak'} />
                {item.rincian_tanggungan && <InfoRow label="Rincian" value={item.rincian_tanggungan} />}
                <InfoRow label="Hutang" value={item.punya_hutang || '-'} />
                <InfoRow label="Beasiswa" value={item.punya_beasiswa === 'Ya' ? `${item.status_beasiswa || ''}` : 'Tidak'} />
              </DetailCard>
            </div>

            {/* DISTRIBUSI & KETERANGAN - DESKTOP */}
            <div className="hidden lg:block">
              <DistribusiKeteranganCard
                item={item}
                isLayak={isLayak}
                dForm={dForm}
                scoring={scoring}
                updateField={(field, value) => updateDistribusiField(item.id, field, value)}
                onSave={() => saveDistribusiDanKeterangan(item.id)}
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-1 space-y-4 sm:space-y-5">
            {/* Foto */}
            {item.foto_url && (
              <Card padding="none" className="overflow-hidden">
                <div className="bg-slate-50 flex items-center justify-center">
                  <img src={item.foto_url} alt="Foto Rumah" className="w-full h-auto max-h-[50vh] sm:max-h-[70vh] object-contain" loading="lazy"
                    onError={(e) => { const t = e.target as HTMLImageElement; t.style.display = 'none'; if (t.parentElement) t.parentElement.innerHTML = '<div class="flex flex-col items-center justify-center py-16 sm:py-20 w-full"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-slate-300 mb-3"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><p class="text-xs sm:text-sm text-slate-400">Foto tidak tersedia</p></div>'; }} />
                </div>
                <div className="p-3 sm:p-4 bg-gradient-to-r from-slate-50 to-white border-t border-slate-100">
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-700">Foto Rumah di Indonesia</h4>
                  <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">Tampak luar keseluruhan bangunan</p>
                </div>
              </Card>
            )}

            {/* Info Tambahan */}
            <Card padding="lg">
              <h3 className="text-xs sm:text-sm font-bold text-slate-700 mb-3">Informasi Tambahan</h3>
              <div className="space-y-1.5 sm:space-y-2">
                <InfoRow label="Status Tinggal" value={item.status_tempat_tinggal || '-'} />
                {item.biaya_sewa && <InfoRow label="Biaya Sewa" value={item.biaya_sewa} />}
                <InfoRow label="Merokok" value={item.merokok === 'Ya' ? `Ya, ${item.rokok_per_hari} bks/hr` : 'Tidak'} />
                <InfoRow label="Dibuat" value={item.created_at ? formatDate(item.created_at) : '-'} />
                <InfoRow label="Diubah" value={item.last_modified ? formatDate(item.last_modified) : '-'} />
              </div>
            </Card>

            {/* Quick Info */}
            {(item.kendaraan_list && item.kendaraan_list.length > 0 || item.hutang_list && item.hutang_list.length > 0) && (
              <Card padding="lg">
                {item.kendaraan_list && item.kendaraan_list.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-[11px] sm:text-xs font-semibold text-slate-600 mb-1.5">Kendaraan ({item.jumlah_kendaraan})</h4>
                    {item.kendaraan_list.map((k, i) => (
                      <p key={i} className="text-[10px] sm:text-xs text-slate-500">{i+1}. {k.jenis} - {k.rincian}</p>
                    ))}
                  </div>
                )}
                {item.hutang_list && item.hutang_list.length > 0 && (
                  <div>
                    <h4 className="text-[11px] sm:text-xs font-semibold text-slate-600 mb-1.5">Hutang</h4>
                    {item.hutang_list.map((h, i) => (
                      <p key={i} className="text-[10px] sm:text-xs text-slate-500">{i+1}. {h.kepada} - {formatCurrency(h.nominal, h.mata_uang)}</p>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* DISTRIBUSI & KETERANGAN - MOBILE */}
            <div className="lg:hidden">
              <DistribusiKeteranganCard
                item={item}
                isLayak={isLayak}
                dForm={dForm}
                scoring={scoring}
                updateField={(field, value) => updateDistribusiField(item.id, field, value)}
                onSave={() => saveDistribusiDanKeterangan(item.id)}
              />
            </div>
          </div>
        </div>

        {/* Form Modal */}
        <MustahiqForm editData={editData} isOpen={showForm}
          onClose={() => { setShowForm(false); setEditData(null); }}
          onSuccess={async () => { const list = await fetchMustahiq(); if (editData?.id && list) { const updated = list.find(m => m.id === editData.id); if (updated) setSelectedMustahiq(updated); } }} />
      </div>
    );
  }

  // ============================================================
  // LIST VIEW
  // ============================================================
  return (
    <div className="space-y-4 sm:space-y-5 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-emerald-dark">Data Mustahiq</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Kelola data calon penerima zakat dan bantuan</p>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
            <KursIndicator rates={currentRates} loading={ratesLoading} />
            <button
              onClick={handleRefreshRates}
              disabled={ratesLoading}
              className="text-[9px] sm:text-[10px] px-1.5 sm:px-2.5 py-1 sm:py-1.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition-all flex items-center gap-0.5 sm:gap-1.5 flex-shrink-0"
            >
              {ratesLoading ? (
                <>
                  <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeLinecap="round" />
                  </svg>
                  <span className="hidden sm:inline">Memperbarui...</span>
                  <span className="sm:hidden">...</span>
                </>
              ) : (
                <>
                  <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  <span className="hidden sm:inline">Refresh Kurs</span>
                  <span className="sm:hidden">Refresh</span>
                </>
              )}
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleAddNew} size="lg" className="text-xs sm:text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5 sm:mr-2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Tambah
          </Button>
          {stats.layak > 0 && (
            <Button variant="outline" onClick={() => setShowBulkModal(true)} size="lg" className="text-xs sm:text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5 sm:mr-2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              Distribusi ({stats.layak})
            </Button>
          )}
        </div>
      </div>

      {/* Stats - Desktop */}
      <div className="hidden lg:grid grid-cols-4 gap-4">
        <StatCard icon={<UsersIcon />} value={stats.total} label="Total Mustahiq" color="emerald" />
        <StatCard icon={<CheckIcon />} value={stats.layak} label="Layak Menerima" color="green" />
        <StatCard icon={<ClockIcon />} value={stats.survei} label="Proses Survei" color="amber" />
        <StatCard icon={<ChartIcon />} value={stats.avgScore} label="Rata-rata Skor" color="blue" />
      </div>

      {/* Stats - Mobile */}
      <div className="lg:hidden grid grid-cols-2 gap-2 sm:gap-3">
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm">
          <p className="text-lg sm:text-2xl font-bold text-slate-800">{stats.total}</p>
          <p className="text-[10px] sm:text-xs text-slate-500">Total Mustahiq</p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm">
          <p className="text-lg sm:text-2xl font-bold text-emerald-600">{stats.layak}</p>
          <p className="text-[10px] sm:text-xs text-slate-500">Layak Menerima</p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm">
          <p className="text-lg sm:text-2xl font-bold text-amber-600">{stats.survei}</p>
          <p className="text-[10px] sm:text-xs text-slate-500">Proses Survei</p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm">
          <p className="text-lg sm:text-2xl font-bold text-blue-600">{stats.avgScore}</p>
          <p className="text-[10px] sm:text-xs text-slate-500">Rata-rata Skor</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="flex-1">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Cari nama, ID, almamater..." />
        </div>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-none px-2.5 sm:px-3 py-2 text-[11px] sm:text-xs lg:text-sm bg-white border border-slate-200 rounded-lg sm:rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer">
            {STATUS_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
            className="flex-1 sm:flex-none px-2.5 sm:px-3 py-2 text-[11px] sm:text-xs lg:text-sm bg-white border border-slate-200 rounded-lg sm:rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer">
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 sm:h-96"><LoadingSpinner size="lg" /></div>
      ) : filteredList.length === 0 ? (
        <EmptyState
          title={searchQuery || statusFilter !== 'all' ? 'Data tidak ditemukan' : 'Belum ada data mustahiq'}
          description={searchQuery || statusFilter !== 'all' ? 'Coba ubah filter atau kata kunci' : 'Tambahkan data calon penerima zakat'}
          action={
            !searchQuery && statusFilter === 'all' ? (
              <Button onClick={handleAddNew}>Tambah Mustahiq</Button>
            ) : (
              <Button variant="outline" onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}>Reset Filter</Button>
            )
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between text-[11px] sm:text-xs lg:text-sm text-slate-500">
            <span>Menampilkan <span className="font-semibold text-slate-700">{filteredList.length}</span> dari <span className="font-semibold text-slate-700">{stats.total}</span> mustahiq</span>
            {(statusFilter !== 'all' || searchQuery) && (
              <button onClick={() => { setSearchQuery(''); setStatusFilter('all'); }} className="text-emerald-600 hover:text-emerald-700 underline">Reset filter</button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
            {filteredList.map((m) => <MustahiqCard key={m.id} item={m} scoring={getScoring(m)} scoreColor={getScoreColor(scoringCache[m.id]?.percentage || 0)} onCardClick={handleCardClick} onStatusUpdate={updateVerificationStatus} getStatusBadge={getStatusBadge} />)}
          </div>
        </>
      )}

      {/* Form Modal */}
      <MustahiqForm editData={editData} isOpen={showForm}
        onClose={() => { setShowForm(false); setEditData(null); }}
        onSuccess={() => { fetchMustahiq(); }} />

      {/* Bulk Distribution Modal */}
      <Modal isOpen={showBulkModal} onClose={() => setShowBulkModal(false)} title="Distribusi Kolektif" size="md">
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-slate-600">Distribusikan ke <span className="font-bold text-emerald-700">{stats.layak}</span> mustahiq (Layak Menerima)</p>
          
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Nominal per Orang</label>
            <div className="flex gap-2">
              <input type="number" value={bulkNominal} onChange={(e) => setBulkNominal(e.target.value)} placeholder="0"
                className="flex-1 bg-white border border-slate-200 rounded-lg sm:rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
              <select value={bulkMataUang} onChange={(e) => setBulkMataUang(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg sm:rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                {MATA_UANG_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Tanggal Distribusi</label>
            <input type="date" value={bulkTanggal} onChange={(e) => setBulkTanggal(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg sm:rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
          </div>
          
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Asnaf (Opsional)</label>
            <select value={bulkAsnaf} onChange={(e) => setBulkAsnaf(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg sm:rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
              <option value="">Pilih Asnaf</option>
              {ASNAF_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          
          <div className="bg-amber-50 rounded-lg sm:rounded-xl p-3 border border-amber-200">
            <p className="text-[11px] sm:text-xs text-amber-700">
              Total: <span className="font-bold">{formatCurrency(parseFloat(bulkNominal || '0') * stats.layak, bulkMataUang)}</span> untuk {stats.layak} mustahiq
            </p>
          </div>
          
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowBulkModal(false)} className="flex-1 text-xs sm:text-sm">Batal</Button>
            <Button onClick={handleBulkDistribution} className="flex-1 text-xs sm:text-sm">Distribusikan</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

interface ScoreColorStyle {
  bg: string;
  text: string;
  bar: string;
  border: string;
  badge: 'success' | 'warning' | 'danger';
  shadow: string;
}

type VerificationBadge = 'success' | 'danger' | 'warning' | 'default';

interface MustahiqCardProps {
  item: Mustahiq;
  scoring: ScoreResult;
  scoreColor: ScoreColorStyle;
  onCardClick: (item: Mustahiq) => void;
  onStatusUpdate: (id: string, status: string) => void;
  getStatusBadge: (status: string) => VerificationBadge;
}

const MustahiqCard = ({ item, scoring, scoreColor, onCardClick, onStatusUpdate, getStatusBadge }: MustahiqCardProps) => (
  <div onClick={() => onCardClick(item)}
    className={`group bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-emerald-300 transition-all duration-300 cursor-pointer overflow-hidden hover:scale-[1.01] sm:hover:scale-[1.02] ${scoreColor.shadow}`}>
    <div className={`${scoreColor.bg} px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 lg:py-4 border-b ${scoreColor.border}`}>
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-[10px] sm:text-xs lg:text-sm flex-shrink-0 shadow-md">
              {(item.nama_lengkap || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm lg:text-base font-bold text-slate-800 truncate group-hover:text-emerald-700 transition-colors">{item.nama_lengkap || 'Tanpa Nama'}</h3>
              <p className="text-[9px] sm:text-[10px] lg:text-[11px] text-slate-500 truncate">{item.id_mustahiq || '-'}</p>
            </div>
          </div>
        </div>
        <div className={`flex-shrink-0 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl bg-white/80 backdrop-blur-sm border ${scoreColor.border} shadow-sm`}>
          <span className={`text-sm sm:text-base lg:text-lg font-black ${scoreColor.text}`}>{scoring.percentage}</span>
          <span className={`text-[9px] sm:text-[10px] ${scoreColor.text} ml-0.5`}>/100</span>
        </div>
      </div>
      <div className="mt-2 sm:mt-3">
        <div className="flex justify-between items-center mb-1 sm:mb-1.5">
          <span className={`text-[9px] sm:text-[10px] lg:text-[11px] font-medium ${scoreColor.text}`}>Skor Kelayakan</span>
          <span className={`text-[9px] sm:text-[10px] lg:text-[11px] font-bold ${scoreColor.text}`}>{scoring.recommendation}</span>
        </div>
        <div className="w-full h-1.5 sm:h-2 lg:h-2.5 bg-white/60 rounded-full overflow-hidden shadow-inner">
          <div className={`h-full rounded-full transition-all duration-700 ${scoreColor.bar} shadow-md`} style={{ width: `${Math.min(scoring.percentage, 100)}%` }} />
        </div>
      </div>
    </div>
    <div className="p-3 sm:p-4 lg:p-5 space-y-2 sm:space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-1.5 sm:gap-2">
        <Badge variant={getStatusBadge(item.status_verifikasi)} size="sm">{item.status_verifikasi || 'Proses Survei'}</Badge>
        <span className="text-[10px] sm:text-[11px] lg:text-xs text-slate-500 truncate">{item.jenjang_pendidikan || '-'}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 lg:gap-3 text-[10px] sm:text-[11px] lg:text-xs">
        <InfoGrid label="Pendapatan" value={item.nominal_pendapatan ? item.nominal_pendapatan.replace('/bulan', '').trim() : '-'} />
        <InfoGrid label="Tinggal" value={item.status_tempat_tinggal || '-'} />
        <InfoGrid label="Kiriman" value={item.kiriman_orangtua === 'Ya, masih.' ? 'Ya' : 'Tidak'} />
        <InfoGrid label="Tanggungan" value={item.punya_tanggungan === 'Ya' ? `${item.jumlah_tanggungan} org` : '-'} />
      </div>
      <div className="flex gap-1 sm:gap-1.5 lg:gap-2 pt-2 border-t border-slate-100">
        <QuickStatusBtn label="Layak" status="Layak Menerima" current={item.status_verifikasi} color="emerald" onClick={() => onStatusUpdate(item.id, 'Layak Menerima')} />
        <QuickStatusBtn label="Survei" status="Proses Survei" current={item.status_verifikasi} color="amber" onClick={() => onStatusUpdate(item.id, 'Proses Survei')} />
        <QuickStatusBtn label="Tolak" status="Tidak Layak" current={item.status_verifikasi} color="red" onClick={() => onStatusUpdate(item.id, 'Tidak Layak')} />
      </div>
    </div>
  </div>
);

type StatusColor = 'emerald' | 'amber' | 'red';

interface QuickStatusBtnProps {
  label: string;
  status: string;
  current: string;
  color: StatusColor;
  onClick: () => void;
}

const QuickStatusBtn = ({ label, status, current, color, onClick }: QuickStatusBtnProps) => {
  const isActive = current === status;
  const colors: Record<StatusColor, { active: string; inactive: string }> = {
    emerald: { active: 'bg-emerald-500 text-white shadow-lg shadow-emerald-200', inactive: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
    amber: { active: 'bg-amber-500 text-white shadow-lg shadow-amber-200', inactive: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
    red: { active: 'bg-red-500 text-white shadow-lg shadow-red-200', inactive: 'bg-red-50 text-red-700 hover:bg-red-100' },
  };
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`flex-1 text-[9px] sm:text-[10px] lg:text-xs py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-medium transition-all duration-200 ${isActive ? colors[color].active : colors[color].inactive}`}>
      {label}
    </button>
  );
};

type SummaryColor = 'emerald' | 'green' | 'amber' | 'blue';

const StatCard = ({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: SummaryColor }) => {
  const colors: Record<SummaryColor, string> = {
    emerald: 'bg-emerald-100 text-emerald-600',
    green: 'bg-green-100 text-green-600',
    amber: 'bg-amber-100 text-amber-600',
    blue: 'bg-blue-100 text-blue-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
};

const DetailCard = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <Card padding="lg">
    <h3 className="text-xs sm:text-sm font-bold text-slate-700 mb-2 sm:mb-3 flex items-center gap-2">
      <span className="text-emerald-500">{icon}</span>{title}
    </h3>
    <div className="space-y-1 sm:space-y-1.5">{children}</div>
  </Card>
);

const InfoGrid = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="bg-slate-50 rounded-lg p-1.5 sm:p-2">
    <span className="text-slate-400 block mb-0.5">{label}</span>
    <p className="font-semibold text-slate-700 truncate">{value}</p>
  </div>
);

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between items-start gap-2 py-1 sm:py-1.5 border-b border-slate-50 last:border-0">
    <span className="text-slate-400 flex-shrink-0 text-[10px] sm:text-[11px] lg:text-xs">{label}</span>
    <span className="text-slate-700 text-right font-medium break-words max-w-[60%] text-[10px] sm:text-[11px] lg:text-xs">{value}</span>
  </div>
);

// SVG Icons
const UserIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
const AcademicIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" /></svg>;
const ParentsIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
const FinanceIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
const UsersIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
const CheckIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
const ClockIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
const ChartIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>;

// ============================================================
// KOMPONEN INDIKATOR KURS - RESPONSIVE
// ============================================================
const KursIndicator = ({ rates, loading }: { rates: ExchangeRates | null; loading: boolean }) => {
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-50 rounded-xl border border-slate-200">
        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-slate-300 animate-pulse" />
        <span className="text-[10px] sm:text-xs text-slate-400">Memuat kurs...</span>
      </div>
    );
  }

  if (!rates) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-amber-50 rounded-xl border border-amber-200">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 flex-shrink-0">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span className="text-[10px] sm:text-xs text-amber-600">Kurs tidak tersedia</span>
      </div>
    );
  }

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const isUsingFallback = rates.lastUpdated && 
    (Date.now() - rates.lastUpdated.getTime()) > 1000 * 60 * 5;

  return (
    <div className={`flex items-center gap-1.5 sm:gap-3 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border ${
      isUsingFallback 
        ? 'bg-amber-50 border-amber-200' 
        : 'bg-emerald-50 border-emerald-200'
    }`}>
      <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full flex-shrink-0 ${
        isUsingFallback ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
      }`} />
      
      <div className="hidden sm:flex items-center gap-3 text-xs">
        <span className="font-medium text-slate-700">
          1 EGP = <span className="text-emerald-600 font-bold">{rates.EGP_TO_IDR.toFixed(2)}</span> IDR
        </span>
        <span className="text-slate-300">|</span>
        <span className="text-slate-500">
          1 USD = <span className="font-medium text-slate-700">{rates.USD_TO_EGP.toFixed(2)}</span> EGP
        </span>
        <span className="text-slate-300">|</span>
        <span className="text-slate-500">
          1 IDR = <span className="font-medium text-slate-700">{rates.IDR_TO_EGP.toFixed(4)}</span> EGP
        </span>
      </div>
      
      <div className="flex sm:hidden items-center gap-1.5 text-[10px]">
        <span className="font-medium text-slate-700 whitespace-nowrap">
          1 EGP = <span className="text-emerald-600 font-bold">{rates.EGP_TO_IDR.toFixed(2)}</span> IDR
        </span>
        <span className="text-slate-300">|</span>
        <span className="text-slate-500 whitespace-nowrap">
          1 USD = <span className="font-medium text-slate-700">{rates.USD_TO_EGP.toFixed(2)}</span>
        </span>
      </div>
      
      <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-slate-400 flex-shrink-0">
        <svg className="w-2 h-2 sm:w-2.5 sm:h-2.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span>{formatTime(rates.lastUpdated)}</span>
      </div>
    </div>
  );
};

// 🔥 FIXED: DistribusiKeteranganCard
const DistribusiKeteranganCard = ({ 
  item, 
  isLayak, 
  dForm, 
  scoring, 
  updateField,
  onSave 
}: { 
  item: Mustahiq; 
  isLayak: boolean; 
  dForm: DistribusiDraft; 
  scoring: ScoreResult; 
  updateField: (field: keyof DistribusiDraft, value: string) => void; 
  onSave: () => void; 
}) => (
  <Card padding="lg">
    <h3 className="text-sm sm:text-base font-bold text-slate-700 mb-3 sm:mb-4 flex items-center gap-2">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500">
        <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
      Distribusi & Keterangan
    </h3>
    
    <div className="space-y-4">
      {isLayak && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-emerald-50/50 p-3 sm:p-4 rounded-xl border border-emerald-200">
          <div>
            <label className="block text-[11px] sm:text-xs font-medium text-slate-600 mb-1.5">Nominal Diterima</label>
            <div className="flex gap-1.5 sm:gap-2">
              <input type="number" value={dForm.nominal}
                onChange={(e) => updateField('nominal', e.target.value)}
                placeholder="0" className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
              <select value={dForm.mata_uang}
                onChange={(e) => updateField('mata_uang', e.target.value)}
                className="bg-white border border-slate-200 rounded-lg sm:rounded-xl px-1.5 sm:px-2 py-1.5 sm:py-2 text-[11px] sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                {MATA_UANG_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-[11px] sm:text-xs font-medium text-slate-600 mb-1.5">Asnaf</label>
            <select value={dForm.asnaf}
              onChange={(e) => updateField('asnaf', e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
              <option value="">Pilih Asnaf</option>
              {ASNAF_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            {scoring.asnafRecommendation && (
              <p className="text-[10px] sm:text-[11px] text-amber-600 mt-1">Rekomendasi: {scoring.asnafRecommendation}</p>
            )}
          </div>
        </div>
      )}
      
      <div>
        <label className="block text-[11px] sm:text-xs font-medium text-slate-600 mb-1.5">Tanggal Distribusi</label>
        <input type="date" value={dForm.tanggal}
          onChange={(e) => updateField('tanggal', e.target.value)}
          className="w-full sm:w-auto bg-white border border-slate-200 rounded-lg sm:rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
      </div>
      
      <div>
        <label className="block text-[11px] sm:text-xs font-medium text-slate-600 mb-1.5">Keterangan</label>
        <textarea value={dForm.keterangan}
          onChange={(e) => updateField('keterangan', e.target.value)}
          placeholder="Tambahkan keterangan..." rows={2}
          className="w-full bg-white border border-slate-200 rounded-lg sm:rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none" />
      </div>
      
      <div className="flex justify-end pt-2">
        <button
          onClick={onSave}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300 transition-all duration-200 active:scale-95"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Simpan Semua
        </button>
      </div>
    </div>
  </Card>
);