// components/forms/MustahiqForm.tsx

"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { parseNominalDenganMataUang } from '@/lib/utils/scoring';
import { formatNominal, parseNominal } from '@/lib/utils/currency';
import { Mustahiq, MustahiqData, Kendaraan, HutangData } from '@/types';
import imageCompression from 'browser-image-compression';
import {
  JENJANG_PENDIDIKAN_OPTIONS,
  TINGKAT_KULIAH_OPTIONS,
  STATUS_TEMPAT_TINGGAL_OPTIONS,
  BIAYA_SEWA_OPTIONS,
  PEKERJAAN_AYAH_OPTIONS,
  PEKERJAAN_IBU_OPTIONS,
  PENGHASILAN_OPTIONS,
  JUMLAH_KENDARAAN_OPTIONS,
  JENIS_KENDARAAN_OPTIONS,
  NOMINAL_KIRIMAN_OPTIONS,
  SUMBER_DANA_OPTIONS,
  TUJUAN_HUTANG_OPTIONS,
  STATUS_BEASISWA_OPTIONS,
  CAKUPAN_BEASISWA_OPTIONS,
  KIRIMAN_ORANGTUA_OPTIONS,
  STATUS_MENIKAH_OPTIONS,
  YA_TIDAK_OPTIONS,
  YA_TIDAK_HUTANG_OPTIONS,
  MEROKOK_OPTIONS,
  KEKELUARGAAN_OPTIONS,
  MATA_UANG_OPTIONS,
} from '@/lib/utils/constants';
import { generateIdMustahiq, getToday, formatCurrency } from '@/lib/utils/formatters';
import { calculateMustahiqScore, initializeScoringRates } from '@/lib/utils/scoring';
import toast from 'react-hot-toast';
import type { Database, Json } from '@/lib/supabase/types';

interface MustahiqFormProps {
  editData?: Mustahiq | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DRAFT_KEY = 'mustahiq_form_draft';

type DraftData = Record<string, unknown>;

interface FormDraft {
  timestamp: number;
  data: DraftData;
  isEdit: boolean;
  editId?: string;
}

const isFormDraft = (value: unknown): value is FormDraft => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.timestamp === 'number'
    && typeof candidate.isEdit === 'boolean'
    && Boolean(candidate.data)
    && typeof candidate.data === 'object'
    && !Array.isArray(candidate.data);
};

const isDraftKendaraan = (value: unknown): value is Kendaraan => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.jenis === 'string' && typeof item.rincian === 'string';
};

const isDraftHutang = (value: unknown): value is HutangData => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.kepada === 'string'
    && typeof item.kekeluargaan === 'string'
    && typeof item.nominal === 'number'
    && typeof item.mata_uang === 'string'
    && typeof item.tujuan === 'string';
};

type MustahiqInsert = Database['public']['Tables']['mustahiq']['Insert'];
type MustahiqUpdate = Database['public']['Tables']['mustahiq']['Update'];

