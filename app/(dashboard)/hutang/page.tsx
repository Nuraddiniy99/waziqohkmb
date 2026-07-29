"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Penghutang, Hutang, Cicilan } from '@/types';
import { SearchBar } from '@/components/ui/SearchBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { PenghutangForm } from '@/components/forms/PenghutangForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { 
  formatCurrency, 
  formatDate, 
  calculatePercentage, 
  getDaysUntil,
  isOverdue,
  isNearDue,
  generateIdHutang,
  generateIdCicilan,
  getNow,
  getToday
} from '@/lib/utils/formatters';
import { MATA_UANG_OPTIONS, JENIS_AKAD_OPTIONS, METODE_BAYAR_OPTIONS } from '@/lib/utils/constants';
import { generateSuratPerjanjian, generateInvoiceCicilan } from '@/lib/utils/pdf-generator';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { DEFAULT_SYSTEM_CONFIG } from '@/lib/utils/constants';
import toast from 'react-hot-toast';
import type { Database } from '@/lib/supabase/types';

type ViewLevel = 'list' | 'detail' | 'akad';

export default function HutangPage() {
  const [level, setLevel] = useState<ViewLevel>('list');
  const [penghutangList, setPenghutangList] = useState<Penghutang[]>([]);
  const [selectedPenghutang, setSelectedPenghutang] = useState<Penghutang | null>(null);
  const [selectedHutang, setSelectedHutang] = useState<Hutang | null>(null);
  const [hutangList, setHutangList] = useState<Hutang[]>([]);
  const [allHutangList, setAllHutangList] = useState<Hutang[]>([]);
  const [cicilanListForDetail, setCicilanListForDetail] = useState<Cicilan[]>([]);
  const [cicilanListForAkad, setCicilanListForAkad] = useState<Cicilan[]>([]);
  const [allCicilanMap, setAllCicilanMap] = useState<Record<string, Cicilan[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showPenghutangForm, setShowPenghutangForm] = useState(false);
  const [showHutangForm, setShowHutangForm] = useState(false);
  const [showCicilanForm, setShowCicilanForm] = useState(false);
  const [editPenghutang, setEditPenghutang] = useState<Penghutang | null>(null);
  const [config] = useLocalStorage('waziqoh_config', DEFAULT_SYSTEM_CONFIG);
  const [editingHutang, setEditingHutang] = useState<Hutang | null>(null);
  const [editingCicilan, setEditingCicilan] = useState<Cicilan | null>(null);
  const [showEditHutangForm, setShowEditHutangForm] = useState(false);
  const [showEditCicilanForm, setShowEditCicilanForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [cicilanModalContext, setCicilanModalContext] = useState<'detail' | 'akad'>('detail');

  // Form states
  const [hutangForm, setHutangForm] = useState({
    rincian: '',
    jenis_akad: 'Qardh Hasan',
    tanggal_jatuh_tempo: '',
    nominal_pokok: '',
    nominal_wajib: '',
    mata_uang: 'EGP',
  });
  const [cicilanForm, setCicilanForm] = useState({
    id_hutang: '',
    nominal: '',
    mata_uang: 'EGP',
    metode_bayar: 'Tunai',
    catatan: '',
  });

  // ============================================================
  // INITIAL LOAD & REFRESH
  // ============================================================
  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: penghutangResult, error: pError } = await supabase
        .from('penghutang')
        .select('*')
        .order('registered_date', { ascending: false });
      if (pError) throw pError;
      setPenghutangList((penghutangResult as Penghutang[]) || []);

      const { data: hutangResult, error: hError } = await supabase
        .from('hutang')
        .select('*')
        .order('created_date', { ascending: false });
      if (hError) throw hError;
      setAllHutangList((hutangResult as Hutang[]) || []);

      const { data: cicilanResult, error: cError } = await supabase
        .from('cicilan')
        .select('*');
      if (cError) throw cError;

      const cicilanData = (cicilanResult as Cicilan[]) || [];
      const map: Record<string, Cicilan[]> = {};
      cicilanData.forEach((c: Cicilan) => {
        if (!map[c.id_penghutang]) map[c.id_penghutang] = [];
        map[c.id_penghutang].push(c);
      });
      setAllCicilanMap(map);
      setCicilanListForDetail(cicilanData);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchHutangByPenghutang = useCallback(async (idPenghutang: string) => {
    try {
      const { data: hutangResult, error } = await supabase
        .from('hutang')
        .select('*')
        .eq('id_penghutang', idPenghutang)
        .order('created_date', { ascending: false });
      if (error) throw error;
      
      const hutangData = (hutangResult as Hutang[]) || [];
      setHutangList(hutangData);
      
      setAllHutangList(prev => {
        const otherHutang = prev.filter(h => h.id_penghutang !== idPenghutang);
        return [...otherHutang, ...hutangData];
      });
      
      if (hutangData.length > 0) {
        const hutangIds = hutangData.map(h => h.id_hutang);
        const { data: cicilanResult, error: cicilanError } = await supabase
          .from('cicilan')
          .select('*')
          .in('id_hutang', hutangIds);
        if (!cicilanError) {
          setCicilanListForDetail((cicilanResult as Cicilan[]) || []);
        }
      } else {
        setCicilanListForDetail([]);
      }
    } catch {
      toast.error('Gagal memuat data hutang');
    }
  }, []);

  const fetchCicilanByHutang = useCallback(async (idHutang: string) => {
    try {
      const { data: cicilanResult, error } = await supabase
        .from('cicilan')
        .select('*')
        .eq('id_hutang', idHutang)
        .order('tanggal_bayar', { ascending: false });
      if (error) throw error;
      setCicilanListForAkad((cicilanResult as Cicilan[]) || []);
    } catch {
      toast.error('Gagal memuat data cicilan');
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    if (selectedPenghutang) {
      fetchHutangByPenghutang(selectedPenghutang.id_penghutang);
    }
  }, [selectedPenghutang, refreshKey, fetchHutangByPenghutang]);

  const refreshAllData = useCallback(async () => {
    await fetchAllData();
    if (selectedPenghutang) {
      await fetchHutangByPenghutang(selectedPenghutang.id_penghutang);
    }
    if (selectedHutang && level === 'akad') {
      await fetchCicilanByHutang(selectedHutang.id_hutang);
    }
    setRefreshKey(prev => prev + 1);
  }, [fetchAllData, fetchHutangByPenghutang, fetchCicilanByHutang, selectedPenghutang, selectedHutang, level]);

  // ============================================================
  // HELPERS - PERHITUNGAN PROGRESS YANG AKURAT
  // ============================================================
  const getPaidAmountForHutang = useCallback((idHutang: string, cicilanSource: Cicilan[]): number => {
    return cicilanSource
      .filter(c => c.id_hutang === idHutang)
      .reduce((s, c) => s + (c.nominal_bayar || 0), 0);
  }, []);

  const getTotalPaidForHutangFromDetail = useCallback((idHutang: string): number => {
    return getPaidAmountForHutang(idHutang, cicilanListForDetail);
  }, [cicilanListForDetail, getPaidAmountForHutang]);

  const getTotalPaidForHutangFromAkad = useCallback((idHutang: string): number => {
    return getPaidAmountForHutang(idHutang, cicilanListForAkad);
  }, [cicilanListForAkad, getPaidAmountForHutang]);

  const calculateHutangProgress = useCallback((hutang: Hutang, cicilanSource: Cicilan[]): number => {
    if (!hutang || hutang.nominal_total <= 0) return 0;
    const totalPaid = getPaidAmountForHutang(hutang.id_hutang, cicilanSource);
    return calculatePercentage(totalPaid, hutang.nominal_total);
  }, [getPaidAmountForHutang]);

  const getTotalHutangByCurrency = useCallback((idPenghutang: string, hutangSource: Hutang[]): Record<string, number> => {
    const hutangs = hutangSource.filter(h => h.id_penghutang === idPenghutang);
    const result: Record<string, number> = {};
    hutangs.forEach(h => {
      if (h.status_hutang === 'Belum Lunas') {
        result[h.mata_uang] = (result[h.mata_uang] || 0) + h.nominal_total;
      }
    });
    return result;
  }, []);

  const getProgressForPenghutang = useCallback((idPenghutang: string): number => {
    const hutangs = allHutangList.filter((hutang) => hutang.id_penghutang === idPenghutang);
    if (hutangs.length === 0) return 0;

    // Jangan menjumlahkan nominal lintas mata uang. Gunakan rata-rata progres per akad.
    const progressTotal = hutangs.reduce((total, hutang) => {
      const paid = (allCicilanMap[idPenghutang] || [])
        .filter((cicilan) => cicilan.id_hutang === hutang.id_hutang && cicilan.mata_uang === hutang.mata_uang)
        .reduce((sum, cicilan) => sum + (cicilan.nominal_bayar || 0), 0);
      return total + calculatePercentage(paid, hutang.nominal_total);
    }, 0);

    return Math.round(progressTotal / hutangs.length);
  }, [allHutangList, allCicilanMap]);

  // ============================================================
  // NAVIGATION
  // ============================================================
  const handlePenghutangClick = useCallback(async (p: Penghutang) => {
    setSelectedPenghutang(p);
    setSelectedHutang(null);
    await fetchHutangByPenghutang(p.id_penghutang);
    setLevel('detail');
  }, [fetchHutangByPenghutang]);

  const handleHutangClick = useCallback(async (h: Hutang) => {
    setSelectedHutang(h);
    await fetchCicilanByHutang(h.id_hutang);
    setLevel('akad');
  }, [fetchCicilanByHutang]);

  // ============================================================
  // UPDATE STATUS HUTANG
  // ============================================================
  const updateHutangStatus = useCallback(async (idHutang: string) => {
    try {
      const { data: cicilanData } = await supabase
        .from('cicilan')
        .select('nominal_bayar')
        .eq('id_hutang', idHutang);
      
      const cicilanList = (cicilanData as { nominal_bayar: number }[]) || [];
      const totalPaid = cicilanList.reduce((s, c) => s + (c.nominal_bayar || 0), 0);
      
      const { data: hutangResult } = await supabase
        .from('hutang')
        .select('nominal_total')
        .eq('id_hutang', idHutang)
        .single();
      
      if (!hutangResult) return;

      const hutang = hutangResult as { nominal_total: number };
      const newStatus = totalPaid >= hutang.nominal_total ? 'Lunas' : 'Belum Lunas';
      
      const { error: updateError } = await supabase
        .from('hutang')
        .update({ status_hutang: newStatus })
        .eq('id_hutang', idHutang);
      
      if (updateError) {
        console.error('Error updating hutang status:', updateError);
        return;
      }
      
      // Update local state immediately
      setHutangList(prev => prev.map(h => 
        h.id_hutang === idHutang ? { ...h, status_hutang: newStatus } : h
      ));
      setAllHutangList(prev => prev.map(h => 
        h.id_hutang === idHutang ? { ...h, status_hutang: newStatus } : h
      ));
      
    } catch (error) {
      console.error('Error updating hutang status:', error);
    }
  }, []);

  // ============================================================
  // DELETE FUNCTIONS
  // ============================================================
  const handleDeletePenghutang = useCallback(async (penghutang: Penghutang) => {
    if (!confirm(`Hapus penghutang "${penghutang.nama_lengkap}" beserta semua data hutangnya?`)) return;
    setIsActionLoading(true);
    try {
      await supabase.from('cicilan').delete().eq('id_penghutang', penghutang.id_penghutang);
      await supabase.from('hutang').delete().eq('id_penghutang', penghutang.id_penghutang);
      const { error } = await supabase.from('penghutang').delete().eq('id', penghutang.id);
      if (error) throw error;
      toast.success('Penghutang berhasil dihapus');
      setLevel('list');
      setSelectedPenghutang(null);
      setSelectedHutang(null);
      await fetchAllData();
    } catch (error) {
      console.error('Delete penghutang error:', error);
      toast.error('Gagal menghapus penghutang');
    } finally {
      setIsActionLoading(false);
    }
  }, [fetchAllData]);

  const handleDeleteHutang = useCallback(async (hutang: Hutang) => {
    if (!confirm(`Hapus akad hutang "${hutang.rincian_hutang}" beserta semua cicilannya?`)) return;
    setIsActionLoading(true);
    try {
      await supabase.from('cicilan').delete().eq('id_hutang', hutang.id_hutang);
      const { error } = await supabase.from('hutang').delete().eq('id', hutang.id);
      if (error) throw error;
      toast.success('Akad hutang berhasil dihapus');
      setSelectedHutang(null);
      setLevel('detail');
      if (selectedPenghutang) {
        await fetchHutangByPenghutang(selectedPenghutang.id_penghutang);
      }
      await fetchAllData();
    } catch (error) {
      console.error('Delete hutang error:', error);
      toast.error('Gagal menghapus akad hutang');
    } finally {
      setIsActionLoading(false);
    }
  }, [selectedPenghutang, fetchHutangByPenghutang, fetchAllData]);

  const handleDeleteCicilan = useCallback(async (cicilan: Cicilan) => {
    if (!confirm(`Hapus riwayat pembayaran ini?`)) return;
    setIsActionLoading(true);
    try {
      const { error } = await supabase.from('cicilan').delete().eq('id', cicilan.id);
      if (error) throw error;
      toast.success('Riwayat pembayaran dihapus');
      
      // Refresh data
      await fetchAllData();
      if (selectedPenghutang) {
        await fetchHutangByPenghutang(selectedPenghutang.id_penghutang);
      }
      await fetchCicilanByHutang(cicilan.id_hutang);
      await updateHutangStatus(cicilan.id_hutang);
    } catch (error) {
      console.error('Delete cicilan error:', error);
      toast.error('Gagal menghapus riwayat pembayaran');
    } finally {
      setIsActionLoading(false);
    }
  }, [fetchAllData, fetchHutangByPenghutang, fetchCicilanByHutang, updateHutangStatus, selectedPenghutang]);

  // ============================================================
  // EDIT FUNCTIONS
  // ============================================================
  const handleEditPenghutang = useCallback((p: Penghutang) => {
    setEditPenghutang(p);
    setShowPenghutangForm(true);
  }, []);

  const handleEditHutang = useCallback((h: Hutang) => {
    setEditingHutang(h);
    setHutangForm({
      rincian: h.rincian_hutang,
      jenis_akad: h.jenis_akad,
      tanggal_jatuh_tempo: h.tanggal_jatuh_tempo,
      nominal_pokok: h.nominal_pokok?.toString() || '',
      nominal_wajib: h.nominal_total.toString(),
      mata_uang: h.mata_uang,
    });
    setShowEditHutangForm(true);
  }, []);

  const handleEditCicilan = useCallback((c: Cicilan) => {
    setEditingCicilan(c);
    setCicilanForm({
      id_hutang: c.id_hutang,
      nominal: c.nominal_bayar.toString(),
      mata_uang: c.mata_uang,
      metode_bayar: c.metode_bayar,
      catatan: c.catatan || '',
    });
    setShowEditCicilanForm(true);
  }, []);

  // ============================================================
  // OPEN CICILAN MODAL HELPER
  // ============================================================
  const openCicilanModal = useCallback((context: 'detail' | 'akad', hutangId?: string, mataUang?: string) => {
    setCicilanForm({
      id_hutang: hutangId || '',
      nominal: '',
      mata_uang: mataUang || 'EGP',
      metode_bayar: 'Tunai',
      catatan: '',
    });
    setCicilanModalContext(context);
    setShowCicilanForm(true);
  }, []);

  // ============================================================
  // SAVE FUNCTIONS
  // ============================================================
  const handleSaveHutang = useCallback(async (e: React.FormEvent, isEdit: boolean = false) => {
    e.preventDefault();
    if (!selectedPenghutang) return;

    const nominalPokok = parseFloat(hutangForm.nominal_pokok) || 0;
    const nominalWajib = parseFloat(hutangForm.nominal_wajib) || 0;

    if (nominalPokok <= 0 || nominalWajib <= 0) {
      toast.error('Nominal pokok dan nominal wajib harus lebih dari 0');
      return;
    }

    if (nominalWajib < nominalPokok) {
      toast.error('Nominal wajib tidak boleh kurang dari nominal pokok');
      return;
    }

    setIsActionLoading(true);
    try {
      if (isEdit && editingHutang) {
        const updateData: Database['public']['Tables']['hutang']['Update'] = {
            rincian_hutang: hutangForm.rincian,
            jenis_akad: hutangForm.jenis_akad,
            tanggal_jatuh_tempo: hutangForm.tanggal_jatuh_tempo,
            nominal_pokok: nominalPokok,
            nominal_total: nominalWajib,
            mata_uang: hutangForm.mata_uang,
          };

        const { error } = await supabase
          .from('hutang')
          .update(updateData)
          .eq('id', editingHutang.id);

        if (error) throw error;
        toast.success('Akad hutang berhasil diperbarui');
        setShowEditHutangForm(false);
        setEditingHutang(null);
        
        await updateHutangStatus(editingHutang.id_hutang);
        
      } else {
        const { data: existing } = await supabase
          .from('hutang')
          .select('id_hutang')
          .order('created_date', { ascending: false })
          .limit(1);

        let sequence = 1;
        const existingData = existing as { id_hutang: string }[] | null;
        if (existingData && existingData.length > 0) {
          const lastNum = parseInt(existingData[0].id_hutang.split('/').pop() || '0');
          sequence = lastNum + 1;
        }

        const insertData: Database['public']['Tables']['hutang']['Insert'] = {
          id_hutang: generateIdHutang(sequence),
          id_penghutang: selectedPenghutang.id_penghutang,
          rincian_hutang: hutangForm.rincian,
          jenis_akad: hutangForm.jenis_akad,
          tanggal_jatuh_tempo: hutangForm.tanggal_jatuh_tempo,
          nominal_pokok: nominalPokok,
          nominal_total: nominalWajib,
          mata_uang: hutangForm.mata_uang,
          status_hutang: 'Belum Lunas',
          created_date: getNow(),
        };

        const { error } = await supabase.from('hutang').insert(insertData);

        if (error) throw error;
        toast.success('Akad hutang berhasil dibuat');
        setShowHutangForm(false);
      }

      setHutangForm({ 
        rincian: '', 
        jenis_akad: 'Qardh Hasan', 
        tanggal_jatuh_tempo: '', 
        nominal_pokok: '',
        nominal_wajib: '', 
        mata_uang: 'EGP' 
      });
      
      await refreshAllData();
    } catch (error) {
      console.error('Save hutang error:', error);
      toast.error(isEdit ? 'Gagal memperbarui akad hutang' : 'Gagal membuat akad hutang');
    } finally {
      setIsActionLoading(false);
    }
  }, [selectedPenghutang, hutangForm, editingHutang, updateHutangStatus, refreshAllData]);

  const handleSaveCicilan = useCallback(async (e: React.FormEvent, isEdit: boolean = false) => {
    e.preventDefault();
    
    const targetHutang = allHutangList.find(h => h.id_hutang === cicilanForm.id_hutang);
    if (!targetHutang) {
      toast.error('Data hutang tidak ditemukan');
      return;
    }

    if (cicilanForm.mata_uang !== targetHutang.mata_uang) {
      toast.error(`Mata uang cicilan harus ${targetHutang.mata_uang}`);
      return;
    }

    try {
      const nominalBayar = parseFloat(cicilanForm.nominal) || 0;
      if (nominalBayar <= 0) {
        toast.error('Nominal bayar harus lebih dari 0');
        return;
      }

      const currentPaid = getPaidAmountForHutang(cicilanForm.id_hutang, cicilanListForDetail);
      
      if (isEdit && editingCicilan) {
        const totalAfterEdit = currentPaid - (editingCicilan.nominal_bayar || 0) + nominalBayar;
        if (totalAfterEdit > targetHutang.nominal_total) {
          toast.error(`Total pembayaran tidak boleh melebihi total hutang (${formatCurrency(targetHutang.nominal_total, targetHutang.mata_uang)})`);
          return;
        }
      } else {
        const sisa = targetHutang.nominal_total - currentPaid;
        if (nominalBayar > sisa) {
          toast.error(`Nominal bayar tidak boleh melebihi sisa hutang (${formatCurrency(sisa, targetHutang.mata_uang)})`);
          return;
        }
      }

      setIsActionLoading(true);

      const penghutangId = selectedPenghutang?.id_penghutang || targetHutang.id_penghutang;

      if (isEdit && editingCicilan) {
        const updateData: Database['public']['Tables']['cicilan']['Update'] = {
          nominal_bayar: nominalBayar,
          mata_uang: cicilanForm.mata_uang,
          metode_bayar: cicilanForm.metode_bayar,
          catatan: cicilanForm.catatan,
        };

        const { error } = await supabase
          .from('cicilan')
          .update(updateData)
          .eq('id', editingCicilan.id);

        if (error) throw error;
        toast.success('Riwayat pembayaran diperbarui');
        setShowEditCicilanForm(false);
        setEditingCicilan(null);
      } else {
        const { data: existing } = await supabase
          .from('cicilan')
          .select('id_cicilan')
          .order('created_date', { ascending: false })
          .limit(1);

        let sequence = 1;
        const existingData = existing as { id_cicilan: string }[] | null;
        if (existingData && existingData.length > 0) {
          const lastNum = parseInt(existingData[0].id_cicilan.split('/').pop() || '0');
          sequence = lastNum + 1;
        }

        const insertData: Database['public']['Tables']['cicilan']['Insert'] = {
          id_cicilan: generateIdCicilan(sequence),
          id_hutang: cicilanForm.id_hutang,
          id_penghutang: penghutangId,
          tanggal_bayar: getToday(),
          nominal_bayar: nominalBayar,
          mata_uang: cicilanForm.mata_uang,
          metode_bayar: cicilanForm.metode_bayar,
          catatan: cicilanForm.catatan,
          created_date: getNow(),
        };

        const { error } = await supabase.from('cicilan').insert(insertData);

        if (error) throw error;
        toast.success('Pembayaran cicilan berhasil dicatat');
        setShowCicilanForm(false);
      }

      setCicilanForm({ id_hutang: '', nominal: '', mata_uang: 'EGP', metode_bayar: 'Tunai', catatan: '' });
      
      await fetchAllData();
      if (selectedPenghutang) {
        await fetchHutangByPenghutang(selectedPenghutang.id_penghutang);
      }
      await fetchCicilanByHutang(cicilanForm.id_hutang);
      await updateHutangStatus(cicilanForm.id_hutang);
      
    } catch (error) {
      console.error('Error saving cicilan:', error);
      toast.error(isEdit ? 'Gagal memperbarui pembayaran' : 'Gagal mencatat pembayaran');
    } finally {
      setIsActionLoading(false);
    }
  }, [cicilanForm, allHutangList, cicilanListForDetail, selectedPenghutang, editingCicilan, getPaidAmountForHutang, fetchAllData, fetchHutangByPenghutang, fetchCicilanByHutang, updateHutangStatus]);

  // ============================================================
  // PDF GENERATORS
  // ============================================================
  const handleSuratPerjanjian = useCallback(() => {
    if (selectedHutang && selectedPenghutang) {
      generateSuratPerjanjian(selectedHutang, selectedPenghutang, cicilanListForAkad, config);
    }
  }, [selectedHutang, selectedPenghutang, cicilanListForAkad, config]);

  const handleInvoiceCicilan = useCallback((cicilan: Cicilan) => {
    if (selectedHutang && selectedPenghutang) {
      const sortedCicilan = [...cicilanListForAkad].sort((a, b) => 
        new Date(a.tanggal_bayar).getTime() - new Date(b.tanggal_bayar).getTime()
      );
      
      let sisaSebelum = selectedHutang.nominal_total;
      for (const c of sortedCicilan) {
        if (c.id === cicilan.id) break;
        sisaSebelum -= (c.nominal_bayar || 0);
      }
      
      const sisaSetelah = sisaSebelum - (cicilan.nominal_bayar || 0);
      generateInvoiceCicilan(cicilan, selectedHutang, selectedPenghutang, sisaSebelum, sisaSetelah, config);
    }
  }, [selectedHutang, selectedPenghutang, cicilanListForAkad, config]);

  // ============================================================
  // WHATSAPP MESSAGE GENERATOR
  // ============================================================
  const generateWAMessage = useCallback((penghutang: Penghutang): string => {
    const hutangsPenghutang = allHutangList.filter(h => h.id_penghutang === penghutang.id_penghutang);
    const activeHutangs = hutangsPenghutang.filter(h => h.status_hutang === 'Belum Lunas');
    
    if (activeHutangs.length === 0) {
      return `Assalamu'alaikum Warahmatullahi Wabarakatuh,%0A%0A` +
        `Kepada Yth. Saudara/i ${penghutang.nama_lengkap},%0A%0A` +
        `Alhamdulillah, berdasarkan data kami, seluruh kewajiban hutang Anda telah LUNAS.%0A%0A` +
        `Kami ucapkan terima kasih yang sebesar-besarnya atas kepercayaan dan tanggung jawab Anda dalam menyelesaikan amanah ini.%0A%0A` +
        `Semoga Allah SWT senantiasa memberkahi rezeki dan memudahkan segala urusan Anda.%0A%0A` +
        `Hormat kami,%0A` +
        `Tim WAZIQOH KMB Mesir`;
    }

    // Hitung total per mata uang
    const totalsPerCurrency: Record<string, { total: number; paid: number; count: number }> = {};
    
    activeHutangs.forEach(h => {
      const cicilans = allCicilanMap[penghutang.id_penghutang]?.filter(c => c.id_hutang === h.id_hutang) || [];
      const totalPaid = cicilans.reduce((s, c) => s + (c.nominal_bayar || 0), 0);
      
      if (!totalsPerCurrency[h.mata_uang]) {
        totalsPerCurrency[h.mata_uang] = { total: 0, paid: 0, count: 0 };
      }
      totalsPerCurrency[h.mata_uang].total += h.nominal_total;
      totalsPerCurrency[h.mata_uang].paid += totalPaid;
      totalsPerCurrency[h.mata_uang].count += 1;
    });

    let message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,%0A%0A`;
    message += `Kepada Yth. Saudara/i ${penghutang.nama_lengkap},%0A`;
    message += `ID Penghutang: ${penghutang.id_penghutang},%0A%0A`;
    message += `Berdasarkan data kami, berikut adalah RINCIAN KEWAJIBAN HUTANG Anda yang masih AKTIF dan BELUM LUNAS:%0A%0A`;
    message += `==========================================%0A%0A`;

    activeHutangs.forEach((h, index) => {
      const cicilans = allCicilanMap[penghutang.id_penghutang]?.filter(c => c.id_hutang === h.id_hutang) || [];
      const totalPaid = cicilans.reduce((s, c) => s + (c.nominal_bayar || 0), 0);
      const sisa = h.nominal_total - totalPaid;
      const progressPercent = h.nominal_total > 0 ? Math.round((totalPaid / h.nominal_total) * 100) : 0;
      const daysLeft = getDaysUntil(h.tanggal_jatuh_tempo);
      const isOverdueStatus = isOverdue(h.tanggal_jatuh_tempo);
      const isNearDueStatus = isNearDue(h.tanggal_jatuh_tempo);

      message += `Akad ${index + 1} - ${h.id_hutang}%0A`;
      message += `------------------------------------------%0A`;
      message += `Jenis Akad       : ${h.jenis_akad}%0A`;
      message += `Rincian          : ${h.rincian_hutang}%0A`;
      message += `Total Hutang     : ${formatCurrency(h.nominal_total, h.mata_uang)}%0A`;
      message += `Telah Dibayar    : ${formatCurrency(totalPaid, h.mata_uang)} (${progressPercent}%%)%0A`;
      message += `Sisa Kewajiban   : ${formatCurrency(sisa, h.mata_uang)}%0A`;
      message += `Jatuh Tempo      : ${formatDate(h.tanggal_jatuh_tempo)}%0A`;
      
      if (isOverdueStatus) {
        message += `Status           : *TERLAMBAT ${Math.abs(daysLeft)} HARI*%0A`;
      } else if (isNearDueStatus) {
        message += `Status           : Jatuh tempo dalam ${daysLeft} hari%0A`;
      } else {
        message += `Status           : Berjalan normal%0A`;
      }
      
      // Riwayat pembayaran terakhir (maks 3)
      if (cicilans.length > 0) {
        message += `%0APembayaran Terakhir:%0A`;
        cicilans.slice(0, 3).forEach((c, i) => {
          message += `  ${i + 1}. ${formatDate(c.tanggal_bayar)} - ${formatCurrency(c.nominal_bayar, c.mata_uang)} (${c.metode_bayar})%0A`;
        });
      }
      
      message += `%0A`;
    });

    message += `==========================================%0A%0A`;
    message += `RINGKASAN TOTAL:%0A%0A`;

    Object.entries(totalsPerCurrency).forEach(([curr, data]) => {
      const totalSisa = data.total - data.paid;
      const totalProgress = data.total > 0 ? Math.round((data.paid / data.total) * 100) : 0;
      message += `Mata Uang ${curr}:%0A`;
      message += `  - Total Hutang     : ${formatCurrency(data.total, curr)}%0A`;
      message += `  - Total Dibayar    : ${formatCurrency(data.paid, curr)} (${totalProgress}%%)%0A`;
      message += `  - Total Sisa       : ${formatCurrency(totalSisa, curr)}%0A`;
      message += `  - Jumlah Akad      : ${data.count} akad%0A%0A`;
    });

    message += `==========================================%0A%0A`;
    message += `Kami menghimbau kepada Saudara/i untuk dapat segera menyelesaikan kewajiban hutang tersebut sesuai dengan kesepakatan yang telah disepakati bersama.%0A%0A`;
    message += `Pembayaran dapat dilakukan melalui:%0A`;
    message += `1. Transfer bank ke rekening yang telah ditentukan%0A`;
    message += `2. Pembayaran tunai langsung kepada petugas kami%0A%0A`;
    message += `Untuk informasi lebih lanjut atau kendala dalam pembayaran, silakan menghubungi kami melalui nomor ini.%0A%0A`;
    message += `Demikian pemberitahuan ini kami sampaikan. Atas perhatian dan kerjasamanya, kami ucapkan terima kasih.%0A%0A`;
    message += `Jazakumullah Khairan Katsiran,%0A%0A`;
    message += `Hormat kami,%0A`;
    message += `Tim WAZIQOH KMB Mesir`;

    return message;
  }, [allHutangList, allCicilanMap]);

  // ============================================================
  // FILTERED LIST
  // ============================================================
  const filteredPenghutang = penghutangList.filter(p =>
    p.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.id_penghutang.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Dapatkan daftar hutang yang tersedia untuk dropdown cicilan
  const getAvailableHutangForCicilan = useCallback(() => {
    if (cicilanModalContext === 'akad' && selectedHutang) {
      return [selectedHutang];
    }
    return hutangList.filter(h => h.status_hutang === 'Belum Lunas');
  }, [cicilanModalContext, selectedHutang, hutangList]);

  // ============================================================
  // LOADING STATE
  // ============================================================
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // ============================================================
  // ACTION LOADING OVERLAY
  // ============================================================
  const actionOverlay = isActionLoading ? (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9999] flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  ) : null;

  // ============================================================
// LEVEL 1: LIST PENGHUTANG
// ============================================================
if (level === 'list') {
  return (
    <>
      {actionOverlay}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-emerald-dark">Hutang Piutang</h1>
            <p className="text-sm text-slate-500 mt-1">Manajemen akad & cicilan hutang</p>
          </div>
          <Button onClick={() => { setEditPenghutang(null); setShowPenghutangForm(true); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Daftar Penghutang
          </Button>
        </div>

        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Cari nama atau ID penghutang..." />

        {filteredPenghutang.length === 0 ? (
          <EmptyState
            title="Belum ada penghutang"
            description="Daftarkan penghutang baru untuk memulai"
            action={<Button onClick={() => { setEditPenghutang(null); setShowPenghutangForm(true); }}>Daftar Penghutang</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPenghutang.map((p) => {
              const progress = getProgressForPenghutang(p.id_penghutang);
              const totalHutang = getTotalHutangByCurrency(p.id_penghutang, allHutangList);
              const isLunas = progress >= 100;

              return (
                <Card 
                  key={p.id} 
                  hover 
                  onClick={() => handlePenghutangClick(p)} 
                  className={`cursor-pointer transition-all duration-300 ${isLunas ? 'opacity-60 hover:opacity-80' : ''}`}
                >
                  {/* Mobile Layout — Updated with Currency Pills */}
                  <div className="lg:hidden flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-brand/10 flex items-center justify-center flex-shrink-0">
                      {p.foto_ttd_url ? (
                        <img src={p.foto_ttd_url} alt="" className="w-10 h-10 object-contain rounded" />
                      ) : (
                        <span className="text-lg font-bold text-emerald-brand">{p.nama_lengkap.charAt(0)}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className={`font-semibold truncate ${isLunas ? 'text-slate-400' : 'text-emerald-dark'}`}>
                            {p.nama_lengkap}
                          </h3>
                          <p className="text-xs text-slate-500">{p.id_penghutang}</p>
                        </div>
                        <a
                          href={`https://wa.me/${p.no_wa_pribadi.replace(/\+/g, '')}?text=${generateWAMessage(p)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2.5 rounded-xl text-green-600 hover:bg-green-50 active:bg-green-100 transition-colors flex-shrink-0"
                          title="Kirim tagihan via WhatsApp"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        </a>
                      </div>

                      {/* Currency Pills — Same elegant style as desktop */}
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {Object.entries(totalHutang).length === 0 ? (
                          <span className="text-[11px] text-slate-400 italic">Belum ada akad</span>
                        ) : (
                          Object.entries(totalHutang).map(([curr, amount]) => (
                            <span 
                              key={curr} 
                              className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold tracking-wide border shadow-sm
                                ${isLunas 
                                  ? 'bg-slate-50 text-slate-400 border-slate-200' 
                                  : 'bg-white text-slate-700 border-slate-300 shadow-slate-100'
                                }`}
                            >
                              {formatCurrency(amount, curr)}
                            </span>
                          ))
                        )}
                      </div>

                      <div className="mt-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-slate-400">Progress</span>
                          <span className="text-[10px] font-bold text-slate-700">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${isLunas ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between">
                        <Badge variant={isLunas ? 'success' : 'warning'} size="sm">
                          {isLunas ? 'LUNAS' : 'Belum Lunas'}
                        </Badge>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {allHutangList.filter(h => h.id_penghutang === p.id_penghutang).length} akad
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* DESKTOP Layout — Fully Redesigned for Professional & Aesthetic Look */}
                  <div className="hidden lg:flex lg:flex-col gap-5">
                    {/* Top Section: Avatar + Identity + WhatsApp */}
                    <div className="flex items-start gap-4">
                      {/* Avatar with subtle shadow and gradient ring */}
                      <div className="relative flex-shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-emerald-600/20 rounded-2xl blur-sm"></div>
                        <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 shadow-sm flex items-center justify-center overflow-hidden">
                          {p.foto_ttd_url ? (
                            <img src={p.foto_ttd_url} alt="" className="w-9 h-9 object-contain rounded-lg" />
                          ) : (
                            <span className="text-xl font-bold bg-gradient-to-br from-emerald-600 to-emerald-800 bg-clip-text text-transparent">
                              {p.nama_lengkap.charAt(0)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Identity Info */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <h3 className={`text-base font-bold leading-tight truncate transition-colors ${isLunas ? 'text-slate-400' : 'text-slate-800'}`}>
                          {p.nama_lengkap}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5 font-mono tracking-wide">{p.id_penghutang}</p>
                      </div>

                      {/* WhatsApp Button - Elevated and Stylish */}
                      <a
                        href={`https://wa.me/${p.no_wa_pribadi.replace(/\+/g, '')}?text=${generateWAMessage(p)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-50 hover:bg-green-100 active:bg-green-200 text-green-700 transition-all duration-200 border border-green-100 hover:border-green-200 shadow-sm hover:shadow-md"
                        title="Kirim tagihan via WhatsApp"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        <span className="text-[11px] font-semibold hidden xl:inline">WhatsApp</span>
                      </a>
                    </div>

                    {/* Currency Tags - Clean Pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(totalHutang).length === 0 ? (
                        <span className="text-xs text-slate-400 italic">Belum ada akad</span>
                      ) : (
                        Object.entries(totalHutang).map(([curr, amount]) => (
                          <span 
                            key={curr} 
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold tracking-wide border shadow-sm
                              ${isLunas 
                                ? 'bg-slate-50 text-slate-400 border-slate-200' 
                                : 'bg-white text-slate-700 border-slate-300 shadow-slate-100'
                              }`}
                          >
                            {formatCurrency(amount, curr)}
                          </span>
                        ))
                      )}
                    </div>

                    {/* Progress Bar - Enhanced Visual */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-medium text-slate-500">Progress Pembayaran</span>
                        <span className="text-[11px] font-bold text-slate-700">{Math.round(progress)}%</span>
                      </div>
                      <div className="relative w-full h-2.5 bg-slate-200/70 rounded-full overflow-hidden shadow-inner">
                        <div 
                          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out
                            ${isLunas 
                              ? 'bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-sm shadow-emerald-200' 
                              : 'bg-gradient-to-r from-amber-400 to-amber-500 shadow-sm shadow-amber-200'
                            }`}
                          style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                        />
                        {/* Subtle shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full"></div>
                      </div>
                    </div>

                    {/* Bottom Row: Status Badge + Total Akad Count */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <Badge variant={isLunas ? 'success' : 'warning'} size="sm">
                          {isLunas ? 'LUNAS' : 'Belum Lunas'}
                        </Badge>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {allHutangList.filter(h => h.id_penghutang === p.id_penghutang).length} akad
                        </span>
                      </div>
                      {/* Subtle chevron indicating clickability */}
                      <svg 
                        width="14" 
                        height="14" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2.5" 
                        className="text-slate-300 group-hover:text-slate-500 transition-colors"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <PenghutangForm
          editData={editPenghutang}
          isOpen={showPenghutangForm}
          onClose={() => { setShowPenghutangForm(false); setEditPenghutang(null); }}
          onSuccess={() => { fetchAllData(); }}
        />
      </div>
    </>
  );
}

  // ============================================================
  // LEVEL 2: DETAIL PENGHUTANG
  // ============================================================
  if (level === 'detail' && selectedPenghutang) {
    const availableHutang = getAvailableHutangForCicilan();

    return (
      <>
        {actionOverlay}
        <div className="space-y-6">
          {/* Header — Mobile: stack vertikal, Desktop: horizontal sejajar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => { setLevel('list'); setSelectedPenghutang(null); }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
              </button>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-emerald-dark truncate">{selectedPenghutang.nama_lengkap}</h1>
                <p className="text-sm text-slate-500">{selectedPenghutang.id_penghutang}</p>
              </div>
            </div>
            {/* Mobile: full-width buttons, Desktop: inline */}
            <div className="flex gap-2 sm:self-center">
              <Button variant="outline" size="sm" onClick={() => handleEditPenghutang(selectedPenghutang)} className="flex-1 sm:flex-none justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sm:mr-0">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <span className="sm:hidden ml-2">Edit</span>
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleDeletePenghutang(selectedPenghutang)} className="flex-1 sm:flex-none justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sm:mr-0">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span className="sm:hidden ml-2">Hapus</span>
              </Button>
            </div>
          </div>

          {/* Info Card */}
          <Card>
            {/* Mobile Layout — TIDAK DIRUBAH */}
            <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Alamat Mesir</p>
                <p className="font-medium text-emerald-dark">{selectedPenghutang.alamat_mesir}</p>
              </div>
              <div>
                <p className="text-slate-500">Alamat Indonesia</p>
                <p className="font-medium text-emerald-dark">{selectedPenghutang.alamat_indonesia}</p>
              </div>
              <div>
                <p className="text-slate-500">WA Pribadi</p>
                <p className="font-medium text-emerald-dark">{selectedPenghutang.no_wa_pribadi}</p>
              </div>
              <div>
                <p className="text-slate-500">WA Kerabat</p>
                <p className="font-medium text-emerald-dark">{selectedPenghutang.no_wa_kerabat}</p>
              </div>
              {selectedPenghutang.foto_ttd_url && (
                <div className="md:col-span-2">
                  <p className="text-slate-500 mb-2">Tanda Tangan</p>
                  <img src={selectedPenghutang.foto_ttd_url} alt="TTD" className="h-20 object-contain border rounded-lg p-2 bg-white" />
                </div>
              )}
            </div>

            {/* Desktop Layout — Profesional 2 kolom */}
            <div className="hidden lg:grid lg:grid-cols-2 lg:gap-8">
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">Alamat Mesir</p>
                  <p className="text-sm font-medium text-emerald-dark">{selectedPenghutang.alamat_mesir}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">Alamat Indonesia</p>
                  <p className="text-sm font-medium text-emerald-dark">{selectedPenghutang.alamat_indonesia}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">WA Pribadi</p>
                    <p className="text-sm font-medium text-emerald-dark">{selectedPenghutang.no_wa_pribadi}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">WA Kerabat</p>
                    <p className="text-sm font-medium text-emerald-dark">{selectedPenghutang.no_wa_kerabat}</p>
                  </div>
                </div>
                {selectedPenghutang.foto_ttd_url && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-2">Tanda Tangan</p>
                    <img src={selectedPenghutang.foto_ttd_url} alt="TTD" className="h-16 object-contain border rounded-lg p-1.5 bg-white" />
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <div className="flex gap-2 w-full sm:w-auto">
              <Button onClick={() => setShowHutangForm(true)} className="flex-1 sm:flex-none">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Tambah Akad
              </Button>
              <Button variant="outline" onClick={() => {
                const available = hutangList.filter(h => h.status_hutang === 'Belum Lunas');
                if (available.length === 0) {
                  toast.error('Tidak ada hutang yang belum lunas');
                  return;
                }
                openCicilanModal('detail');
              }} className="flex-1 sm:flex-none">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                Bayar Cicilan
              </Button>
            </div>
          </div>

          {/* Daftar Akad Hutang */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-emerald-dark">Daftar Akad Hutang</h3>
            {hutangList.length === 0 ? (
              <EmptyState title="Belum ada akad hutang" description="Tambahkan akad hutang baru" />
            ) : (
              hutangList.map((h) => {
                const progress = calculateHutangProgress(h, cicilanListForDetail);
                const daysLeft = getDaysUntil(h.tanggal_jatuh_tempo);
                const isLunas = h.status_hutang === 'Lunas' || progress >= 100;
                const totalPaid = getTotalPaidForHutangFromDetail(h.id_hutang);

                return (
                  <Card key={h.id} hover onClick={() => handleHutangClick(h)} className={`cursor-pointer ${isLunas ? 'opacity-60' : ''}`}>
                    {/* Mobile Layout — Super Mobily */}
                    <div className="lg:hidden space-y-3">
                      {/* Baris 1: Badge + Rincian */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="primary" size="sm">{h.id_hutang}</Badge>
                          <Badge variant={isLunas ? 'success' : 'warning'} size="sm">
                            {isLunas ? 'LUNAS' : 'Belum Lunas'}
                          </Badge>
                          <Badge variant="gold" size="sm">{h.jenis_akad}</Badge>
                        </div>
                        <p className={`text-sm leading-relaxed ${isLunas ? 'text-slate-400' : 'text-slate-600'}`}>
                          {h.rincian_hutang}
                        </p>
                      </div>

                      {/* Baris 2: Info Jatuh Tempo + Status */}
                      <div className="flex items-center gap-3 text-xs flex-wrap">
                        <span className="text-slate-500 flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          {formatDate(h.tanggal_jatuh_tempo)}
                        </span>
                        {isOverdue(h.tanggal_jatuh_tempo) && !isLunas && (
                          <span className="text-red-500 font-semibold bg-red-50 px-2 py-0.5 rounded-full">
                            Terlambat {Math.abs(daysLeft)} hari
                          </span>
                        )}
                        {isNearDue(h.tanggal_jatuh_tempo) && !isOverdue(h.tanggal_jatuh_tempo) && !isLunas && (
                          <span className="text-amber-500 font-semibold bg-amber-50 px-2 py-0.5 rounded-full">
                            {daysLeft} hari lagi
                          </span>
                        )}
                      </div>

                      {/* Baris 3: Nominal + Progress */}
                      <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Total</p>
                            <p className={`text-lg font-bold ${isLunas ? 'text-slate-400' : 'text-emerald-dark'}`}>
                              {formatCurrency(h.nominal_total, h.mata_uang)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Dibayar</p>
                            <p className={`text-sm font-semibold ${isLunas ? 'text-slate-400' : 'text-emerald-600'}`}>
                              {formatCurrency(totalPaid, h.mata_uang)}
                            </p>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] text-slate-400">{Math.round(progress)}%</span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-300/50 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${isLunas ? 'bg-emerald-500' : 'bg-amber-500'}`}
                              style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Baris 4: Tombol Aksi */}
                      <div className="flex gap-1.5 pt-1 border-t border-slate-100">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditHutang(h); }}
                          className="flex-1 py-2 rounded-lg hover:bg-blue-50 text-blue-600 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteHutang(h); }}
                          className="flex-1 py-2 rounded-lg hover:bg-red-50 text-red-500 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          Hapus
                        </button>
                      </div>
                    </div>

                    {/* Desktop Layout — Profesional ala Level 3 */}
                    <div className="hidden lg:flex lg:items-center lg:gap-6">
                      {/* Ikon */}
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                          </svg>
                        </div>
                      </div>

                      {/* Info Utama */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge variant="primary">{h.id_hutang}</Badge>
                          <Badge variant={isLunas ? 'success' : 'warning'}>
                            {isLunas ? 'LUNAS' : 'Belum Lunas'}
                          </Badge>
                          <Badge variant="gold">{h.jenis_akad}</Badge>
                        </div>
                        <p className={`text-sm truncate ${isLunas ? 'text-slate-400' : 'text-slate-600'}`}>{h.rincian_hutang}</p>
                      </div>

                      {/* Jatuh Tempo */}
                      <div className="flex-shrink-0 text-center w-36">
                        <p className="text-xs text-slate-400 mb-0.5">Jatuh Tempo</p>
                        <p className="text-sm font-medium text-slate-700">{formatDate(h.tanggal_jatuh_tempo)}</p>
                        {isOverdue(h.tanggal_jatuh_tempo) && !isLunas && (
                          <p className="text-xs text-red-500 font-semibold mt-0.5">Terlambat {Math.abs(daysLeft)} hari</p>
                        )}
                        {isNearDue(h.tanggal_jatuh_tempo) && !isOverdue(h.tanggal_jatuh_tempo) && !isLunas && (
                          <p className="text-xs text-amber-500 font-semibold mt-0.5">{daysLeft} hari lagi</p>
                        )}
                      </div>

                      {/* Progress */}
                      <div className="flex-shrink-0 w-28">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-slate-400">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${isLunas ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Nominal */}
                      <div className="flex-shrink-0 text-right w-40">
                        <p className={`text-lg font-bold ${isLunas ? 'text-slate-400' : 'text-emerald-dark'}`}>
                          {formatCurrency(h.nominal_total, h.mata_uang)}
                        </p>
                        <p className={`text-xs ${isLunas ? 'text-slate-400' : 'text-slate-500'}`}>
                          Dibayar: {formatCurrency(totalPaid, h.mata_uang)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex-shrink-0 flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditHutang(h); }}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                          title="Edit Akad"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteHutang(h); }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                          title="Hapus Akad"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          {/* Hutang Form Modal */}
          <Modal isOpen={showHutangForm} onClose={() => setShowHutangForm(false)} title="Tambah Akad Hutang Baru">
            <form onSubmit={(e) => handleSaveHutang(e, false)} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-emerald-dark mb-1.5">Rincian Hutang</label>
                <textarea
                  value={hutangForm.rincian}
                  onChange={(e) => setHutangForm({ ...hutangForm, rincian: e.target.value })}
                  rows={3}
                  className="w-full bg-white/70 backdrop-blur-sm border border-glass-emerald rounded-xl px-4 py-2.5 text-sm text-emerald-dark focus:outline-none focus:ring-2 focus:ring-emerald-brand/30 focus:border-emerald-brand"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Jenis Akad"
                  value={hutangForm.jenis_akad}
                  onChange={(e) => setHutangForm({ ...hutangForm, jenis_akad: e.target.value })}
                  options={JENIS_AKAD_OPTIONS.map(j => ({ value: j, label: j }))}
                />
                <Select
                  label="Mata Uang"
                  value={hutangForm.mata_uang}
                  onChange={(e) => setHutangForm({ ...hutangForm, mata_uang: e.target.value })}
                  options={MATA_UANG_OPTIONS.map(m => ({ value: m, label: m }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Nominal Pokok"
                  type="number"
                  value={hutangForm.nominal_pokok}
                  onChange={(e) => setHutangForm({ ...hutangForm, nominal_pokok: e.target.value })}
                  placeholder="0"
                  required
                />
                <Input
                  label="Nominal Wajib"
                  type="number"
                  value={hutangForm.nominal_wajib}
                  onChange={(e) => setHutangForm({ ...hutangForm, nominal_wajib: e.target.value })}
                  placeholder="0"
                  required
                />
              </div>
              <Input
                label="Tanggal Jatuh Tempo"
                type="date"
                value={hutangForm.tanggal_jatuh_tempo}
                onChange={(e) => setHutangForm({ ...hutangForm, tanggal_jatuh_tempo: e.target.value })}
                required
              />
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => setShowHutangForm(false)} className="flex-1">Batal</Button>
                <Button type="submit" className="flex-1">Simpan Akad</Button>
              </div>
            </form>
          </Modal>

          {/* Edit Hutang Form Modal */}
          <Modal isOpen={showEditHutangForm} onClose={() => { setShowEditHutangForm(false); setEditingHutang(null); }} title="Edit Akad Hutang">
            <form onSubmit={(e) => handleSaveHutang(e, true)} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-emerald-dark mb-1.5">Rincian Hutang</label>
                <textarea
                  value={hutangForm.rincian}
                  onChange={(e) => setHutangForm({ ...hutangForm, rincian: e.target.value })}
                  rows={3}
                  className="w-full bg-white/70 backdrop-blur-sm border border-glass-emerald rounded-xl px-4 py-2.5 text-sm text-emerald-dark focus:outline-none focus:ring-2 focus:ring-emerald-brand/30 focus:border-emerald-brand"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Jenis Akad"
                  value={hutangForm.jenis_akad}
                  onChange={(e) => setHutangForm({ ...hutangForm, jenis_akad: e.target.value })}
                  options={JENIS_AKAD_OPTIONS.map(j => ({ value: j, label: j }))}
                />
                <Select
                  label="Mata Uang"
                  value={hutangForm.mata_uang}
                  onChange={(e) => setHutangForm({ ...hutangForm, mata_uang: e.target.value })}
                  options={MATA_UANG_OPTIONS.map(m => ({ value: m, label: m }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Nominal Pokok"
                  type="number"
                  value={hutangForm.nominal_pokok}
                  onChange={(e) => setHutangForm({ ...hutangForm, nominal_pokok: e.target.value })}
                  placeholder="0"
                  required
                />
                <Input
                  label="Nominal Wajib"
                  type="number"
                  value={hutangForm.nominal_wajib}
                  onChange={(e) => setHutangForm({ ...hutangForm, nominal_wajib: e.target.value })}
                  placeholder="0"
                  required
                />
              </div>
              <Input
                label="Tanggal Jatuh Tempo"
                type="date"
                value={hutangForm.tanggal_jatuh_tempo}
                onChange={(e) => setHutangForm({ ...hutangForm, tanggal_jatuh_tempo: e.target.value })}
                required
              />
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => { setShowEditHutangForm(false); setEditingHutang(null); }} className="flex-1">Batal</Button>
                <Button type="submit" className="flex-1">Simpan Perubahan</Button>
              </div>
            </form>
          </Modal>

          {/* Cicilan Form Modal */}
          <Modal isOpen={showCicilanForm} onClose={() => setShowCicilanForm(false)} title="Bayar Cicilan">
            <form onSubmit={(e) => handleSaveCicilan(e, false)} className="space-y-4">
              <Select
                label="Pilih Akad Hutang"
                value={cicilanForm.id_hutang}
                onChange={(e) => {
                  const selected = hutangList.find(h => h.id_hutang === e.target.value);
                  setCicilanForm({ 
                    ...cicilanForm, 
                    id_hutang: e.target.value,
                    nominal: '',
                    mata_uang: selected?.mata_uang || 'EGP'
                  });
                }}
                options={hutangList
                  .filter(h => h.status_hutang === 'Belum Lunas')
                  .map(h => {
                    const totalPaid = getTotalPaidForHutangFromDetail(h.id_hutang);
                    const sisa = h.nominal_total - totalPaid;
                    return {
                      value: h.id_hutang,
                      label: `${h.id_hutang} - ${h.jenis_akad} - Sisa: ${formatCurrency(sisa, h.mata_uang)}`
                    };
                  })}
                placeholder="Pilih hutang"
                required
              />
              {cicilanForm.id_hutang && (
                <Card className="bg-blue-50/50 border-blue-200">
                  {(() => {
                    const h = hutangList.find(h => h.id_hutang === cicilanForm.id_hutang);
                    const paid = h ? getTotalPaidForHutangFromDetail(h.id_hutang) : 0;
                    const sisa = h ? h.nominal_total - paid : 0;
                    return h ? (
                      <div className="text-sm space-y-1">
                        <p><span className="text-slate-500">Total Hutang:</span> <span className="font-semibold">{formatCurrency(h.nominal_total, h.mata_uang)}</span></p>
                        <p><span className="text-slate-500">Sudah Dibayar:</span> <span className="font-semibold text-emerald-brand">{formatCurrency(paid, h.mata_uang)}</span></p>
                        <p><span className="text-slate-500">Sisa:</span> <span className="font-semibold text-red-500">{formatCurrency(sisa, h.mata_uang)}</span></p>
                      </div>
                    ) : null;
                  })()}
                </Card>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Nominal Bayar"
                  type="number"
                  value={cicilanForm.nominal}
                  onChange={(e) => {
                    const value = e.target.value;
                    const h = hutangList.find(h => h.id_hutang === cicilanForm.id_hutang);
                    if (h) {
                      const paid = getTotalPaidForHutangFromDetail(h.id_hutang);
                      const sisa = h.nominal_total - paid;
                      const numValue = parseFloat(value) || 0;
                      if (numValue > sisa) {
                        toast.error(`Maksimal bayar ${formatCurrency(sisa, h.mata_uang)}`);
                        return;
                      }
                    }
                    setCicilanForm({ ...cicilanForm, nominal: value });
                  }}
                  placeholder="0"
                  required
                />
                <Select
                  label="Metode Bayar"
                  value={cicilanForm.metode_bayar}
                  onChange={(e) => setCicilanForm({ ...cicilanForm, metode_bayar: e.target.value })}
                  options={METODE_BAYAR_OPTIONS.map(m => ({ value: m, label: m }))}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-emerald-dark mb-1.5">Catatan</label>
                <textarea
                  value={cicilanForm.catatan}
                  onChange={(e) => setCicilanForm({ ...cicilanForm, catatan: e.target.value })}
                  rows={2}
                  className="w-full bg-white/70 backdrop-blur-sm border border-glass-emerald rounded-xl px-4 py-2.5 text-sm text-emerald-dark focus:outline-none focus:ring-2 focus:ring-emerald-brand/30 focus:border-emerald-brand"
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => setShowCicilanForm(false)} className="flex-1">Batal</Button>
                <Button type="submit" className="flex-1">Bayar</Button>
              </div>
            </form>
          </Modal>

          {/* Edit Cicilan Form Modal */}
          <Modal isOpen={showEditCicilanForm} onClose={() => { setShowEditCicilanForm(false); setEditingCicilan(null); }} title="Edit Riwayat Pembayaran">
            <form onSubmit={(e) => handleSaveCicilan(e, true)} className="space-y-4">
              {(() => {
                const h = hutangList.find(h => h.id_hutang === cicilanForm.id_hutang);
                const paid = h ? getTotalPaidForHutangFromDetail(h.id_hutang) : 0;
                const sisa = h ? h.nominal_total - paid + (editingCicilan?.nominal_bayar || 0) : 0;
                return h ? (
                  <Card className="bg-blue-50/50 border-blue-200">
                    <div className="text-sm space-y-1">
                      <p><span className="text-slate-500">Total Hutang:</span> <span className="font-semibold">{formatCurrency(h.nominal_total, h.mata_uang)}</span></p>
                      <p><span className="text-slate-500">Maksimal Edit:</span> <span className="font-semibold text-amber-600">{formatCurrency(sisa, h.mata_uang)}</span></p>
                    </div>
                  </Card>
                ) : null;
              })()}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Nominal Bayar"
                  type="number"
                  value={cicilanForm.nominal}
                  onChange={(e) => {
                    const value = e.target.value;
                    const numValue = parseFloat(value) || 0;
                    const h = hutangList.find(h => h.id_hutang === cicilanForm.id_hutang);
                    if (h) {
                      const totalPaid = getTotalPaidForHutangFromDetail(cicilanForm.id_hutang);
                      const maxAllowed = h.nominal_total - totalPaid + (editingCicilan?.nominal_bayar || 0);
                      if (numValue > maxAllowed) {
                        toast.error(`Maksimal bayar ${formatCurrency(maxAllowed, h.mata_uang)}`);
                        return;
                      }
                    }
                    setCicilanForm({ ...cicilanForm, nominal: value });
                  }}
                  placeholder="0"
                  required
                />
                <Select
                  label="Metode Bayar"
                  value={cicilanForm.metode_bayar}
                  onChange={(e) => setCicilanForm({ ...cicilanForm, metode_bayar: e.target.value })}
                  options={METODE_BAYAR_OPTIONS.map(m => ({ value: m, label: m }))}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-emerald-dark mb-1.5">Catatan</label>
                <textarea
                  value={cicilanForm.catatan}
                  onChange={(e) => setCicilanForm({ ...cicilanForm, catatan: e.target.value })}
                  rows={2}
                  className="w-full bg-white/70 backdrop-blur-sm border border-glass-emerald rounded-xl px-4 py-2.5 text-sm text-emerald-dark focus:outline-none focus:ring-2 focus:ring-emerald-brand/30 focus:border-emerald-brand"
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => { setShowEditCicilanForm(false); setEditingCicilan(null); }} className="flex-1">Batal</Button>
                <Button type="submit" className="flex-1">Simpan Perubahan</Button>
              </div>
            </form>
          </Modal>

          <PenghutangForm
            editData={editPenghutang}
            isOpen={showPenghutangForm}
            onClose={() => { setShowPenghutangForm(false); setEditPenghutang(null); }}
            onSuccess={() => { fetchAllData(); }}
          />
        </div>
      </>
    );
  }

  // ============================================================
  // LEVEL 3: DETAIL AKAD
  // ============================================================
  if (level === 'akad' && selectedHutang && selectedPenghutang) {
    const totalPaid = getTotalPaidForHutangFromAkad(selectedHutang.id_hutang);
    const sisa = selectedHutang.nominal_total - totalPaid;
    const progress = calculatePercentage(totalPaid, selectedHutang.nominal_total);
    const isLunas = selectedHutang.status_hutang === 'Lunas' || progress >= 100;

    return (
      <>
        {actionOverlay}
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => { setLevel('detail'); setSelectedHutang(null); }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-emerald-dark truncate">Detail Akad Hutang</h1>
                <p className="text-xs sm:text-sm text-slate-500 truncate">{selectedHutang.id_hutang} • {selectedPenghutang.nama_lengkap}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleSuratPerjanjian} className="self-end sm:self-auto w-full sm:w-auto justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Surat Perjanjian
            </Button>
          </div>

          {/* Financial Summary + Sidebar Info — hanya beda grid di desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
            
            {/* Kolom Kiri: Ringkasan Keuangan + Riwayat — Mobile full, Desktop 5/7 */}
            <div className="lg:col-span-5 space-y-6">
              
              <Card className={isLunas ? 'opacity-60' : ''}>
                {/* Mobile: Stack vertikal */}
                <div className="flex flex-col gap-4 lg:hidden">
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <div className="bg-slate-50 rounded-xl p-3 sm:p-4">
                        <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider mb-1">Total</p>
                        <p className={`text-sm sm:text-lg lg:text-xl font-bold ${isLunas ? 'text-slate-400' : 'text-slate-700'}`}>
                          {formatCurrency(selectedHutang.nominal_total, selectedHutang.mata_uang)}
                        </p>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-3 sm:p-4">
                        <p className="text-[10px] sm:text-xs text-emerald-500 uppercase tracking-wider mb-1">Dibayar</p>
                        <p className={`text-sm sm:text-lg lg:text-xl font-bold ${isLunas ? 'text-slate-400' : 'text-emerald-600'}`}>
                          {formatCurrency(totalPaid, selectedHutang.mata_uang)}
                        </p>
                      </div>
                    </div>
                    <div className={`rounded-xl p-3 sm:p-4 ${isLunas ? 'bg-slate-50' : 'bg-red-50'}`}>
                      <p className={`text-[10px] sm:text-xs uppercase tracking-wider mb-1 ${isLunas ? 'text-slate-400' : 'text-red-400'}`}>Sisa</p>
                      <p className={`text-sm sm:text-lg lg:text-xl font-bold ${isLunas ? 'text-slate-400' : 'text-red-500'}`}>
                        {formatCurrency(Math.max(0, sisa), selectedHutang.mata_uang)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] sm:text-xs text-slate-500 font-medium">Progress Pembayaran</span>
                      <span className="text-[10px] sm:text-xs font-bold text-slate-700">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full h-3 sm:h-4 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${isLunas ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="primary">{selectedHutang.jenis_akad}</Badge>
                      <Badge variant={isLunas ? 'success' : 'warning'}>
                        {isLunas ? 'LUNAS' : 'Belum Lunas'}
                      </Badge>
                      <span className="text-[10px] sm:text-xs text-slate-500 self-center">
                        Jatuh Tempo: {formatDate(selectedHutang.tanggal_jatuh_tempo)}
                      </span>
                    </div>
                    {!isLunas && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => openCicilanModal('akad', selectedHutang.id_hutang, selectedHutang.mata_uang)}
                        className="w-full sm:w-auto justify-center"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                          <rect x="2" y="3" width="20" height="14" rx="2" />
                          <line x1="8" y1="21" x2="16" y2="21" />
                          <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                        Bayar Cicilan
                      </Button>
                    )}
                  </div>
                </div>

                {/* Desktop: Layout 3 kolom sejajar */}
                <div className="hidden lg:flex lg:flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="primary">{selectedHutang.jenis_akad}</Badge>
                      <Badge variant={isLunas ? 'success' : 'warning'}>
                        {isLunas ? 'LUNAS' : 'Belum Lunas'}
                      </Badge>
                      <span className="text-sm text-slate-500">
                        Jatuh Tempo: {formatDate(selectedHutang.tanggal_jatuh_tempo)}
                      </span>
                    </div>
                    {!isLunas && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => openCicilanModal('akad', selectedHutang.id_hutang, selectedHutang.mata_uang)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                          <rect x="2" y="3" width="20" height="14" rx="2" />
                          <line x1="8" y1="21" x2="16" y2="21" />
                          <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                        Bayar Cicilan
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total</p>
                      <p className={`text-xl font-bold ${isLunas ? 'text-slate-400' : 'text-slate-700'}`}>
                        {formatCurrency(selectedHutang.nominal_total, selectedHutang.mata_uang)}
                      </p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-4">
                      <p className="text-xs text-emerald-500 uppercase tracking-wider mb-1">Dibayar</p>
                      <p className={`text-xl font-bold ${isLunas ? 'text-slate-400' : 'text-emerald-600'}`}>
                        {formatCurrency(totalPaid, selectedHutang.mata_uang)}
                      </p>
                    </div>
                    <div className={`rounded-xl p-4 ${isLunas ? 'bg-slate-50' : 'bg-red-50'}`}>
                      <p className={`text-xs uppercase tracking-wider mb-1 ${isLunas ? 'text-slate-400' : 'text-red-400'}`}>Sisa</p>
                      <p className={`text-xl font-bold ${isLunas ? 'text-slate-400' : 'text-red-500'}`}>
                        {formatCurrency(Math.max(0, sisa), selectedHutang.mata_uang)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm text-slate-500 font-medium">Progress Pembayaran</span>
                      <span className="text-sm font-bold text-slate-700">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${isLunas ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Riwayat Pembayaran */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-bold text-slate-700">Riwayat Pembayaran</h3>
                  <span className="text-xs text-slate-400">{cicilanListForAkad.length} kali</span>
                </div>
                {cicilanListForAkad.length === 0 ? (
                  <EmptyState title="Belum ada pembayaran" description="Catat pembayaran cicilan pertama" />
                ) : (
                  <div className="space-y-2">
                    {cicilanListForAkad.map((c) => {
                      const sortedCicilan = [...cicilanListForAkad].sort((a, b) => 
                        new Date(a.tanggal_bayar).getTime() - new Date(b.tanggal_bayar).getTime()
                      );
                      let sisaSebelum = selectedHutang.nominal_total;
                      for (const sc of sortedCicilan) {
                        if (sc.id === c.id) break;
                        sisaSebelum -= (sc.nominal_bayar || 0);
                      }
                      const sisaSetelah = sisaSebelum - (c.nominal_bayar || 0);

                      return (
                        <Card key={c.id} padding="md" className={isLunas ? 'opacity-60' : ''}>
                          {/* Mobile layout — TIDAK DIRUBAH */}
                          <div className="block md:hidden space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <Badge variant="primary" size="sm">{c.id_cicilan}</Badge>
                                <span className="text-[11px] text-slate-500 truncate">{formatDate(c.tanggal_bayar)}</span>
                              </div>
                              <p className={`text-base font-bold flex-shrink-0 ml-2 ${isLunas ? 'text-slate-400' : 'text-emerald-600'}`}>
                                {formatCurrency(c.nominal_bayar, c.mata_uang)}
                              </p>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="default" size="sm">{c.metode_bayar}</Badge>
                                {c.catatan && <span className="text-[11px] text-slate-400 truncate max-w-[150px]">{c.catatan}</span>}
                              </div>
                              <span className="text-[10px] text-slate-400">Sisa: {formatCurrency(Math.max(0, sisaSetelah), c.mata_uang)}</span>
                            </div>
                            <div className="flex gap-1 pt-1.5 border-t border-slate-100">
                              <Button variant="ghost" size="sm" onClick={() => handleInvoiceCicilan(c)} className="flex-1 text-[10px] py-1.5" title="Download Invoice">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                  <polyline points="7 10 12 15 17 10" />
                                  <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                Invoice
                              </Button>
                              <button onClick={() => handleEditCicilan(c)} className="flex-1 text-[10px] py-1.5 rounded-lg hover:bg-blue-50 text-blue-600 font-medium transition-colors flex items-center justify-center gap-1" title="Edit">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                Edit
                              </button>
                              <button onClick={() => handleDeleteCicilan(c)} className="flex-1 text-[10px] py-1.5 rounded-lg hover:bg-red-50 text-red-500 font-medium transition-colors flex items-center justify-center gap-1" title="Hapus">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                Hapus
                              </button>
                            </div>
                          </div>

                          {/* Desktop layout — DIRAPIHKAN grid-nya saja */}
                          <div className="hidden md:flex md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="flex-shrink-0">
                                <Badge variant="primary">{c.id_cicilan}</Badge>
                              </div>
                              <div className="flex-shrink-0 w-28">
                                <span className="text-sm text-slate-500">{formatDate(c.tanggal_bayar)}</span>
                              </div>
                              <div className="flex-shrink-0">
                                <Badge variant="default">{c.metode_bayar}</Badge>
                              </div>
                              {c.catatan && (
                                <p className="text-sm text-slate-400 truncate flex-1 min-w-0">{c.catatan}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-6 flex-shrink-0">
                              <div className="text-right">
                                <p className="text-xs text-slate-500">Sisa: {formatCurrency(Math.max(0, sisaSetelah), c.mata_uang)}</p>
                                <p className={`text-lg font-bold ${isLunas ? 'text-slate-400' : 'text-emerald-brand'}`}>
                                  {formatCurrency(c.nominal_bayar, c.mata_uang)}
                                </p>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <Button variant="ghost" size="sm" onClick={() => handleInvoiceCicilan(c)} title="Download Invoice" className="p-1">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                  </svg>
                                </Button>
                                <button onClick={() => handleEditCicilan(c)} className="p-1 rounded hover:bg-blue-500/10 text-blue-600" title="Edit">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>
                                <button onClick={() => handleDeleteCicilan(c)} className="p-1 rounded hover:bg-red-500/10 text-red-500" title="Hapus">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Kolom Kanan: Info Penghutang & Detail Akad — hanya muncul di desktop */}
            <div className="hidden lg:block lg:col-span-2 space-y-4">
              <Card>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Data Penghutang</h3>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-brand/10 flex items-center justify-center flex-shrink-0">
                    {selectedPenghutang.foto_ttd_url ? (
                      <img src={selectedPenghutang.foto_ttd_url} alt="" className="w-8 h-8 object-contain rounded" />
                    ) : (
                      <span className="text-base font-bold text-emerald-brand">{selectedPenghutang.nama_lengkap.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-emerald-dark text-sm truncate">{selectedPenghutang.nama_lengkap}</p>
                    <p className="text-xs text-slate-500">{selectedPenghutang.id_penghutang}</p>
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">WA Pribadi</span>
                    <span className="font-medium text-slate-700 text-right">{selectedPenghutang.no_wa_pribadi}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">WA Kerabat</span>
                    <span className="font-medium text-slate-700 text-right">{selectedPenghutang.no_wa_kerabat}</span>
                  </div>
                </div>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Rincian Hutang</h3>
                <p className="text-sm text-slate-700 leading-relaxed">{selectedHutang.rincian_hutang}</p>
                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <p className="text-slate-500 mb-0.5">Nominal Pokok</p>
                    <p className="font-semibold text-slate-700">{formatCurrency(selectedHutang.nominal_pokok, selectedHutang.mata_uang)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-0.5">Nominal Wajib</p>
                    <p className="font-semibold text-slate-700">{formatCurrency(selectedHutang.nominal_total, selectedHutang.mata_uang)}</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Cicilan Form Modal (Akad context) */}
          <Modal isOpen={showCicilanForm && cicilanModalContext === 'akad'} onClose={() => setShowCicilanForm(false)} title="Bayar Cicilan">
            <form onSubmit={(e) => handleSaveCicilan(e, false)} className="space-y-4">
              <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-3 text-sm">
                <p><span className="text-slate-500">Total Hutang:</span> <span className="font-semibold">{formatCurrency(selectedHutang.nominal_total, selectedHutang.mata_uang)}</span></p>
                <p><span className="text-slate-500">Sudah Dibayar:</span> <span className="font-semibold text-emerald-brand">{formatCurrency(totalPaid, selectedHutang.mata_uang)}</span></p>
                <p><span className="text-slate-500">Sisa:</span> <span className="font-semibold text-red-500">{formatCurrency(Math.max(0, sisa), selectedHutang.mata_uang)}</span></p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Nominal Bayar"
                  type="number"
                  value={cicilanForm.nominal}
                  onChange={(e) => {
                    const value = e.target.value;
                    const numValue = parseFloat(value) || 0;
                    if (numValue > sisa) {
                      toast.error(`Maksimal bayar ${formatCurrency(sisa, selectedHutang.mata_uang)}`);
                      return;
                    }
                    setCicilanForm({ ...cicilanForm, nominal: value });
                  }}
                  placeholder="0"
                  required
                />
                <Select
                  label="Metode Bayar"
                  value={cicilanForm.metode_bayar}
                  onChange={(e) => setCicilanForm({ ...cicilanForm, metode_bayar: e.target.value })}
                  options={METODE_BAYAR_OPTIONS.map(m => ({ value: m, label: m }))}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-emerald-dark mb-1.5">Catatan</label>
                <textarea
                  value={cicilanForm.catatan}
                  onChange={(e) => setCicilanForm({ ...cicilanForm, catatan: e.target.value })}
                  rows={2}
                  className="w-full bg-white/70 backdrop-blur-sm border border-glass-emerald rounded-xl px-4 py-2.5 text-sm text-emerald-dark focus:outline-none focus:ring-2 focus:ring-emerald-brand/30 focus:border-emerald-brand"
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => setShowCicilanForm(false)} className="flex-1">Batal</Button>
                <Button type="submit" className="flex-1">Bayar</Button>
              </div>
            </form>
          </Modal>

          {/* Edit Cicilan Form Modal (Akad context) */}
          <Modal isOpen={showEditCicilanForm} onClose={() => { setShowEditCicilanForm(false); setEditingCicilan(null); }} title="Edit Riwayat Pembayaran">
            <form onSubmit={(e) => handleSaveCicilan(e, true)} className="space-y-4">
              <Card className="bg-blue-50/50 border-blue-200">
                <div className="text-sm space-y-1">
                  <p><span className="text-slate-500">Total Hutang:</span> <span className="font-semibold">{formatCurrency(selectedHutang.nominal_total, selectedHutang.mata_uang)}</span></p>
                  <p><span className="text-slate-500">Maksimal Edit:</span> <span className="font-semibold text-amber-600">
                    {formatCurrency(selectedHutang.nominal_total - totalPaid + (editingCicilan?.nominal_bayar || 0), selectedHutang.mata_uang)}
                  </span></p>
                </div>
              </Card>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Nominal Bayar"
                  type="number"
                  value={cicilanForm.nominal}
                  onChange={(e) => {
                    const value = e.target.value;
                    const numValue = parseFloat(value) || 0;
                    const maxAllowed = selectedHutang.nominal_total - totalPaid + (editingCicilan?.nominal_bayar || 0);
                    if (numValue > maxAllowed) {
                      toast.error(`Maksimal bayar ${formatCurrency(maxAllowed, selectedHutang.mata_uang)}`);
                      return;
                    }
                    setCicilanForm({ ...cicilanForm, nominal: value });
                  }}
                  required
                />
                <Select
                  label="Metode Bayar"
                  value={cicilanForm.metode_bayar}
                  onChange={(e) => setCicilanForm({ ...cicilanForm, metode_bayar: e.target.value })}
                  options={METODE_BAYAR_OPTIONS.map(m => ({ value: m, label: m }))}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-emerald-dark mb-1.5">Catatan</label>
                <textarea
                  value={cicilanForm.catatan}
                  onChange={(e) => setCicilanForm({ ...cicilanForm, catatan: e.target.value })}
                  rows={2}
                  className="w-full bg-white/70 backdrop-blur-sm border border-glass-emerald rounded-xl px-4 py-2.5 text-sm text-emerald-dark focus:outline-none focus:ring-2 focus:ring-emerald-brand/30 focus:border-emerald-brand"
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => { setShowEditCicilanForm(false); setEditingCicilan(null); }} className="flex-1">Batal</Button>
                <Button type="submit" className="flex-1">Simpan Perubahan</Button>
              </div>
            </form>
          </Modal>

          {/* Cicilan Form Modal (Detail context - muncul dari level akad dengan dropdown) */}
          <Modal 
            isOpen={showCicilanForm && cicilanModalContext === 'detail' && level === 'akad'} 
            onClose={() => setShowCicilanForm(false)} 
            title="Bayar Cicilan"
          >
            <form onSubmit={(e) => handleSaveCicilan(e, false)} className="space-y-4">
              <Select
                label="Pilih Akad Hutang"
                value={cicilanForm.id_hutang}
                onChange={(e) => {
                  const selected = allHutangList.find(h => h.id_hutang === e.target.value);
                  setCicilanForm({ 
                    ...cicilanForm, 
                    id_hutang: e.target.value,
                    nominal: '',
                    mata_uang: selected?.mata_uang || 'EGP'
                  });
                }}
                options={allHutangList
                  .filter(h => h.id_penghutang === selectedPenghutang.id_penghutang && h.status_hutang === 'Belum Lunas')
                  .map(h => {
                    const totalPaid = allCicilanMap[selectedPenghutang.id_penghutang]
                      ?.filter(c => c.id_hutang === h.id_hutang)
                      ?.reduce((s, c) => s + (c.nominal_bayar || 0), 0) || 0;
                    const sisa = h.nominal_total - totalPaid;
                    return {
                      value: h.id_hutang,
                      label: `${h.id_hutang} - ${h.jenis_akad} - Sisa: ${formatCurrency(sisa, h.mata_uang)}`
                    };
                  })}
                placeholder="Pilih hutang"
                required
              />
              {cicilanForm.id_hutang && (
                <Card className="bg-blue-50/50 border-blue-200">
                  {(() => {
                    const h = allHutangList.find(h => h.id_hutang === cicilanForm.id_hutang);
                    const paid = allCicilanMap[selectedPenghutang.id_penghutang]
                      ?.filter(c => c.id_hutang === cicilanForm.id_hutang)
                      ?.reduce((s, c) => s + (c.nominal_bayar || 0), 0) || 0;
                    const sisaHutang = h ? h.nominal_total - paid : 0;
                    return h ? (
                      <div className="text-sm space-y-1">
                        <p><span className="text-slate-500">Total Hutang:</span> <span className="font-semibold">{formatCurrency(h.nominal_total, h.mata_uang)}</span></p>
                        <p><span className="text-slate-500">Sudah Dibayar:</span> <span className="font-semibold text-emerald-brand">{formatCurrency(paid, h.mata_uang)}</span></p>
                        <p><span className="text-slate-500">Sisa:</span> <span className="font-semibold text-red-500">{formatCurrency(sisaHutang, h.mata_uang)}</span></p>
                      </div>
                    ) : null;
                  })()}
                </Card>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Nominal Bayar"
                  type="number"
                  value={cicilanForm.nominal}
                  onChange={(e) => {
                    const value = e.target.value;
                    const h = allHutangList.find(h => h.id_hutang === cicilanForm.id_hutang);
                    if (h) {
                      const paid = allCicilanMap[selectedPenghutang.id_penghutang]
                        ?.filter(c => c.id_hutang === cicilanForm.id_hutang)
                        ?.reduce((s, c) => s + (c.nominal_bayar || 0), 0) || 0;
                      const sisaHutang = h.nominal_total - paid;
                      const numValue = parseFloat(value) || 0;
                      if (numValue > sisaHutang) {
                        toast.error(`Maksimal bayar ${formatCurrency(sisaHutang, h.mata_uang)}`);
                        return;
                      }
                    }
                    setCicilanForm({ ...cicilanForm, nominal: value });
                  }}
                  placeholder="0"
                  required
                />
                <Select
                  label="Metode Bayar"
                  value={cicilanForm.metode_bayar}
                  onChange={(e) => setCicilanForm({ ...cicilanForm, metode_bayar: e.target.value })}
                  options={METODE_BAYAR_OPTIONS.map(m => ({ value: m, label: m }))}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-emerald-dark mb-1.5">Catatan</label>
                <textarea
                  value={cicilanForm.catatan}
                  onChange={(e) => setCicilanForm({ ...cicilanForm, catatan: e.target.value })}
                  rows={2}
                  className="w-full bg-white/70 backdrop-blur-sm border border-glass-emerald rounded-xl px-4 py-2.5 text-sm text-emerald-dark focus:outline-none focus:ring-2 focus:ring-emerald-brand/30 focus:border-emerald-brand"
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => setShowCicilanForm(false)} className="flex-1">Batal</Button>
                <Button type="submit" className="flex-1">Bayar</Button>
              </div>
            </form>
          </Modal>
        </div>
      </>
    );
  }

  return null;
}