export const MustahiqForm: React.FC<MustahiqFormProps> = ({
  editData,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [draftTimestamp, setDraftTimestamp] = useState<number | null>(null);
  const hasRestoredDraft = useRef(false);
  const lastSavedData = useRef<string>('');
  const isSubmitting = useRef(false);
  const [showHutangModal, setShowHutangModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============================================================
  // FORM STATE - SECTION 1: DATA DIRI & IDENTITAS
  // ============================================================
  const [namaLengkap, setNamaLengkap] = useState('');
  const [almamater, setAlmamater] = useState('');
  const [tahunKedatangan, setTahunKedatangan] = useState('20');
  const [noTelpMesir, setNoTelpMesir] = useState('+20');
  const [noWaAktif, setNoWaAktif] = useState('+');
  const [alamatMesir, setAlamatMesir] = useState('');
  const [alamatIndonesia, setAlamatIndonesia] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState('');

  // ============================================================
  // FORM STATE - SECTION 2: AKADEMIK & PENDIDIKAN
  // ============================================================
  const [jenjangPendidikan, setJenjangPendidikan] = useState('');
  const [mustawaTingkat, setMustawaTingkat] = useState('');
  const [namaFakultas, setNamaFakultas] = useState('');
  const [namaJurusan, setNamaJurusan] = useState('');
  const [tingkatKuliah, setTingkatKuliah] = useState('');
  const [pendidikanLainnya, setPendidikanLainnya] = useState('');

  // ============================================================
  // FORM STATE - SECTION 3: DOMISILI & TEMPAT TINGGAL
  // ============================================================
  const [statusTempatTinggal, setStatusTempatTinggal] = useState('');
  const [biayaSewa, setBiayaSewa] = useState('');

  // ============================================================
  // FORM STATE - SECTION 4: DATA ORANG TUA & ASET KELUARGA
  // ============================================================
  const [pekerjaanAyah, setPekerjaanAyah] = useState('');
  const [pekerjaanAyahLainnya, setPekerjaanAyahLainnya] = useState('');
  const [pekerjaanIbu, setPekerjaanIbu] = useState('');
  const [pekerjaanIbuLainnya, setPekerjaanIbuLainnya] = useState('');
  const [penghasilanAyah, setPenghasilanAyah] = useState('');
  const [penghasilanIbu, setPenghasilanIbu] = useState('');
  const [anakKe, setAnakKe] = useState('');
  const [anakDari, setAnakDari] = useState('');
  const [jumlahKendaraan, setJumlahKendaraan] = useState('');
  const [kendaraanList, setKendaraanList] = useState<Kendaraan[]>([]);

  // ============================================================
  // FORM STATE - SECTION 5: FINANSIAL & PENDAPATAN
  // ============================================================
  const [kirimanOrangtua, setKirimanOrangtua] = useState('');
  const [nominalKiriman, setNominalKiriman] = useState('');
  const [sumberDanaUtama, setSumberDanaUtama] = useState('');
  const [sumberDanaLainnya, setSumberDanaLainnya] = useState('');
  const [nominalPendapatanRaw, setNominalPendapatanRaw] = useState('');
  const [nominalPendapatan, setNominalPendapatan] = useState('');

  // ============================================================
  // FORM STATE - SECTION 6: TANGGUNGAN, HUTANG & BEASISWA
  // ============================================================
  const [statusMenikah, setStatusMenikah] = useState('');
  const [punyaTanggungan, setPunyaTanggungan] = useState('');
  const [jumlahTanggungan, setJumlahTanggungan] = useState('');
  const [rincianTanggungan, setRincianTanggungan] = useState('');
  const [punyaHutang, setPunyaHutang] = useState('');
  const [hutangList, setHutangList] = useState<HutangData[]>([]);
  const [punyaBeasiswa, setPunyaBeasiswa] = useState('');
  const [statusBeasiswa, setStatusBeasiswa] = useState('');
  const [cakupanBeasiswa, setCakupanBeasiswa] = useState('');
  const [nominalBeasiswaRaw, setNominalBeasiswaRaw] = useState('');
  const [nominalBeasiswa, setNominalBeasiswa] = useState('');

  // ============================================================
  // FORM STATE - SECTION 7: GAYA HIDUP & LAMPIRAN
  // ============================================================
  const [merokok, setMerokok] = useState('');
  const [rokokPerHari, setRokokPerHari] = useState('');

  // ============================================================
  // CONDITIONAL STATE
  // ============================================================
  const [showMustawa, setShowMustawa] = useState(false);
  const [showKuliah, setShowKuliah] = useState(false);
  const [showPendidikanLainnya, setShowPendidikanLainnya] = useState(false);
  const [showPekerjaanAyahLainnya, setShowPekerjaanAyahLainnya] = useState(false);
  const [showPekerjaanIbuLainnya, setShowPekerjaanIbuLainnya] = useState(false);
  const [showKendaraanDetail, setShowKendaraanDetail] = useState(false);
  const [showNominalKiriman, setShowNominalKiriman] = useState(false);
  const [showSumberDana, setShowSumberDana] = useState(false);
  const [showSumberDanaLainnya, setShowSumberDanaLainnya] = useState(false);
  const [showTanggunganDetail, setShowTanggunganDetail] = useState(false);
  const [showHutangDetail, setShowHutangDetail] = useState(false);
  const [showBeasiswaDetail, setShowBeasiswaDetail] = useState(false);
  const [showNominalBeasiswa, setShowNominalBeasiswa] = useState(false);
  const [showRokokDetail, setShowRokokDetail] = useState(false);

  // ============================================================
  // HUTANG FORM STATE
  // ============================================================
  const [hutangForm, setHutangForm] = useState<HutangData>({
    kepada: '',
    kekeluargaan: '',
    nominal: 0,
    mata_uang: 'EGP',
    tujuan: '',
    tujuan_lainnya: '',
  });
  const [hutangFormErrors, setHutangFormErrors] = useState<Record<string, string>>({});
  const [editingHutangIndex, setEditingHutangIndex] = useState<number | null>(null);

  // ============================================================
  // PARSING FUNCTIONS
  // ============================================================
  const parseNominalRange = (nominal: string): { amount: number; currency: string } => {
    if (!nominal || nominal.trim() === '') return { amount: 0, currency: 'EGP' };
    
    const cleaned = nominal.toUpperCase().trim();
    
    if (cleaned.includes(' - ') || cleaned.includes('–')) {
      const parts = cleaned.split(/[–-]/);
      if (parts.length >= 2) {
        const first = parseSingleNominalValue(parts[0].trim());
        const second = parseSingleNominalValue(parts[1].trim());
        if (first.amount > 0 && second.amount > 0) {
          return {
            amount: Math.round((first.amount + second.amount) / 2),
            currency: first.currency
          };
        }
      }
    }
    
    if (cleaned.includes('<')) {
      const amount = parseFloat(cleaned.replace(/[^\d.]/g, '')) || 0;
      if (amount > 0) {
        let multiplier = 1;
        if (cleaned.includes('JUTA') || cleaned.includes('MILLION') || cleaned.includes('M')) {
          multiplier = 1000000;
        } else if (cleaned.includes('RIBU') || cleaned.includes('THOUSAND') || cleaned.includes('K')) {
          multiplier = 1000;
        }
        const currency = cleaned.includes('USD') ? 'USD' : 
                        cleaned.includes('IDR') ? 'IDR' : 
                        cleaned.includes('EGP') ? 'EGP' : 'IDR';
        return { amount: Math.round(amount * multiplier * 0.75), currency };
      }
    }
    
    if (cleaned.includes('>')) {
      const amount = parseFloat(cleaned.replace(/[^\d.]/g, '')) || 0;
      if (amount > 0) {
        let multiplier = 1;
        if (cleaned.includes('JUTA') || cleaned.includes('MILLION') || cleaned.includes('M')) {
          multiplier = 1000000;
        } else if (cleaned.includes('RIBU') || cleaned.includes('THOUSAND') || cleaned.includes('K')) {
          multiplier = 1000;
        }
        const currency = cleaned.includes('USD') ? 'USD' : 
                        cleaned.includes('IDR') ? 'IDR' : 
                        cleaned.includes('EGP') ? 'EGP' : 'IDR';
        return { amount: Math.round(amount * multiplier * 1.25), currency };
      }
    }
    
    return parseSingleNominalValue(cleaned);
  };

  const parseSingleNominalValue = (nominal: string): { amount: number; currency: string } => {
    if (!nominal || nominal.trim() === '') return { amount: 0, currency: 'EGP' };
    
    const cleaned = nominal.toUpperCase().trim();
    let currency = 'EGP';
    let amount = 0;
    
    if (cleaned.includes('USD') || cleaned.includes('$')) {
      currency = 'USD';
      amount = parseFloat(cleaned.replace(/[^\d.]/g, '')) || 0;
    } else if (cleaned.includes('IDR') || cleaned.includes('RP')) {
      currency = 'IDR';
      const cleanAmount = cleaned.replace(/[^\d]/g, '');
      amount = parseInt(cleanAmount, 10) || 0;
    } else if (cleaned.includes('EGP') || cleaned.includes('LE')) {
      currency = 'EGP';
      amount = parseFloat(cleaned.replace(/[^\d.]/g, '')) || 0;
    } else {
      const cleanAmount = cleaned.replace(/[^\d]/g, '');
      amount = parseInt(cleanAmount, 10) || 0;
      if (amount > 10000) currency = 'IDR';
    }
    
    return { amount: Math.round(amount), currency };
  };

  // ============================================================
  // INITIALIZATION
  // ============================================================
  useEffect(() => {
    initializeScoringRates().catch(err => {
      console.warn('[MustahiqForm] ⚠️ Gagal inisialisasi kurs:', err);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (fotoPreview && fotoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(fotoPreview);
      }
    };
  }, [fotoPreview]);

  // ============================================================
  // AUTO CAPITALIZE NAME
  // ============================================================
  const handleNamaLengkapChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const capitalized = value.replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
    setNamaLengkap(capitalized);
  };

  // ============================================================
  // FORMAT TAHUN KEDATANGAN
  // ============================================================
  const handleTahunKedatanganChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    
    if (!value.startsWith('20')) {
      value = '20' + value.replace(/^20/, '');
    }
    
    value = value.slice(0, 4);
    
    setTahunKedatangan(value);
    if (warnings.tahunKedatangan) {
      setWarnings(prev => ({ ...prev, tahunKedatangan: '' }));
    }
  };

  // ============================================================
  // FORMAT NO TELP MESIR
  // ============================================================
  const handleNoTelpMesirChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.replace(/[^\d+]/g, '');
    if (!value.startsWith('+20')) {
      if (value.startsWith('+')) {
        value = '+20' + value.slice(1).replace(/^20/, '');
      } else {
        value = '+20' + value.replace(/^\+?20/, '');
      }
    }
    value = value.slice(0, 13);
    setNoTelpMesir(value);
    if (warnings.noTelpMesir) {
      setWarnings(prev => ({ ...prev, noTelpMesir: '' }));
    }
  };

  // ============================================================
  // FORMAT NO WA
  // ============================================================
  const handleNoWaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.replace(/[^\d+]/g, '');
    if (!value.startsWith('+')) {
      value = '+' + value;
    }
    value = value.slice(0, 14);
    setNoWaAktif(value);
    if (warnings.noWaAktif) {
      setWarnings(prev => ({ ...prev, noWaAktif: '' }));
    }
  };

  // ============================================================
  // FORMAT NOMINAL HELPER
  // ============================================================
  const formatNominalDisplay = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    return Number(digits).toLocaleString('id-ID');
  };

  const handleNominalPendapatanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    setNominalPendapatanRaw(raw);
    setNominalPendapatan(formatNominalDisplay(raw));
  };

  const handleNominalBeasiswaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    setNominalBeasiswaRaw(raw);
    setNominalBeasiswa(formatNominalDisplay(raw));
  };

  // ============================================================
  // IMAGE HANDLING
  // ============================================================
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar (JPG, PNG, WebP)');
      return;
    }
    
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Ukuran file terlalu besar (maksimal 20MB)');
      return;
    }
    
    console.log('New file selected:', file.name, (file.size / 1024).toFixed(2) + 'KB');
    setFotoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setFotoPreview(previewUrl);
    toast.success('Foto baru dipilih. Gambar lama akan diganti saat disimpan.');
  };

  // ============================================================
  // UPLOAD IMAGE
  // ============================================================
  const uploadImage = async (): Promise<string | null> => {
    if (!fotoFile) return fotoUrl || null;
    
    setIsUploading(true);
    
    try {
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        initialQuality: 0.8,
        fileType: 'image/jpeg',
      };
      
      const compressedFile = await imageCompression(fotoFile, options);
      console.log('Compressed:', (compressedFile.size / 1024).toFixed(2) + 'KB');
      
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const fileName = `${timestamp}-${randomStr}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('mustahiq-photos')
        .upload(fileName, compressedFile, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('mustahiq-photos')
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;
      if (!publicUrl) throw new Error('URL publik foto tidak tersedia');

      console.log('New image uploaded:', publicUrl);
      
      setFotoUrl(publicUrl);
      setFotoPreview(publicUrl);
      
      toast.success('Foto berhasil diupload!');
      return publicUrl;
    } catch (error: unknown) {
      console.error('Upload failed:', error);
      toast.error('Gagal upload: ' + (error instanceof Error ? error.message : 'Kesalahan tidak diketahui'));
      return fotoUrl || null;
    } finally {
      setIsUploading(false);
    }
  };

  // ============================================================
  // DELETE OLD IMAGE
  // ============================================================
  const deleteOldImage = async (url: string): Promise<void> => {
    if (!url || url === '') return;
    
    try {
      let fileName = '';
      if (url.includes('/mustahiq-photos/')) {
        const parts = url.split('/mustahiq-photos/');
        if (parts.length > 1) {
          fileName = parts[1].split('?')[0];
        }
      }
      if (!fileName) {
        const urlParts = url.split('/');
        fileName = urlParts[urlParts.length - 1].split('?')[0];
      }
      if (!fileName || fileName === 'undefined' || fileName === 'null' || fileName === '') {
        return;
      }
      
      const { error } = await supabase.storage
        .from('mustahiq-photos')
        .remove([fileName]);

      if (error) throw error;
    } catch (error) {
      console.warn('Error deleting old image:', error);
    }
  };

  // ============================================================
  // DRAFT FUNCTIONS
  // ============================================================
  const collectFormData = useCallback(() => {
    return {
      namaLengkap, almamater, tahunKedatangan, noTelpMesir, noWaAktif, alamatMesir, alamatIndonesia,
      jenjangPendidikan, mustawaTingkat, namaFakultas, namaJurusan, tingkatKuliah, pendidikanLainnya,
      statusTempatTinggal, biayaSewa,
      pekerjaanAyah, pekerjaanAyahLainnya, pekerjaanIbu, pekerjaanIbuLainnya,
      penghasilanAyah, penghasilanIbu, anakKe, anakDari, jumlahKendaraan, kendaraanList,
      kirimanOrangtua, nominalKiriman, sumberDanaUtama, sumberDanaLainnya,
      nominalPendapatanRaw, nominalPendapatan,
      statusMenikah, punyaTanggungan, jumlahTanggungan, rincianTanggungan,
      punyaHutang, hutangList, punyaBeasiswa, statusBeasiswa, cakupanBeasiswa,
      nominalBeasiswaRaw, nominalBeasiswa,
      merokok, rokokPerHari, fotoUrl,
      showMustawa, showKuliah, showPendidikanLainnya,
      showPekerjaanAyahLainnya, showPekerjaanIbuLainnya,
      showKendaraanDetail, showNominalKiriman, showSumberDana, showSumberDanaLainnya,
      showTanggunganDetail, showHutangDetail, showBeasiswaDetail,
      showNominalBeasiswa, showRokokDetail,
    };
  }, [
    namaLengkap, almamater, tahunKedatangan, noTelpMesir, noWaAktif, alamatMesir, alamatIndonesia,
    jenjangPendidikan, mustawaTingkat, namaFakultas, namaJurusan, tingkatKuliah, pendidikanLainnya,
    statusTempatTinggal, biayaSewa,
    pekerjaanAyah, pekerjaanAyahLainnya, pekerjaanIbu, pekerjaanIbuLainnya,
    penghasilanAyah, penghasilanIbu, anakKe, anakDari, jumlahKendaraan, kendaraanList,
    kirimanOrangtua, nominalKiriman, sumberDanaUtama, sumberDanaLainnya,
    nominalPendapatanRaw, nominalPendapatan,
    statusMenikah, punyaTanggungan, jumlahTanggungan, rincianTanggungan,
    punyaHutang, hutangList, punyaBeasiswa, statusBeasiswa, cakupanBeasiswa,
    nominalBeasiswaRaw, nominalBeasiswa,
    merokok, rokokPerHari, fotoUrl,
    showMustawa, showKuliah, showPendidikanLainnya,
    showPekerjaanAyahLainnya, showPekerjaanIbuLainnya,
    showKendaraanDetail, showNominalKiriman, showSumberDana, showSumberDanaLainnya,
    showTanggunganDetail, showHutangDetail, showBeasiswaDetail,
    showNominalBeasiswa, showRokokDetail,
  ]);

  const hasFormData = useCallback((): boolean => {
    const data = collectFormData();
    return Object.entries(data).some(([key, value]) => {
      if (key.startsWith('show')) return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') return value.trim() !== '';
      if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0;
      return value != null;
    });
  }, [collectFormData]);

  const saveDraftToStorage = useCallback(() => {
    if (isSubmitting.current) return;
    if (editData) return;
    
    try {
      const formData = collectFormData();
      const dataStr = JSON.stringify(formData);
      
      if (!hasFormData()) {
        localStorage.removeItem(DRAFT_KEY);
        setDraftTimestamp(null);
        lastSavedData.current = '';
        return;
      }
      
      if (dataStr === lastSavedData.current) return;
      
      const draft: FormDraft = {
        timestamp: Date.now(),
        data: formData as DraftData,
        isEdit: false,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setDraftTimestamp(draft.timestamp);
      lastSavedData.current = dataStr;
    } catch (error) {
      console.warn('Auto-save failed:', error);
    }
  }, [collectFormData, hasFormData, editData]);

  useEffect(() => {
    if (!isOpen || editData) return;
    const timer = setTimeout(() => { saveDraftToStorage(); }, 3000);
    return () => clearTimeout(timer);
  }, [collectFormData, isOpen, editData, saveDraftToStorage]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!editData && isOpen) { saveDraftToStorage(); }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [editData, isOpen, saveDraftToStorage]);

  useEffect(() => {
    if (!isOpen || editData || hasRestoredDraft.current) return;
    
    try {
      const stored = localStorage.getItem(DRAFT_KEY);
      if (stored) {
        const parsedDraft: unknown = JSON.parse(stored);
        if (!isFormDraft(parsedDraft)) {
          localStorage.removeItem(DRAFT_KEY);
          return;
        }
        const draft = parsedDraft;
        const hoursDiff = (Date.now() - draft.timestamp) / (1000 * 60 * 60);
        if (hoursDiff > 24) {
          localStorage.removeItem(DRAFT_KEY);
          return;
        }
        const hasData = Object.values(draft.data).some((value) => {
          if (Array.isArray(value)) return value.length > 0;
          if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0;
          return value !== '' && value !== 0 && value !== undefined && value !== null;
        });
        if (hasData) {
          const timeDiff = Math.floor((Date.now() - draft.timestamp) / 1000 / 60);
          const timeText = timeDiff < 1 ? 'kurang dari 1 menit' : `${timeDiff} menit`;
          if (window.confirm(`Ditemukan draft yang belum tersimpan dari ${timeText} yang lalu. Apakah Anda ingin melanjutkan?`)) {
            restoreDraftData(draft.data);
            setDraftTimestamp(draft.timestamp);
            lastSavedData.current = JSON.stringify(draft.data);
            toast.success('Data draft berhasil dipulihkan');
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load draft:', error);
      localStorage.removeItem(DRAFT_KEY);
    }
    hasRestoredDraft.current = true;
  }, [isOpen, editData]);

  const restoreDraftData = useCallback((draftData: DraftData) => {
    const text = (key: string, fallback = ''): string =>
      typeof draftData[key] === 'string' ? draftData[key] as string : fallback;
    const flag = (key: string): boolean => draftData[key] === true;
    const kendaraan = Array.isArray(draftData.kendaraanList)
      ? draftData.kendaraanList.filter(isDraftKendaraan)
      : [];
    const hutang = Array.isArray(draftData.hutangList)
      ? draftData.hutangList.filter(isDraftHutang)
      : [];

    setNamaLengkap(text('namaLengkap'));
    setAlmamater(text('almamater'));
    setTahunKedatangan(text('tahunKedatangan', '20'));
    setNoTelpMesir(text('noTelpMesir', '+20'));
    setNoWaAktif(text('noWaAktif', '+'));
    setAlamatMesir(text('alamatMesir'));
    setAlamatIndonesia(text('alamatIndonesia'));
    setFotoUrl(text('fotoUrl'));
    setJenjangPendidikan(text('jenjangPendidikan'));
    setMustawaTingkat(text('mustawaTingkat'));
    setNamaFakultas(text('namaFakultas'));
    setNamaJurusan(text('namaJurusan'));
    setTingkatKuliah(text('tingkatKuliah'));
    setPendidikanLainnya(text('pendidikanLainnya'));
    setStatusTempatTinggal(text('statusTempatTinggal'));
    setBiayaSewa(text('biayaSewa'));
    setPekerjaanAyah(text('pekerjaanAyah'));
    setPekerjaanAyahLainnya(text('pekerjaanAyahLainnya'));
    setPekerjaanIbu(text('pekerjaanIbu'));
    setPekerjaanIbuLainnya(text('pekerjaanIbuLainnya'));
    setPenghasilanAyah(text('penghasilanAyah'));
    setPenghasilanIbu(text('penghasilanIbu'));
    setAnakKe(text('anakKe'));
    setAnakDari(text('anakDari'));
    setJumlahKendaraan(text('jumlahKendaraan'));
    setKendaraanList(kendaraan);
    setKirimanOrangtua(text('kirimanOrangtua'));
    setNominalKiriman(text('nominalKiriman'));
    setSumberDanaUtama(text('sumberDanaUtama'));
    setSumberDanaLainnya(text('sumberDanaLainnya'));
    setNominalPendapatanRaw(text('nominalPendapatanRaw'));
    setNominalPendapatan(text('nominalPendapatan'));
    setStatusMenikah(text('statusMenikah'));
    setPunyaTanggungan(text('punyaTanggungan'));
    setJumlahTanggungan(text('jumlahTanggungan'));
    setRincianTanggungan(text('rincianTanggungan'));
    setPunyaHutang(text('punyaHutang'));
    setHutangList(hutang);
    setPunyaBeasiswa(text('punyaBeasiswa'));
    setStatusBeasiswa(text('statusBeasiswa'));
    setCakupanBeasiswa(text('cakupanBeasiswa'));
    setNominalBeasiswaRaw(text('nominalBeasiswaRaw'));
    setNominalBeasiswa(text('nominalBeasiswa'));
    setMerokok(text('merokok'));
    setRokokPerHari(text('rokokPerHari'));
    setShowMustawa(flag('showMustawa'));
    setShowKuliah(flag('showKuliah'));
    setShowPendidikanLainnya(flag('showPendidikanLainnya'));
    setShowPekerjaanAyahLainnya(flag('showPekerjaanAyahLainnya'));
    setShowPekerjaanIbuLainnya(flag('showPekerjaanIbuLainnya'));
    setShowKendaraanDetail(flag('showKendaraanDetail'));
    setShowNominalKiriman(flag('showNominalKiriman'));
    setShowSumberDana(flag('showSumberDana'));
    setShowSumberDanaLainnya(flag('showSumberDanaLainnya'));
    setShowTanggunganDetail(flag('showTanggunganDetail'));
    setShowHutangDetail(flag('showHutangDetail'));
    setShowBeasiswaDetail(flag('showBeasiswaDetail'));
    setShowNominalBeasiswa(flag('showNominalBeasiswa'));
    setShowRokokDetail(flag('showRokokDetail'));
  }, []);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setDraftTimestamp(null);
    lastSavedData.current = '';
    hasRestoredDraft.current = false;
  }, []);

  const handleResetForm = () => {
    if (window.confirm('Apakah Anda yakin ingin mereset semua data yang sudah diisi? Data yang sudah dihapus tidak dapat dikembalikan.')) {
      clearDraft();
      resetFormStates();
      toast.success('Form berhasil direset');
    }
  };

  // ============================================================
  // CONDITIONAL UPDATE FUNCTIONS
  // ============================================================
  const updateConditionalStates = (value: string) => {
    setShowMustawa(value === 'Dauroh Lughoh' || value === "Ma'had");
    setShowKuliah(value === 'Kuliah');
    setShowPendidikanLainnya(value === 'Lainnya');
  };

  const updatePekerjaanAyahState = (value: string) => setShowPekerjaanAyahLainnya(value === 'Lainnya');
  const updatePekerjaanIbuState = (value: string) => setShowPekerjaanIbuLainnya(value === 'Lainnya');
  
  const updateKirimanState = (value: string) => {
    setShowNominalKiriman(value === 'Ya, masih.');
    setShowSumberDana(value === 'Tidak');
  };

  const updateSumberDanaState = (value: string) => setShowSumberDanaLainnya(value === 'Lainnya');
  const updateTanggunganState = (value: string) => setShowTanggunganDetail(value === 'Ya');
  const updateHutangState = (value: string) => setShowHutangDetail(value === 'Ya, ada.');
  
  const updateBeasiswaState = (value: string) => {
    setShowBeasiswaDetail(value === 'Ya');
    if (value !== 'Ya') {
      setStatusBeasiswa('');
      setCakupanBeasiswa('');
      setNominalBeasiswaRaw('');
      setNominalBeasiswa('');
      setShowNominalBeasiswa(false);
    }
  };

  const updateMerokokState = (value: string) => setShowRokokDetail(value === 'Ya');

  const updateJumlahKendaraanState = (value: string) => {
    const num = parseInt(value) || 0;
    setShowKendaraanDetail(num > 0);
    if (num > 0) {
      const newList: Kendaraan[] = [];
      for (let i = 0; i < num; i++) {
        newList.push(kendaraanList[i] || { jenis: '', rincian: '' });
      }
      setKendaraanList(newList);
    } else {
      setKendaraanList([]);
    }
  };

  // ============================================================
  // RESET ALL FORM STATES
  // ============================================================
  const resetFormStates = () => {
    setNamaLengkap(''); setAlmamater(''); setTahunKedatangan('20'); setNoTelpMesir('+20'); setNoWaAktif('+');
    setAlamatMesir(''); setAlamatIndonesia(''); setFotoUrl(''); setFotoFile(null); setFotoPreview('');
    setJenjangPendidikan(''); setMustawaTingkat(''); setNamaFakultas(''); setNamaJurusan('');
    setTingkatKuliah(''); setPendidikanLainnya('');
    setStatusTempatTinggal(''); setBiayaSewa('');
    setPekerjaanAyah(''); setPekerjaanAyahLainnya(''); setPekerjaanIbu(''); setPekerjaanIbuLainnya('');
    setPenghasilanAyah(''); setPenghasilanIbu(''); setAnakKe(''); setAnakDari('');
    setJumlahKendaraan(''); setKendaraanList([]);
    setKirimanOrangtua(''); setNominalKiriman(''); setSumberDanaUtama(''); setSumberDanaLainnya('');
    setNominalPendapatanRaw(''); setNominalPendapatan('');
    setStatusMenikah(''); setPunyaTanggungan(''); setJumlahTanggungan(''); setRincianTanggungan('');
    setPunyaHutang(''); setHutangList([]);
    setPunyaBeasiswa(''); setStatusBeasiswa(''); setCakupanBeasiswa('');
    setNominalBeasiswaRaw(''); setNominalBeasiswa('');
    setMerokok(''); setRokokPerHari('');
    setShowMustawa(false); setShowKuliah(false); setShowPendidikanLainnya(false);
    setShowPekerjaanAyahLainnya(false); setShowPekerjaanIbuLainnya(false);
    setShowKendaraanDetail(false); setShowNominalKiriman(false); setShowSumberDana(false);
    setShowSumberDanaLainnya(false); setShowTanggunganDetail(false); setShowHutangDetail(false);
    setShowBeasiswaDetail(false); setShowNominalBeasiswa(false); setShowRokokDetail(false);
    setShowHutangModal(false);
    setHutangForm({ kepada: '', kekeluargaan: '', nominal: 0, mata_uang: 'EGP', tujuan: '', tujuan_lainnya: '' });
    setHutangFormErrors({});
    setEditingHutangIndex(null);
    setErrors({});
    setWarnings({});
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ============================================================
  // POPULATE EDIT DATA
  // ============================================================
  useEffect(() => {
    if (isOpen && editData) {
      clearDraft();
      
      setNamaLengkap(editData.nama_lengkap || '');
      setAlmamater(editData.almamater || '');
      setTahunKedatangan(editData.tahun_kedatangan?.toString() || '20');
      setNoTelpMesir(editData.no_telp_mesir || '+20');
      setNoWaAktif(editData.no_wa_aktif || '+');
      setAlamatMesir(editData.alamat_mesir || '');
      setAlamatIndonesia(editData.alamat_indonesia || '');
      setFotoUrl(editData.foto_url || '');
      setFotoPreview(editData.foto_url || '');
      setJenjangPendidikan(editData.jenjang_pendidikan || '');
      setMustawaTingkat(editData.mustawa_tingkat || '');
      setNamaFakultas(editData.nama_fakultas || '');
      setNamaJurusan(editData.nama_jurusan || '');
      setTingkatKuliah(editData.tingkat_kuliah || '');
      setPendidikanLainnya(editData.pendidikan_lainnya || '');
      setStatusTempatTinggal(editData.status_tempat_tinggal || '');
      setBiayaSewa(editData.biaya_sewa || '');
      setPekerjaanAyah(editData.pekerjaan_ayah_lainnya ? 'Lainnya' : (editData.pekerjaan_ayah || ''));
      setPekerjaanAyahLainnya(editData.pekerjaan_ayah_lainnya || '');
      setPekerjaanIbu(editData.pekerjaan_ibu_lainnya ? 'Lainnya' : (editData.pekerjaan_ibu || ''));
      setPekerjaanIbuLainnya(editData.pekerjaan_ibu_lainnya || '');
      setPenghasilanAyah(editData.penghasilan_ayah || '');
      setPenghasilanIbu(editData.penghasilan_ibu || '');
      
      if (editData.anak_keberapa) {
        const parts = editData.anak_keberapa.split(' dari ');
        setAnakKe(parts[0] || '');
        setAnakDari(parts[1]?.replace(' bersaudara', '') || '');
      }
      
      setJumlahKendaraan(editData.jumlah_kendaraan?.toString() || '');
      setKendaraanList(editData.kendaraan_list || []);
      setKirimanOrangtua(editData.kiriman_orangtua || '');
      setNominalKiriman(editData.nominal_kiriman || '');
      setSumberDanaUtama(editData.sumber_dana_utama || '');
      setSumberDanaLainnya(editData.sumber_dana_lainnya || '');
      
      if (editData.nominal_pendapatan) {
        const match = editData.nominal_pendapatan.match(/EGP\s*([\d,.]+)/);
        if (match) {
          const raw = match[1].replace(/\D/g, '');
          setNominalPendapatanRaw(raw);
          setNominalPendapatan(formatNominalDisplay(raw));
        }
      }
      
      setStatusMenikah(editData.status_menikah || '');
      setPunyaTanggungan(editData.punya_tanggungan || '');
      setJumlahTanggungan(editData.jumlah_tanggungan?.toString() || '');
      setRincianTanggungan(editData.rincian_tanggungan || '');
      setPunyaHutang(editData.punya_hutang || '');
      setHutangList(editData.hutang_list || []);
      setPunyaBeasiswa(editData.punya_beasiswa || '');
      setStatusBeasiswa(editData.status_beasiswa || '');
      setCakupanBeasiswa(editData.cakupan_beasiswa || '');
      
      if (editData.nominal_beasiswa) {
        const match = editData.nominal_beasiswa.match(/EGP\s*([\d,.]+)/);
        if (match) {
          const raw = match[1].replace(/\D/g, '');
          setNominalBeasiswaRaw(raw);
          setNominalBeasiswa(formatNominalDisplay(raw));
        }
      }
      
      setMerokok(editData.merokok || '');
      setRokokPerHari(editData.rokok_per_hari?.toString() || '');

      updateConditionalStates(editData.jenjang_pendidikan || '');
      updatePekerjaanAyahState(editData.pekerjaan_ayah_lainnya ? 'Lainnya' : (editData.pekerjaan_ayah || ''));
      updatePekerjaanIbuState(editData.pekerjaan_ibu_lainnya ? 'Lainnya' : (editData.pekerjaan_ibu || ''));
      updateKirimanState(editData.kiriman_orangtua || '');
      updateSumberDanaState(editData.sumber_dana_utama || '');
      updateTanggunganState(editData.punya_tanggungan || '');
      updateHutangState(editData.punya_hutang || '');
      updateBeasiswaState(editData.punya_beasiswa || '');
      if (editData.punya_beasiswa === 'Ya') {
        setShowNominalBeasiswa(editData.status_beasiswa === 'Beasiswa Sebagian' && editData.cakupan_beasiswa === 'Mendapatkan Tunjangan Bulanan');
      }
      updateMerokokState(editData.merokok || '');
      updateJumlahKendaraanState(editData.jumlah_kendaraan?.toString() || '');
    }
  }, [isOpen, editData, clearDraft]);

  // ============================================================
  // HUTANG HANDLERS
  // ============================================================
  const validateHutangForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!hutangForm.kepada.trim()) errs.kepada = 'Nama pemberi hutang wajib diisi';
    if (!hutangForm.kekeluargaan) errs.kekeluargaan = 'Hubungan kekeluargaan wajib dipilih';
    if (!hutangForm.nominal || hutangForm.nominal <= 0) errs.nominal = 'Nominal hutang harus lebih dari 0';
    if (!hutangForm.tujuan) errs.tujuan = 'Tujuan hutang wajib dipilih';
    if (hutangForm.tujuan === 'Lainnya' && !hutangForm.tujuan_lainnya?.trim()) errs.tujuan_lainnya = 'Tujuan lainnya wajib diisi';
    setHutangFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const saveHutang = () => {
    if (!validateHutangForm()) return;
    
    if (editingHutangIndex !== null) {
      const newList = [...hutangList];
      newList[editingHutangIndex] = { ...hutangForm };
      setHutangList(newList);
      toast.success('Data hutang berhasil diperbarui');
    } else {
      setHutangList([...hutangList, { ...hutangForm }]);
      toast.success('Data hutang berhasil ditambahkan');
    }
    
    setHutangForm({ kepada: '', kekeluargaan: '', nominal: 0, mata_uang: 'EGP', tujuan: '', tujuan_lainnya: '' });
    setHutangFormErrors({});
    setEditingHutangIndex(null);
    setShowHutangModal(false);
  };

  const editHutang = (index: number) => {
    setHutangForm({ ...hutangList[index] });
    setEditingHutangIndex(index);
    setShowHutangModal(true);
  };

  const removeHutang = (index: number) => {
    if (window.confirm('Hapus data hutang ini?')) {
      setHutangList(hutangList.filter((_, i) => i !== index));
      toast.success('Data hutang berhasil dihapus');
    }
  };

  const cancelHutangForm = () => {
    setHutangForm({ kepada: '', kekeluargaan: '', nominal: 0, mata_uang: 'EGP', tujuan: '', tujuan_lainnya: '' });
    setHutangFormErrors({});
    setEditingHutangIndex(null);
    setShowHutangModal(false);
  };

  // ============================================================
  // KENDARAAN HANDLERS
  // ============================================================
  const updateKendaraan = (index: number, field: keyof Kendaraan, value: string) => {
    const newList = [...kendaraanList];
    newList[index] = { ...newList[index], [field]: value };
    setKendaraanList(newList);
  };

  // ============================================================
  // REAL-TIME WARNING CHECKS
  // ============================================================
  const checkWarnings = useCallback(() => {
    const newWarnings: Record<string, string> = {};
    if (noWaAktif && noWaAktif.length > 1 && !/^\+\d{10,13}$/.test(noWaAktif)) newWarnings.noWaAktif = 'Format: +[kode negara][8-12 digit angka]';
    if (noTelpMesir && noTelpMesir.length > 3 && !/^\+20\d{8,10}$/.test(noTelpMesir)) newWarnings.noTelpMesir = 'Format: +20 diikuti 8-10 digit angka';
    if (tahunKedatangan && tahunKedatangan.length === 4) {
      const year = parseInt(tahunKedatangan);
      if (year < 2000 || year > 2030) newWarnings.tahunKedatangan = 'Tahun kedatangan tidak valid (2000-2030)';
    }
    if (anakKe && anakDari && parseInt(anakKe) > parseInt(anakDari)) newWarnings.anakKe = 'Anak ke- tidak boleh lebih besar dari total bersaudara';
    setWarnings(newWarnings);
  }, [noWaAktif, noTelpMesir, tahunKedatangan, anakKe, anakDari]);

  useEffect(() => { checkWarnings(); }, [checkWarnings]);

  // ============================================================
  // VALIDATION
  // ============================================================
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!namaLengkap.trim()) newErrors.namaLengkap = 'Nama lengkap wajib diisi';
    if (!alamatMesir.trim()) newErrors.alamatMesir = 'Alamat di Mesir wajib diisi';
    if (!alamatIndonesia.trim()) newErrors.alamatIndonesia = 'Alamat di Indonesia wajib diisi';
    if (!noWaAktif || noWaAktif === '+') newErrors.noWaAktif = 'Nomor WhatsApp aktif wajib diisi';
    if (noWaAktif && noWaAktif.length > 1 && !/^\+\d{10,13}$/.test(noWaAktif)) newErrors.noWaAktif = 'Format WhatsApp tidak valid';
    if (noTelpMesir && noTelpMesir.length > 3 && !/^\+20\d{8,10}$/.test(noTelpMesir)) newErrors.noTelpMesir = 'Format nomor Mesir tidak valid';
    if (!tahunKedatangan || tahunKedatangan === '20' || tahunKedatangan.length < 4) newErrors.tahunKedatangan = 'Tahun kedatangan wajib diisi (4 digit)';
    if (!jenjangPendidikan) newErrors.jenjangPendidikan = 'Jenjang pendidikan wajib dipilih';
    if (!statusTempatTinggal) newErrors.statusTempatTinggal = 'Status tempat tinggal wajib dipilih';
    if (statusTempatTinggal === 'Sewa(Bayar)' && !biayaSewa) newErrors.biayaSewa = 'Biaya sewa wajib dipilih';
    if (!pekerjaanAyah) newErrors.pekerjaanAyah = 'Pekerjaan ayah wajib dipilih';
    if (!pekerjaanIbu) newErrors.pekerjaanIbu = 'Pekerjaan ibu wajib dipilih';
    if (!penghasilanAyah) newErrors.penghasilanAyah = 'Penghasilan ayah wajib dipilih';
    if (!penghasilanIbu) newErrors.penghasilanIbu = 'Penghasilan ibu wajib dipilih';
    if (!anakKe || !anakDari) newErrors.anakKe = 'Anak ke- dan dari bersaudara wajib diisi';
    if (!jumlahKendaraan) newErrors.jumlahKendaraan = 'Jumlah kendaraan wajib dipilih';
    if (parseInt(jumlahKendaraan) > 0 && kendaraanList.some(k => !k.jenis || !k.rincian)) {
      newErrors.kendaraan = 'Semua rincian kendaraan wajib diisi lengkap';
    }
    if (!kirimanOrangtua) newErrors.kirimanOrangtua = 'Status kiriman orang tua wajib dipilih';
    if (kirimanOrangtua === 'Ya, masih.' && !nominalKiriman) newErrors.nominalKiriman = 'Nominal kiriman wajib dipilih';
    if (kirimanOrangtua === 'Tidak') {
      if (!sumberDanaUtama) newErrors.sumberDanaUtama = 'Sumber dana utama wajib dipilih';
      if (sumberDanaUtama === 'Lainnya' && !sumberDanaLainnya) newErrors.sumberDanaLainnya = 'Sumber dana lainnya wajib diisi';
      if (!nominalPendapatanRaw) newErrors.nominalPendapatan = 'Nominal pendapatan wajib diisi';
    }
    if (!statusMenikah) newErrors.statusMenikah = 'Status menikah wajib dipilih';
    if (!punyaTanggungan) newErrors.punyaTanggungan = 'Status tanggungan wajib dipilih';
    if (punyaTanggungan === 'Ya') {
      if (!jumlahTanggungan) newErrors.jumlahTanggungan = 'Jumlah tanggungan wajib diisi';
      if (!rincianTanggungan) newErrors.rincianTanggungan = 'Rincian tanggungan wajib diisi';
    }
    if (!punyaHutang) newErrors.punyaHutang = 'Status hutang wajib dipilih';
    if (punyaHutang === 'Ya, ada.' && hutangList.length === 0) newErrors.hutang = 'Minimal satu data hutang wajib ditambahkan';
    if (!punyaBeasiswa) newErrors.punyaBeasiswa = 'Status beasiswa wajib dipilih';
    if (!merokok) newErrors.merokok = 'Status merokok wajib dipilih';
    if (merokok === 'Ya' && !rokokPerHari) newErrors.rokokPerHari = 'Jumlah rokok per hari wajib diisi';
    if (!fotoUrl && !fotoFile) newErrors.foto = 'Foto rumah wajib diunggah';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ============================================================
  // SUBMIT - FIXED
  // ============================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      const firstError = document.querySelector('.text-red-500');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    isSubmitting.current = true;
    setIsLoading(true);

    try {
      await initializeScoringRates();
    } catch (err) {
      console.warn('[MustahiqForm] ⚠️ Gagal inisialisasi kurs:', err);
    }

    const previousFotoUrl = editData?.foto_url || fotoUrl || null;
    let finalFotoUrl = fotoUrl;
    let newlyUploadedUrl: string | null = null;
    if (fotoFile) {
      const uploadedUrl = await uploadImage();
      if (uploadedUrl && uploadedUrl !== previousFotoUrl) {
        finalFotoUrl = uploadedUrl;
        newlyUploadedUrl = uploadedUrl;
      }
    }

    const anakKeberapa = anakKe && anakDari ? `${anakKe} dari ${anakDari} bersaudara` : '';

    try {
      const now = new Date().toISOString();
      let successMessage = '';

      // ==========================================================
      // PARSE SEMUA NOMINAL
      // ==========================================================
      
      let biayaSewaParsed = biayaSewa;
      if (biayaSewa) {
        const parsed = parseNominalDenganMataUang(biayaSewa);
        biayaSewaParsed = parsed.amount.toString();
      }

      let penghasilanAyahParsed = penghasilanAyah;
      if (penghasilanAyah) {
        const parsed = parseNominalDenganMataUang(penghasilanAyah);
        penghasilanAyahParsed = `${parsed.currency} ${parsed.amount}`;
      }

      let penghasilanIbuParsed = penghasilanIbu;
      if (penghasilanIbu) {
        const parsed = parseNominalDenganMataUang(penghasilanIbu);
        penghasilanIbuParsed = `${parsed.currency} ${parsed.amount}`;
      }

      let nominalKirimanParsed = nominalKiriman;
      if (showNominalKiriman && nominalKiriman) {
        const parsed = parseNominalDenganMataUang(nominalKiriman);
        nominalKirimanParsed = `${parsed.currency} ${parsed.amount}`;
      }

      let nominalPendapatanParsed: string | null = null;
      if (showSumberDana && nominalPendapatanRaw) {
        nominalPendapatanParsed = `EGP ${nominalPendapatanRaw}`;
      }

      let nominalBeasiswaParsed: string | null = null;
      if (punyaBeasiswa === 'Ya' && showNominalBeasiswa && nominalBeasiswaRaw) {
        nominalBeasiswaParsed = `EGP ${nominalBeasiswaRaw}`;
      }

      // 🔥 FIX: Konversi null ke undefined untuk MustahiqData
      const tempData: MustahiqData = {
        nama_lengkap: namaLengkap.trim(),
        status_tempat_tinggal: statusTempatTinggal,
        penghasilan_ayah: penghasilanAyahParsed,
        penghasilan_ibu: penghasilanIbuParsed,
        pekerjaan_ayah: showPekerjaanAyahLainnya ? pekerjaanAyahLainnya.trim() : pekerjaanAyah,
        pekerjaan_ibu: showPekerjaanIbuLainnya ? pekerjaanIbuLainnya.trim() : pekerjaanIbu,
        anak_keberapa: anakKeberapa,
        jumlah_kendaraan: parseInt(jumlahKendaraan) || 0,
        kendaraan_list: kendaraanList.length > 0 ? kendaraanList : undefined,
        kiriman_orangtua: kirimanOrangtua,
        nominal_kiriman: nominalKirimanParsed,
        sumber_dana_utama: showSumberDana ? sumberDanaUtama : undefined,
        nominal_pendapatan: nominalPendapatanParsed,
        status_menikah: statusMenikah,
        punya_tanggungan: punyaTanggungan,
        jumlah_tanggungan: punyaTanggungan === 'Ya' ? (parseInt(jumlahTanggungan) || 0) : 0,
        rincian_tanggungan: punyaTanggungan === 'Ya' ? rincianTanggungan.trim() : undefined,
        punya_hutang: punyaHutang,
        hutang_list: hutangList.length > 0 ? hutangList : undefined,
        punya_beasiswa: punyaBeasiswa,
        status_beasiswa: punyaBeasiswa === 'Ya' ? statusBeasiswa : undefined,
        cakupan_beasiswa: punyaBeasiswa === 'Ya' ? cakupanBeasiswa : undefined,
        nominal_beasiswa: nominalBeasiswaParsed,
        merokok: merokok,
        rokok_per_hari: merokok === 'Ya' ? (parseInt(rokokPerHari) || 0) : 0,
      };
      
      const scoreResult = calculateMustahiqScore(tempData);

      const baseData = {
        nama_lengkap: namaLengkap.trim(),
        almamater: almamater.trim() || null,
        tahun_kedatangan: parseInt(tahunKedatangan) || 0,
        no_telp_mesir: noTelpMesir && noTelpMesir !== '+20' ? noTelpMesir.trim() : null,
        no_wa_aktif: noWaAktif.trim(),
        alamat_mesir: alamatMesir.trim(),
        alamat_indonesia: alamatIndonesia.trim(),
        foto_url: finalFotoUrl || null,
        jenjang_pendidikan: jenjangPendidikan || null,
        mustawa_tingkat: showMustawa ? mustawaTingkat.trim() : null,
        nama_fakultas: showKuliah ? namaFakultas.trim() : null,
        nama_jurusan: showKuliah ? namaJurusan.trim() : null,
        tingkat_kuliah: showKuliah ? tingkatKuliah : null,
        pendidikan_lainnya: showPendidikanLainnya ? pendidikanLainnya.trim() : null,
        status_tempat_tinggal: statusTempatTinggal || null,
        biaya_sewa: biayaSewaParsed || null,
        pekerjaan_ayah: showPekerjaanAyahLainnya ? pekerjaanAyahLainnya.trim() : pekerjaanAyah,
        pekerjaan_ayah_lainnya: showPekerjaanAyahLainnya ? pekerjaanAyahLainnya.trim() : null,
        pekerjaan_ibu: showPekerjaanIbuLainnya ? pekerjaanIbuLainnya.trim() : pekerjaanIbu,
        pekerjaan_ibu_lainnya: showPekerjaanIbuLainnya ? pekerjaanIbuLainnya.trim() : null,
        penghasilan_ayah: penghasilanAyahParsed || null,
        penghasilan_ibu: penghasilanIbuParsed || null,
        anak_keberapa: anakKeberapa || null,
        jumlah_kendaraan: parseInt(jumlahKendaraan) || 0,
        kendaraan_list: kendaraanList.length > 0 ? (kendaraanList as unknown as Json) : null,
        kiriman_orangtua: kirimanOrangtua || null,
        nominal_kiriman: nominalKirimanParsed || null,
        sumber_dana_utama: showSumberDana ? sumberDanaUtama : null,
        sumber_dana_lainnya: showSumberDana && sumberDanaUtama === 'Lainnya' ? sumberDanaLainnya.trim() : null,
        nominal_pendapatan: nominalPendapatanParsed || null,
        status_menikah: statusMenikah || null,
        punya_tanggungan: punyaTanggungan || null,
        jumlah_tanggungan: punyaTanggungan === 'Ya' ? (parseInt(jumlahTanggungan) || 0) : 0,
        rincian_tanggungan: punyaTanggungan === 'Ya' ? rincianTanggungan.trim() : null,
        punya_hutang: punyaHutang || null,
        hutang_list: hutangList.length > 0 ? (hutangList as unknown as Json) : null,
        punya_beasiswa: punyaBeasiswa || null,
        status_beasiswa: punyaBeasiswa === 'Ya' ? statusBeasiswa : null,
        cakupan_beasiswa: punyaBeasiswa === 'Ya' ? cakupanBeasiswa : null,
        nominal_beasiswa: nominalBeasiswaParsed || null,
        merokok: merokok || null,
        rokok_per_hari: merokok === 'Ya' ? (parseInt(rokokPerHari) || 0) : 0,
        tahun: new Date().getFullYear().toString(),
        last_modified: now,
        scoring: Math.round(scoreResult.totalScore),
        scoring_details: scoreResult as unknown as Json,
      } satisfies MustahiqUpdate;

      if (editData) {
        const updateData: MustahiqUpdate = {
          ...baseData,
          status_verifikasi: editData.status_verifikasi || 'Proses Survei',
          nominal_diterima: editData.nominal_diterima || 0,
          mata_uang: editData.mata_uang || 'EGP',
          tanggal_distribusi: editData.tanggal_distribusi || getToday(),
          keterangan: editData.keterangan || '',
        };

        const { error } = await supabase
          .from('mustahiq')
          .update(updateData)
          .eq('id', editData.id);

        if (error) {
          console.error('Supabase update error:', error);
          throw new Error(error.message || 'Gagal memperbarui data');
        }
        successMessage = 'Data mustahiq berhasil diperbarui';
      } else {
        const { data: existing, error: existingError } = await supabase
          .from('mustahiq')
          .select('id_mustahiq')
          .order('created_at', { ascending: false })
          .limit(1);

        if (existingError) throw existingError;

        let sequence = 1;
        if (existing && existing.length > 0) {
          const lastNum = parseInt(existing[0].id_mustahiq.split('/').pop() || '0', 10);
          sequence = Number.isFinite(lastNum) ? lastNum + 1 : 1;
        }

        const insertData: MustahiqInsert = {
          ...baseData,
          id_mustahiq: generateIdMustahiq(sequence),
          status_verifikasi: 'Proses Survei',
          nominal_diterima: 0,
          mata_uang: 'EGP',
          tanggal_distribusi: getToday(),
          keterangan: '',
          created_at: now,
        };

        const { error } = await supabase
          .from('mustahiq')
          .insert(insertData);
        
        if (error) {
          console.error('Supabase insert error:', error);
          throw new Error(error.message || 'Gagal menyimpan data baru');
        }
        successMessage = 'Mustahiq baru berhasil ditambahkan';
      }

      if (newlyUploadedUrl && previousFotoUrl && previousFotoUrl.includes('mustahiq-photos')) {
        await deleteOldImage(previousFotoUrl);
      }

      toast.success(successMessage);
      clearDraft();
      resetFormStates();
      onSuccess();
      onClose();
    } catch (error: unknown) {
      if (newlyUploadedUrl) {
        await deleteOldImage(newlyUploadedUrl);
      }
      console.error('Error saving mustahiq:', error);
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui';
      toast.error('Gagal menyimpan data: ' + message);
    } finally {
      setIsLoading(false);
      isSubmitting.current = false;
    }
  };

  const handleClose = () => {
    if (!editData) {
      saveDraftToStorage();
    }
    onClose();
  };

  // ============================================================
  // RENDER - DRAFT INDICATOR
  // ============================================================
  const renderDraftIndicator = () => {
    if (!draftTimestamp) return null;
    const timeDiff = Math.floor((Date.now() - draftTimestamp) / 1000 / 60);
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 flex-shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        <span className="whitespace-nowrap">
          {timeDiff < 1 ? 'Draft tersimpan' : `Saved ${timeDiff} min ago`}
        </span>
      </div>
    );
  };

  // ============================================================
  // RENDER - SECTION HEADER
  // ============================================================
  const SectionHeader = ({ number, title }: { number: string; title: string }) => (
    <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
      <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-brand text-white text-xs sm:text-sm font-bold flex items-center justify-center flex-shrink-0">
        {number}
      </span>
      <h3 className="text-sm sm:text-base lg:text-lg font-bold text-emerald-dark">{title}</h3>
    </div>
  );

  // ============================================================
  // RENDER - HUTANG MODAL
  // ============================================================
  const renderHutangModal = () => (
    <Modal
      isOpen={showHutangModal}
      onClose={cancelHutangForm}
      title={editingHutangIndex !== null ? 'Edit Data Hutang' : 'Tambah Data Hutang'}
      size="md"
    >
      <div className="space-y-5">
        <div className="bg-slate-50 rounded-xl p-4 space-y-4">
          <h4 className="text-sm font-semibold text-slate-600">Informasi Pemberi Hutang</h4>
          
          <Input
            label="Nama Pemberi Hutang"
            value={hutangForm.kepada}
            onChange={(e) => setHutangForm({ ...hutangForm, kepada: e.target.value })}
            placeholder="Masukkan nama pemberi hutang"
            error={hutangFormErrors.kepada}
            required
          />
          
          <Select
            label="Hubungan Kekeluargaan"
            value={hutangForm.kekeluargaan}
            onChange={(e) => setHutangForm({ ...hutangForm, kekeluargaan: e.target.value })}
            options={KEKELUARGAAN_OPTIONS.map((k) => ({ value: k, label: k }))}
            placeholder="Pilih hubungan kekeluargaan"
            error={hutangFormErrors.kekeluargaan}
            required
          />
        </div>

        <div className="bg-slate-50 rounded-xl p-4 space-y-4">
          <h4 className="text-sm font-semibold text-slate-600">Detail Hutang</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nominal Hutang"
              type="number"
              value={hutangForm.nominal || ''}
              onChange={(e) => setHutangForm({ ...hutangForm, nominal: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              error={hutangFormErrors.nominal}
              required            />
            <Select
              label="Mata Uang"
              value={hutangForm.mata_uang}
              onChange={(e) => setHutangForm({ ...hutangForm, mata_uang: e.target.value })}
              options={MATA_UANG_OPTIONS.map((m) => ({ value: m, label: m }))}
            />
          </div>
          
          <Select
            label="Tujuan Hutang"
            value={hutangForm.tujuan}
            onChange={(e) => setHutangForm({ ...hutangForm, tujuan: e.target.value })}
            options={TUJUAN_HUTANG_OPTIONS.map((t) => ({ value: t, label: t }))}
            placeholder="Pilih tujuan hutang"
            error={hutangFormErrors.tujuan}
            required
          />
          
          {hutangForm.tujuan === 'Lainnya' && (
            <Input
              label="Jelaskan Tujuan Lainnya"
              value={hutangForm.tujuan_lainnya || ''}
              onChange={(e) => setHutangForm({ ...hutangForm, tujuan_lainnya: e.target.value })}
              placeholder="Sebutkan tujuan lainnya"
              error={hutangFormErrors.tujuan_lainnya}
              required
            />
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={cancelHutangForm} className="flex-1">
            Batal
          </Button>
          <Button type="button" onClick={saveHutang} className="flex-1">
            {editingHutangIndex !== null ? 'Perbarui' : 'Simpan'}
          </Button>
        </div>
      </div>
    </Modal>
  );

  // ============================================================
  // RENDER - MAIN FORM
  // ============================================================
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center justify-between w-full gap-3">
          <span className="text-sm sm:text-base truncate">
            {editData ? 'Edit Data Mustahiq' : 'Form Pendaftaran Mustahiq'}
          </span>
          {!editData && renderDraftIndicator()}
        </div>
      }
      size="full"
    >
      <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 sm:px-1">
        {/* SECTION 1: DATA DIRI & IDENTITAS */}
        <Card padding="lg" className="!p-3 sm:!p-5 lg:!p-6">
          <SectionHeader number="1" title="Data Diri & Identitas" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Nama Lengkap"
                value={namaLengkap}
                onChange={handleNamaLengkapChange}
                placeholder="Masukkan nama lengkap"
                error={errors.namaLengkap}
                required
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Huruf pertama setiap kata otomatis kapital</p>
            </div>
            <div className="sm:col-span-2">
              <Input
                label="Almamater"
                value={almamater}
                onChange={(e) => setAlmamater(e.target.value)}
                placeholder="Asal universitas/sekolah (format bebas)"
              />
            </div>
            <Input
              label="Tahun Kedatangan"
              type="text"
              inputMode="numeric"
              value={tahunKedatangan}
              onChange={handleTahunKedatanganChange}
              placeholder="20XX"
              maxLength={4}
              error={errors.tahunKedatangan}
              required
            />
            <Input
              label="No. Telp Seluler Mesir"
              type="text"
              inputMode="tel"
              value={noTelpMesir}
              onChange={handleNoTelpMesirChange}
              placeholder="+20123456789"
              maxLength={13}
              error={errors.noTelpMesir}
            />
            <Input
              label="No. WhatsApp Aktif"
              type="text"
              inputMode="tel"
              value={noWaAktif}
              onChange={handleNoWaChange}
              placeholder="+20123456789"
              maxLength={14}
              error={errors.noWaAktif}
              required
            />
            <div className="sm:col-span-2">
              <Input
                label="Alamat Rumah di Mesir"
                value={alamatMesir}
                onChange={(e) => setAlamatMesir(e.target.value)}
                placeholder="No. Imaroh, No. Syaqqoh, Jalan, Distrik, Provinsi"
                error={errors.alamatMesir}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Input
                label="Alamat Rumah di Indonesia"
                value={alamatIndonesia}
                onChange={(e) => setAlamatIndonesia(e.target.value)}
                placeholder="Blok, RT/RW, Jalan, Desa/Kampung, Kecamatan, Kabupaten/Kota, Provinsi"
                error={errors.alamatIndonesia}
                required
              />
            </div>
            
            {/* UPLOAD FOTO */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-emerald-dark mb-1.5">
                Foto Rumah di Indonesia (Tampak Luar) <span className="text-red-500">*</span>
              </label>
              
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full sm:w-auto justify-center text-sm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Pilih Foto
                  </Button>
                  
                  {fotoFile && (
                    <span className="text-xs text-slate-500 truncate">
                      {fotoFile.name} ({(fotoFile.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                {fotoPreview ? (
                  <div className="relative w-full rounded-xl overflow-hidden border-2 border-dashed border-emerald-200 bg-slate-50">
                    <img
                      src={fotoPreview}
                      alt="Preview foto rumah"
                      className="w-full h-auto max-h-96 object-contain bg-slate-50"
                    />
                    
                    <div className="absolute bottom-3 right-3 bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
                      Akan dikompres max 500KB
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setFotoFile(null);
                        setFotoPreview('');
                        setFotoUrl('');
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      className="absolute top-3 right-3 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ) : fotoUrl ? (
                  <div className="relative w-full rounded-xl overflow-hidden border-2 border-slate-200 bg-slate-50">
                    <img
                      src={fotoUrl}
                      alt="Foto rumah"
                      className="w-full h-auto max-h-96 object-contain bg-slate-50"
                    />
                  </div>
                ) : (
                  <div className="w-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-16 flex flex-col items-center justify-center">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-300 mb-3">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <p className="text-sm text-slate-400 mb-1">Belum ada foto</p>
                    <p className="text-xs text-slate-300">Klik Pilih Foto untuk upload</p>
                    <p className="text-xs text-slate-300 mt-1">Foto rumah tampak luar (wajib)</p>
                  </div>
                )}
              </div>
              
              {errors.foto && <p className="text-xs text-red-500 mt-1">{errors.foto}</p>}
              
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                Format JPG/PNG/WebP, max 20MB (dikompres otomatis)
              </div>
            </div>
          </div>
        </Card>

        {/* SECTION 2: AKADEMIK & PENDIDIKAN */}
        <Card padding="lg" className="!p-3 sm:!p-5 lg:!p-6">
          <SectionHeader number="2" title="Akademik & Pendidikan" />
          <div className="space-y-4">
            <Select
              label="Jenjang Pendidikan"
              value={jenjangPendidikan}
              onChange={(e) => {
                const value = e.target.value;
                setJenjangPendidikan(value);
                updateConditionalStates(value);
              }}
              options={JENJANG_PENDIDIKAN_OPTIONS.map((j) => ({ value: j, label: j }))}
              placeholder="Pilih jenjang pendidikan"
              error={errors.jenjangPendidikan}
              required
            />

            {showMustawa && (
              <Input
                label="Mustawa / Tingkat"
                value={mustawaTingkat}
                onChange={(e) => setMustawaTingkat(e.target.value)}
                placeholder="Contoh: Mustawa 1"
                required
              />
            )}

            {showKuliah && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Nama Fakultas" value={namaFakultas} onChange={(e) => setNamaFakultas(e.target.value)} placeholder="Fakultas Syariah" required />
                <Input label="Nama Jurusan" value={namaJurusan} onChange={(e) => setNamaJurusan(e.target.value)} placeholder="Jurusan/Prodi" required />
                <Select
                  label="Tingkat"
                  value={tingkatKuliah}
                  onChange={(e) => setTingkatKuliah(e.target.value)}
                  options={TINGKAT_KULIAH_OPTIONS.map((t) => ({ value: t, label: t }))}
                  placeholder="Pilih tingkat"
                  required
                />
              </div>
            )}

            {showPendidikanLainnya && (
              <Input
                label="Pendidikan Lainnya"
                value={pendidikanLainnya}
                onChange={(e) => setPendidikanLainnya(e.target.value)}
                placeholder="Sebutkan pendidikan lainnya"
                required
              />
            )}
          </div>
        </Card>

        {/* SECTION 3: DOMISILI & TEMPAT TINGGAL */}
        <Card padding="lg" className="!p-3 sm:!p-5 lg:!p-6">
          <SectionHeader number="3" title="Domisili & Tempat Tinggal" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Status Tempat Tinggal di Mesir"
              value={statusTempatTinggal}
              onChange={(e) => setStatusTempatTinggal(e.target.value)}
              options={STATUS_TEMPAT_TINGGAL_OPTIONS.map((s) => ({ value: s, label: s }))}
              placeholder="Pilih status"
              error={errors.statusTempatTinggal}
              required
            />
            {statusTempatTinggal === 'Sewa(Bayar)' && (
              <Select
                label="Biaya Sewa Tempat Tinggal (EGP)"
                value={biayaSewa}
                onChange={(e) => setBiayaSewa(e.target.value)}
                options={BIAYA_SEWA_OPTIONS.map((b) => ({ value: b, label: b }))}
                placeholder="Pilih biaya sewa"
                error={errors.biayaSewa}
                required
              />
            )}
          </div>
        </Card>

        {/* SECTION 4: DATA ORANG TUA & ASET KELUARGA */}
        <Card padding="lg" className="!p-3 sm:!p-5 lg:!p-6">
          <SectionHeader number="4" title="Data Orang Tua & Aset Keluarga" />
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Select
                  label="Pekerjaan Ayah"
                  value={pekerjaanAyah}
                  onChange={(e) => { setPekerjaanAyah(e.target.value); updatePekerjaanAyahState(e.target.value); }}
                  options={PEKERJAAN_AYAH_OPTIONS.map((p) => ({ value: p, label: p }))}
                  placeholder="Pilih pekerjaan ayah"
                  error={errors.pekerjaanAyah}
                  required
                />
                {showPekerjaanAyahLainnya && (
                  <div className="mt-2">
                    <Input
                      label="Sebutkan Pekerjaan Ayah"
                      value={pekerjaanAyahLainnya}
                      onChange={(e) => setPekerjaanAyahLainnya(e.target.value)}
                      placeholder="Sebutkan pekerjaan ayah"
                      required
                    />
                  </div>
                )}
              </div>
              <div>
                <Select
                  label="Pekerjaan Ibu"
                  value={pekerjaanIbu}
                  onChange={(e) => { setPekerjaanIbu(e.target.value); updatePekerjaanIbuState(e.target.value); }}
                  options={PEKERJAAN_IBU_OPTIONS.map((p) => ({ value: p, label: p }))}
                  placeholder="Pilih pekerjaan ibu"
                  error={errors.pekerjaanIbu}
                  required
                />
                {showPekerjaanIbuLainnya && (
                  <div className="mt-2">
                    <Input
                      label="Sebutkan Pekerjaan Ibu"
                      value={pekerjaanIbuLainnya}
                      onChange={(e) => setPekerjaanIbuLainnya(e.target.value)}
                      placeholder="Sebutkan pekerjaan ibu"
                      required
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Range Penghasilan Ayah"
                value={penghasilanAyah}
                onChange={(e) => setPenghasilanAyah(e.target.value)}
                options={PENGHASILAN_OPTIONS.map((p) => ({ value: p, label: p }))}
                placeholder="Pilih range penghasilan"
                error={errors.penghasilanAyah}
                required
              />
              <Select
                label="Range Penghasilan Ibu"
                value={penghasilanIbu}
                onChange={(e) => setPenghasilanIbu(e.target.value)}
                options={PENGHASILAN_OPTIONS.map((p) => ({ value: p, label: p }))}
                placeholder="Pilih range penghasilan"
                error={errors.penghasilanIbu}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-emerald-dark mb-1.5">
                Anak ke- <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="number"
                  value={anakKe}
                  onChange={(e) => setAnakKe(e.target.value)}
                  placeholder="1"
                  className="w-20"
                />
                <span className="text-sm text-slate-500">dari</span>
                <Input
                  type="number"
                  value={anakDari}
                  onChange={(e) => setAnakDari(e.target.value)}
                  placeholder="5"
                  className="w-20"
                />
                <span className="text-sm text-slate-500">bersaudara</span>
              </div>
              {errors.anakKe && <p className="mt-1 text-xs text-red-500">{errors.anakKe}</p>}
              {warnings.anakKe && <p className="mt-1 text-xs text-amber-600">{warnings.anakKe}</p>}
            </div>

            <div className="space-y-3">
              <Select
                label="Jumlah Kendaraan Orang Tua di Indonesia"
                value={jumlahKendaraan}
                onChange={(e) => { setJumlahKendaraan(e.target.value); updateJumlahKendaraanState(e.target.value); }}
                options={JUMLAH_KENDARAAN_OPTIONS.map((j) => ({ value: j, label: j }))}
                placeholder="Pilih jumlah kendaraan"
                error={errors.jumlahKendaraan}
                required
              />

              {showKendaraanDetail && (
                <div className="space-y-3 bg-slate-50/80 p-3 sm:p-4 rounded-xl border border-slate-200">
                  <p className="text-sm font-semibold text-slate-600">Rincian Kendaraan</p>
                  {kendaraanList.map((k, index) => (
                    <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-white rounded-lg border border-slate-200">
                      <p className="text-xs font-medium text-slate-400 sm:col-span-2">Kendaraan {index + 1}</p>
                      <Select
                        label="Jenis"
                        value={k.jenis}
                        onChange={(e) => updateKendaraan(index, 'jenis', e.target.value)}
                        options={JENIS_KENDARAAN_OPTIONS.map((j) => ({ value: j, label: j }))}
                        placeholder="Pilih jenis"
                      />
                      <Input
                        label="Tipe Spesifik"
                        value={k.rincian}
                        onChange={(e) => updateKendaraan(index, 'rincian', e.target.value)}
                        placeholder="Honda Beat 2018"
                      />
                    </div>
                  ))}
                  {errors.kendaraan && <p className="text-xs text-red-500">{errors.kendaraan}</p>}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* SECTION 5: FINANSIAL & PENDAPATAN */}
        <Card padding="lg" className="!p-3 sm:!p-5 lg:!p-6">
          <SectionHeader number="5" title="Finansial & Pendapatan" />
          <div className="space-y-4">
            <Select
              label="Apakah Orang tua/Keluarga Masih Mengirimkan Uang Setiap Bulan?"
              value={kirimanOrangtua}
              onChange={(e) => { setKirimanOrangtua(e.target.value); updateKirimanState(e.target.value); }}
              options={KIRIMAN_ORANGTUA_OPTIONS.map((k) => ({ value: k, label: k }))}
              placeholder="Pilih status"
              error={errors.kirimanOrangtua}
              required
            />

            {showNominalKiriman && (
              <Select
                label="Nominal Kiriman"
                value={nominalKiriman}
                onChange={(e) => setNominalKiriman(e.target.value)}
                options={NOMINAL_KIRIMAN_OPTIONS.map((n) => ({ value: n, label: n }))}
                placeholder="Pilih nominal kiriman"
                error={errors.nominalKiriman}
                required
              />
            )}

            {showSumberDana && (
              <div className="space-y-4 bg-slate-50/80 p-3 sm:p-4 rounded-xl border border-slate-200">
                <Select
                  label="Sumber Pendanaan Utama"
                  value={sumberDanaUtama}
                  onChange={(e) => { setSumberDanaUtama(e.target.value); setShowSumberDanaLainnya(e.target.value === 'Lainnya'); }}
                  options={SUMBER_DANA_OPTIONS.map((s) => ({ value: s, label: s }))}
                  placeholder="Pilih sumber dana"
                  error={errors.sumberDanaUtama}
                  required
                />
                {showSumberDanaLainnya && (
                  <Input
                    label="Sumber Dana Lainnya"
                    value={sumberDanaLainnya}
                    onChange={(e) => setSumberDanaLainnya(e.target.value)}
                    placeholder="Sebutkan sumber dana lainnya"
                    error={errors.sumberDanaLainnya}
                    required
                  />
                )}
                <div>
                  <label className="block text-sm font-semibold text-emerald-dark mb-1.5">
                    Nominal Pendapatan per Bulan <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <span className="text-sm text-slate-400 font-medium">EGP</span>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={nominalPendapatan}
                      onChange={handleNominalPendapatanChange}
                      placeholder="0"
                      className={`w-full bg-white/70 backdrop-blur-sm border rounded-xl pl-12 pr-16 py-2.5 text-sm text-emerald-dark focus:outline-none focus:ring-2 focus:ring-emerald-brand/30 focus:border-emerald-brand transition-all ${errors.nominalPendapatan ? 'border-red-300' : 'border-glass-emerald'}`}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <span className="text-sm text-slate-400">/bulan</span>
                    </div>
                  </div>
                  {errors.nominalPendapatan && <p className="mt-1 text-xs text-red-500">{errors.nominalPendapatan}</p>}
                  {nominalPendapatanRaw && (
                    <p className="mt-1 text-xs text-slate-400">
                      Tersimpan: <span className="font-medium text-emerald-brand">EGP {Number(nominalPendapatanRaw).toLocaleString('id-ID')}/bulan</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* SECTION 6: TANGGUNGAN, HUTANG & BEASISWA */}
        <Card padding="lg" className="!p-3 sm:!p-5 lg:!p-6">
          <SectionHeader number="6" title="Tanggungan, Hutang & Beasiswa" />
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Status Menikah"
                value={statusMenikah}
                onChange={(e) => setStatusMenikah(e.target.value)}
                options={STATUS_MENIKAH_OPTIONS.map((s) => ({ value: s, label: s }))}
                placeholder="Pilih status"
                error={errors.statusMenikah}
                required
              />
              <Select
                label="Apakah ada Jiwa yang Ditanggung?"
                value={punyaTanggungan}
                onChange={(e) => { setPunyaTanggungan(e.target.value); updateTanggunganState(e.target.value); }}
                options={YA_TIDAK_OPTIONS.map((y) => ({ value: y, label: y }))}
                placeholder="Pilih"
                error={errors.punyaTanggungan}
                required
              />
            </div>

            {showTanggunganDetail && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 p-3 sm:p-4 rounded-xl border border-slate-200">
                <Input label="Berapa jiwa?" type="number" min="1" max="10" value={jumlahTanggungan} onChange={(e) => setJumlahTanggungan(e.target.value)} placeholder="1-10" error={errors.jumlahTanggungan} required />
                <div className="sm:col-span-2">
                  <Input label="Rincian Jiwa yang Ditanggung" value={rincianTanggungan} onChange={(e) => setRincianTanggungan(e.target.value)} placeholder="Contoh: 1 istri, 1 anak laki-laki umur 10 thn" error={errors.rincianTanggungan} required />
                </div>
              </div>
            )}

            <Select
              label="Apakah Anda Punya Hutang?"
              value={punyaHutang}
              onChange={(e) => { setPunyaHutang(e.target.value); updateHutangState(e.target.value); }}
              options={YA_TIDAK_HUTANG_OPTIONS.map((y) => ({ value: y, label: y }))}
              placeholder="Pilih"
              error={errors.punyaHutang}
              required
            />

            {showHutangDetail && (
              <div className="space-y-3 bg-slate-50/80 p-3 sm:p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm font-semibold text-slate-600">
                    Daftar Hutang ({hutangList.length})
                  </p>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setEditingHutangIndex(null);
                      setHutangForm({ kepada: '', kekeluargaan: '', nominal: 0, mata_uang: 'EGP', tujuan: '', tujuan_lainnya: '' });
                      setShowHutangModal(true);
                    }}
                  >
                    + Tambah Hutang
                  </Button>
                </div>

                {hutangList.length > 0 ? (
                  <div className="space-y-2">
                    {hutangList.map((h, index) => (
                      <div key={index} className="bg-white rounded-lg border border-slate-200 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="text-sm font-semibold text-emerald-dark truncate">
                                {h.kepada}
                              </h5>
                              <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full flex-shrink-0">
                                {h.kekeluargaan}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                              <span>{h.tujuan === 'Lainnya' ? h.tujuan_lainnya : h.tujuan}</span>
                            </div>
                            <p className="text-sm font-bold text-emerald-brand">
                              {formatCurrency(h.nominal, h.mata_uang)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => editHutang(index)}
                              className="p-1.5 text-slate-400 hover:text-emerald-brand hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeHutang(index)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-slate-100 flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-400">Belum ada data hutang</p>
                    <p className="text-xs text-slate-300 mt-1">Klik tombol di atas untuk menambahkan</p>
                  </div>
                )}
                {errors.hutang && <p className="text-xs text-red-500">{errors.hutang}</p>}
              </div>
            )}

            <Select
              label="Apakah Kamu Mendapatkan Beasiswa?"
              value={punyaBeasiswa}
              onChange={(e) => { setPunyaBeasiswa(e.target.value); updateBeasiswaState(e.target.value); }}
              options={YA_TIDAK_OPTIONS.map((y) => ({ value: y, label: y }))}
              placeholder="Pilih"
              error={errors.punyaBeasiswa}
              required
            />

            {showBeasiswaDetail && (
              <div className="space-y-4 bg-slate-50/80 p-3 sm:p-4 rounded-xl border border-slate-200">
                <Select
                  label="Status Beasiswa"
                  value={statusBeasiswa}
                  onChange={(e) => { setStatusBeasiswa(e.target.value); setShowNominalBeasiswa(e.target.value === 'Beasiswa Sebagian'); }}
                  options={STATUS_BEASISWA_OPTIONS.map((s) => ({ value: s, label: s }))}
                  placeholder="Pilih status beasiswa"
                />
                {statusBeasiswa === 'Beasiswa Sebagian' && (
                  <Select
                    label="Cakupan Beasiswa"
                    value={cakupanBeasiswa}
                    onChange={(e) => setCakupanBeasiswa(e.target.value)}
                    options={CAKUPAN_BEASISWA_OPTIONS.map((c) => ({ value: c, label: c }))}
                    placeholder="Pilih cakupan beasiswa"
                  />
                )}
                {showNominalBeasiswa && (
                  <div>
                    <label className="block text-sm font-semibold text-emerald-dark mb-1.5">
                      Nominal Tunjangan Beasiswa per Bulan
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <span className="text-sm text-slate-400 font-medium">EGP</span>
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={nominalBeasiswa}
                        onChange={handleNominalBeasiswaChange}
                        placeholder="0"
                        className="w-full bg-white/70 backdrop-blur-sm border border-glass-emerald rounded-xl pl-12 pr-16 py-2.5 text-sm text-emerald-dark focus:outline-none focus:ring-2 focus:ring-emerald-brand/30 focus:border-emerald-brand transition-all"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <span className="text-sm text-slate-400">/bulan</span>
                      </div>
                    </div>
                    {nominalBeasiswaRaw && (
                      <p className="mt-1 text-xs text-slate-400">
                        Tersimpan: <span className="font-medium text-emerald-brand">EGP {Number(nominalBeasiswaRaw).toLocaleString('id-ID')}/bulan</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* SECTION 7: GAYA HIDUP */}
        <Card padding="lg" className="!p-3 sm:!p-5 lg:!p-6">
          <SectionHeader number="7" title="Gaya Hidup" />
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Apakah kamu merokok?"
                value={merokok}
                onChange={(e) => { setMerokok(e.target.value); updateMerokokState(e.target.value); }}
                options={MEROKOK_OPTIONS.map((m) => ({ value: m, label: m }))}
                placeholder="Pilih"
                error={errors.merokok}
                required
              />
              {showRokokDetail && (
                <Input
                  label="Berapa bungkus rokok sehari?"
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={rokokPerHari}
                  onChange={(e) => setRokokPerHari(e.target.value)}
                  placeholder="1"
                  error={errors.rokokPerHari}
                  required
                />
              )}
            </div>
          </div>
        </Card>

        {/* ACTION BUTTONS */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 sm:px-4 pt-3 pb-2 sm:pb-3 z-10">
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
            <div className="flex gap-2 w-full sm:w-auto">
              {!editData && (
                <Button type="button" variant="danger" onClick={handleResetForm} className="flex-1 sm:flex-none text-xs sm:text-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                  Reset
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={handleClose} className="flex-1 sm:flex-none text-xs sm:text-sm">
                Batal
              </Button>
            </div>
            <Button type="submit" isLoading={isLoading || isUploading} className="w-full sm:w-auto text-sm font-semibold">
              {editData ? 'Simpan Perubahan' : 'Tambah Mustahiq'}
            </Button>
          </div>
        </div>
      </form>

      {renderHutangModal()}
    </Modal>
  );
};