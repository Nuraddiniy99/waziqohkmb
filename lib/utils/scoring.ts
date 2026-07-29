// lib/utils/scoring.ts

import { supabase } from '@/lib/supabase/client';
import { MustahiqData, ExchangeRates as ExchangeRatesType } from '@/types';
import type { Database } from '@/lib/supabase/types';
import { parseLocalizedNumber } from './currency';

// 🔥 Gunakan type dari types/index.ts
export type { ExchangeRatesType as ExchangeRates };

// ============================================================
// KONSTANTA
// ============================================================
const BIAYA_HIDUP_POKOK_MESIR_PERBULAN = 2000;

// ============================================================
// ESTIMASI NILAI ASET KENDARAAN
// ============================================================
const ESTIMASI_NILAI_KENDARAAN: Record<string, number> = {
  'Sepeda Motor': 5000,
  'Mobil': 15000,
  'Truck / Pickup': 25000,
  'Lainnya': 5000,
};

// ============================================================
// KURS FALLBACK
// ============================================================
const FALLBACK_RATES = {
  USD_TO_EGP: 48.5,
  IDR_TO_EGP: 0.00285,
  EGP_TO_IDR: 350.88,
};

let cachedRates: ExchangeRatesType | null = null;
let cachedAt = 0;
let initPromise: Promise<ExchangeRatesType> | null = null;
const RATE_CACHE_DURATION = 6 * 60 * 60 * 1000;

// ============================================================
// 🔥 FUNGSI GET RATES DARI DATABASE
// ============================================================
const getRatesFromDatabase = async (): Promise<ExchangeRatesType | null> => {
  try {
    console.log('[Scoring] 🔍 Ambil kurs dari database...');
    
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('[Scoring] ❌ Gagal ambil kurs dari database:', error);
      return null;
    }

    if (data && data.length > 0) {
      const row: Database['public']['Tables']['exchange_rates']['Row'] = data[0];
      console.log('[Scoring] ✅ Kurs dari database:', {
        USD_TO_EGP: row.usd_to_egp,
        IDR_TO_EGP: row.idr_to_egp,
        EGP_TO_IDR: row.egp_to_idr,
      });
      return {
        USD_TO_EGP: Number(row.usd_to_egp),
        IDR_TO_EGP: Number(row.idr_to_egp),
        EGP_TO_IDR: Number(row.egp_to_idr),
        lastUpdated: new Date(row.updated_at),
        isFallback: row.is_fallback || false,
      };
    }
    console.log('[Scoring] ⚠️ Tidak ada data kurs di database');
    return null;
  } catch (error) {
    console.warn('[Scoring] ❌ Error get rates from DB:', error);
    return null;
  }
};

// ============================================================
// 🔥 SIMPAN KURS KE DATABASE
// ============================================================
const saveRatesToDatabase = async (rates: ExchangeRatesType, isFallback: boolean = false): Promise<void> => {
  console.log('[Scoring] 💾 ========================================');
  console.log('[Scoring] 💾 SAVE/UPDATE TO DATABASE');
  console.log('[Scoring] 💾 ========================================');
  
  try {
    const { data: existing, error: checkError } = await supabase
      .from('exchange_rates')
      .select('id')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (checkError) {
      console.error('[Scoring] ❌ Gagal cek data existing:', checkError);
    }

    const dataToSave: Database['public']['Tables']['exchange_rates']['Insert'] = {
      usd_to_egp: rates.USD_TO_EGP,
      idr_to_egp: rates.IDR_TO_EGP,
      egp_to_idr: rates.EGP_TO_IDR,
      is_fallback: isFallback,
      source: isFallback ? 'fallback' : 'api',
      updated_at: rates.lastUpdated.toISOString(),
    };

    console.log('[Scoring] 📊 Data yang akan disimpan:');
    console.log(`[Scoring]   usd_to_egp: ${dataToSave.usd_to_egp}`);
    console.log(`[Scoring]   idr_to_egp: ${dataToSave.idr_to_egp}`);
    console.log(`[Scoring]   egp_to_idr: ${dataToSave.egp_to_idr}`);
    console.log(`[Scoring]   is_fallback: ${dataToSave.is_fallback}`);

    if (existing && existing.length > 0) {
      const { error } = await supabase
        .from('exchange_rates')
        .update(dataToSave)
        .eq('id', existing[0].id);
      if (error) {
        console.error('[Scoring] ❌ Gagal update:', error);
      } else {
        console.log('[Scoring] ✅ Data berhasil diUPDATE!');
      }
    } else {
      const { error } = await supabase
        .from('exchange_rates')
        .insert(dataToSave);
      if (error) {
        console.error('[Scoring] ❌ Gagal insert:', error);
      } else {
        console.log('[Scoring] ✅ Data berhasil diINSERT!');
      }
    }
  } catch (error) {
    console.error('[Scoring] ❌ Error save rates to DB:', error);
  }
  
  console.log('[Scoring] 💾 ========================================');
};

// ============================================================
// FETCH KURS DARI API - REALTIME
// ============================================================
interface FrankfurterRateResponse {
  rate?: unknown;
  date?: unknown;
}

interface OpenExchangeResponse {
  rates?: {
    USD?: unknown;
    IDR?: unknown;
  };
  time_last_update_utc?: unknown;
}

const fetchJsonWithTimeout = async <T>(url: string, timeoutMs = 8_000): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json() as T;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const asPositiveNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const createRates = (
  egpToUsd: number,
  egpToIdr: number,
  updatedAt: unknown,
): ExchangeRatesType => ({
  USD_TO_EGP: Number((1 / egpToUsd).toFixed(4)),
  IDR_TO_EGP: Number((1 / egpToIdr).toFixed(6)),
  EGP_TO_IDR: Number(egpToIdr.toFixed(2)),
  lastUpdated: typeof updatedAt === 'string' && !Number.isNaN(Date.parse(updatedAt))
    ? new Date(updatedAt)
    : new Date(),
  isFallback: false,
});

const fetchRatesFromProviders = async (): Promise<ExchangeRatesType> => {
  try {
    const [usdData, idrData] = await Promise.all([
      fetchJsonWithTimeout<FrankfurterRateResponse>('https://api.frankfurter.dev/v2/rate/EGP/USD'),
      fetchJsonWithTimeout<FrankfurterRateResponse>('https://api.frankfurter.dev/v2/rate/EGP/IDR'),
    ]);

    const usdRate = asPositiveNumber(usdData.rate);
    const idrRate = asPositiveNumber(idrData.rate);
    if (!usdRate || !idrRate) throw new Error('Format kurs Frankfurter tidak valid');

    return createRates(usdRate, idrRate, usdData.date);
  } catch (primaryError) {
    console.warn('[Scoring] Frankfurter gagal, mencoba penyedia cadangan:', primaryError);

    const fallbackData = await fetchJsonWithTimeout<OpenExchangeResponse>(
      'https://open.er-api.com/v6/latest/EGP',
    );
    const usdRate = asPositiveNumber(fallbackData.rates?.USD);
    const idrRate = asPositiveNumber(fallbackData.rates?.IDR);
    if (!usdRate || !idrRate) throw new Error('Format kurs OpenER tidak valid');

    return createRates(usdRate, idrRate, fallbackData.time_last_update_utc);
  }
};

const loadExchangeRates = async (): Promise<ExchangeRatesType> => {
  try {
    const rates = await fetchRatesFromProviders();
    cachedRates = rates;
    cachedAt = Date.now();
    await saveRatesToDatabase(rates, false);
    return rates;
  } catch (providerError) {
    console.warn('[Scoring] Semua penyedia kurs gagal:', providerError);

    const databaseRates = await getRatesFromDatabase();
    if (databaseRates) {
      cachedRates = databaseRates;
      cachedAt = Date.now();
      return databaseRates;
    }

    const hardcoded: ExchangeRatesType = {
      ...FALLBACK_RATES,
      lastUpdated: new Date(),
      isFallback: true,
    };
    cachedRates = hardcoded;
    cachedAt = Date.now();
    return hardcoded;
  }
};

export const fetchExchangeRates = async (): Promise<ExchangeRatesType> => {
  if (cachedRates && Date.now() - cachedAt < RATE_CACHE_DURATION) return cachedRates;
  if (initPromise) return initPromise;

  initPromise = loadExchangeRates();
  try {
    return await initPromise;
  } finally {
    initPromise = null;
  }
};

// ============================================================
// 🔥 FORCE UPDATE KURS - REALTIME
// ============================================================
export const forceUpdateRates = async (): Promise<ExchangeRatesType> => {
  console.log('[Scoring] 🔄 ========================================');
  console.log('[Scoring] 🔄 FORCE UPDATE - REALTIME');
  console.log('[Scoring] 🔄 ========================================');
  
  cachedRates = null;
  cachedAt = 0;
  initPromise = null;
  const rates = await fetchExchangeRates();
  
  console.log('[Scoring] ✅ ========================================');
  console.log('[Scoring] ✅ FORCE UPDATE SELESAI!');
  console.log(`[Scoring] ✅  1 USD = ${rates.USD_TO_EGP} EGP`);
  console.log(`[Scoring] ✅  1 IDR = ${rates.IDR_TO_EGP} EGP`);
  console.log(`[Scoring] ✅  1 EGP = ${rates.EGP_TO_IDR} IDR`);
  console.log(`[Scoring] ✅  isFallback: ${rates.isFallback}`);
  console.log('[Scoring] ✅ ========================================');
  
  return rates;
};

// ============================================================
// INISIALISASI - AMBIL DATA REALTIME
// ============================================================
export const initializeScoringRates = async (): Promise<void> => {
  try {
    console.log('[Scoring] 🚀 Inisialisasi kurs...');
    const rates = await fetchExchangeRates();
    console.log('[Scoring] ✅ Rates siap digunakan:', rates);
    console.log(`[Scoring]   1 USD = ${rates.USD_TO_EGP} EGP`);
    console.log(`[Scoring]   1 IDR = ${rates.IDR_TO_EGP} EGP`);
    console.log(`[Scoring]   Source: ${rates.isFallback ? 'FALLBACK' : 'API REALTIME'}`);
  } catch (error) {
    console.warn('[Scoring] ⚠️ Gagal inisialisasi kurs:', error);
  }
};

// ============================================================
// GET RATES - PASTIKAN PAKAI DATA TERBARU
// ============================================================
const getRates = (): ExchangeRatesType => {
  if (cachedRates) {
    console.log('[Scoring] 📦 Menggunakan cached rates:');
    console.log(`[Scoring]   USD: ${cachedRates.USD_TO_EGP}`);
    console.log(`[Scoring]   IDR: ${cachedRates.IDR_TO_EGP}`);
    return cachedRates;
  }
  
  console.warn('[Scoring] ⚠️ Tidak ada cached rates, menggunakan fallback sementara');
  return {
    USD_TO_EGP: 50.5,
    IDR_TO_EGP: 0.0031,
    EGP_TO_IDR: 322.58,
    lastUpdated: new Date(),
    isFallback: true,
  };
};

// ============================================================
// 🔥 PARSING NOMINAL FUNCTIONS
// ============================================================
const applyMagnitude = (amount: number, text: string): number => {
  if (/\b(JUTA|MILLION)\b/.test(text)) return amount * 1_000_000;
  if (/\b(RIBU|THOUSAND)\b/.test(text) || /\d\s*K\b/.test(text)) return amount * 1_000;
  return amount;
};

const detectCurrency = (text: string): string => {
  if (text.includes('USD') || text.includes('$')) return 'USD';
  if (text.includes('IDR') || text.includes('RP')) return 'IDR';
  if (text.includes('EGP') || /\bLE\b/.test(text)) return 'EGP';
  return 'IDR';
};

const parseSingleNominal = (nominal: string): { amount: number; currency: string } => {
  if (!nominal?.trim()) return { amount: 0, currency: 'EGP' };

  const cleaned = nominal.toUpperCase().trim();
  const numericToken = cleaned.match(/[-+]?\d[\d.,]*/)?.[0] ?? '';
  let amount = applyMagnitude(parseLocalizedNumber(numericToken), cleaned);
  let currency = detectCurrency(cleaned);

  if (!/(USD|\$|IDR|RP|EGP|\bLE\b)/.test(cleaned)) {
    currency = amount > 10_000 || /\b(JUTA|RIBU)\b/.test(cleaned) ? 'IDR' : 'EGP';
  }

  if (!Number.isFinite(amount) || amount < 0) amount = 0;
  return { amount: Math.round(amount), currency };
};

export const parseNominalDenganMataUang = (nominal: string): { amount: number; currency: string } => {
  if (!nominal?.trim()) return { amount: 0, currency: 'EGP' };

  const cleaned = nominal.toUpperCase().trim();
  const rangeParts = cleaned.split(/\s*[–-]\s*/).filter(Boolean);
  if (rangeParts.length >= 2) {
    const first = parseSingleNominal(rangeParts[0]);
    const second = parseSingleNominal(rangeParts[1]);
    if (first.amount > 0 && second.amount > 0) {
      return {
        amount: Math.round((first.amount + second.amount) / 2),
        currency: first.currency,
      };
    }
  }

  const parsed = parseSingleNominal(cleaned);
  if (cleaned.includes('<')) return { ...parsed, amount: Math.round(parsed.amount * 0.75) };
  if (cleaned.includes('>')) return { ...parsed, amount: Math.round(parsed.amount * 1.25) };
  return parsed;
};

const parsePenghasilan = (penghasilan: string): { amount: number; currency: string } => {
  if (!penghasilan?.trim()) return { amount: 0, currency: 'IDR' };
  return parseNominalDenganMataUang(penghasilan);
};

export const parseBiayaSewa = (biayaSewa: string | undefined): number => {
  if (!biayaSewa || biayaSewa.trim() === '') return 0;
  
  const cleaned = biayaSewa.trim();
  
  if (cleaned.includes(' - ') || cleaned.includes('–')) {
    const parts = cleaned.split(/[–-]/);
    if (parts.length >= 2) {
      const first = parseInt(parts[0].trim().replace(/[^\d]/g, '')) || 0;
      const second = parseInt(parts[1].trim().replace(/[^\d]/g, '')) || 0;
      if (first > 0 && second > 0) {
        return Math.round((first + second) / 2);
      }
    }
  }
  
  if (cleaned.includes('-') && !cleaned.includes(' - ')) {
    const parts = cleaned.split('-');
    if (parts.length >= 2) {
      const first = parseInt(parts[0].trim().replace(/[^\d]/g, '')) || 0;
      const second = parseInt(parts[1].trim().replace(/[^\d]/g, '')) || 0;
      if (first > 0 && second > 0) {
        return Math.round((first + second) / 2);
      }
    }
  }
  
  return parseInt(cleaned.replace(/[^\d]/g, '')) || 0;
};

// ============================================================
// KONVERSI MATA UANG
// ============================================================
const convertToEGP = (amount: number, currency: string, rates: ExchangeRatesType): number => {
  if (amount <= 0) return 0;
  
  switch (currency.toUpperCase()) {
    case 'EGP':
      return amount;
    case 'USD':
      return amount * rates.USD_TO_EGP;
    case 'IDR':
      return amount * rates.IDR_TO_EGP;
    default:
      return amount;
  }
};

// ============================================================
// PERHITUNGAN
// ============================================================
const hitungNilaiKendaraan = (data: MustahiqData, rates: ExchangeRatesType): number => {
  let totalNilai = 0;
  const list = data.kendaraan_list || [];
  
  if (!Array.isArray(list) || list.length === 0) return 0;
  
  for (const kendaraan of list) {
    const jenis = kendaraan.jenis || 'Lainnya';
    const nilaiEGP = ESTIMASI_NILAI_KENDARAAN[jenis] || 5000;
    totalNilai += nilaiEGP;
  }
  
  return Math.round(totalNilai);
};

const hitungTotalPendapatan = (
  data: MustahiqData,
  rates: ExchangeRatesType
): {
  total: number;
  rincian: {
    kirimanOrtu: number;
    pendapatanSendiri: number;
    beasiswa: number;
  };
} => {
  let kirimanOrtu = 0;
  let pendapatanSendiri = 0;
  let beasiswa = 0;
  
  if (data.kiriman_orangtua === 'Ya, masih.' && data.nominal_kiriman) {
    const parsed = parseNominalDenganMataUang(data.nominal_kiriman);
    if (parsed.amount > 0) {
      kirimanOrtu = convertToEGP(parsed.amount, parsed.currency, rates);
    }
  }
  
  if (data.nominal_pendapatan) {
    const parsed = parseNominalDenganMataUang(data.nominal_pendapatan);
    if (parsed.amount > 0) {
      pendapatanSendiri = convertToEGP(parsed.amount, parsed.currency, rates);
    }
  }
  
  if (data.punya_beasiswa === 'Ya' && data.nominal_beasiswa) {
    const parsed = parseNominalDenganMataUang(data.nominal_beasiswa);
    if (parsed.amount > 0) {
      beasiswa = convertToEGP(parsed.amount, parsed.currency, rates);
    }
  }
  
  const total = kirimanOrtu + pendapatanSendiri + beasiswa;
  
  return {
    total: Math.round(total * 100) / 100,
    rincian: {
      kirimanOrtu: Math.round(kirimanOrtu * 100) / 100,
      pendapatanSendiri: Math.round(pendapatanSendiri * 100) / 100,
      beasiswa: Math.round(beasiswa * 100) / 100,
    },
  };
};

const hitungBiayaHidupTotal = (jumlahTanggungan: number, biayaSewa: number): number => {
  const totalAnggota = 1 + (jumlahTanggungan || 0);
  const biayaPokokTotal = totalAnggota * BIAYA_HIDUP_POKOK_MESIR_PERBULAN;
  return biayaPokokTotal + biayaSewa;
};

const hitungTotalHutang = (data: MustahiqData, rates: ExchangeRatesType): number => {
  if (data.punya_hutang !== 'Ya, ada.' || !data.hutang_list || !Array.isArray(data.hutang_list)) {
    return 0;
  }
  
  let total = 0;
  for (const h of data.hutang_list) {
    const amount = Number(h.nominal) || 0;
    const currency = h.mata_uang || 'EGP';
    const converted = convertToEGP(amount, currency, rates);
    total += converted;
  }
  
  return Math.round(total * 100) / 100;
};

const hitungPenghasilanKeluarga = (data: MustahiqData, rates: ExchangeRatesType): number => {
  const ayah = parsePenghasilan(data.penghasilan_ayah);
  const ibu = parsePenghasilan(data.penghasilan_ibu);
  const total = convertToEGP(ayah.amount, ayah.currency, rates) + 
                convertToEGP(ibu.amount, ibu.currency, rates);
  return Math.round(total);
};

// ============================================================
// REKOMENDASI ASNAF
// ============================================================
const getAsnafRecommendation = (
  data: MustahiqData,
  percentage: number,
  defisit: number,
  rasioKecukupan: number,
  totalHutang: number,
  totalPendapatan: number,
  penghasilanKeluargaEGP: number,
  biayaHidupTotal: number,
  nilaiKendaraanEGP: number
): string => {
  const tanggungan = data.jumlah_tanggungan || 0;
  const anakCount = parseInt(data.anak_keberapa?.split(' dari ')[1]?.replace(' bersaudara', '') || '1');
  const penghasilanPerAnak = anakCount > 0 ? penghasilanKeluargaEGP / anakCount : penghasilanKeluargaEGP;
  
  if (totalHutang >= 10000 && defisit > 0 && rasioKecukupan < 0.5) {
    return 'Gharimin (Prioritas Tertinggi) - Hutang besar & defisit keuangan';
  }
  
  if (totalHutang >= 15000 && rasioKecukupan < 0.6) {
    return 'Gharimin (Prioritas Tinggi) - Hutang sangat besar';
  }
  
  if (totalPendapatan < 500 && data.kiriman_orangtua === 'Tidak' && data.punya_beasiswa === 'Tidak') {
    return 'Fakir - Tidak memiliki pendapatan sama sekali';
  }
  
  if (defisit > BIAYA_HIDUP_POKOK_MESIR_PERBULAN * 2 && totalPendapatan < 500) {
    return 'Fakir - Defisit keuangan sangat besar';
  }
  
  if (percentage >= 65) {
    if (totalHutang >= 10000) return 'Gharimin - Orang yang berhutang besar';
    if (totalHutang >= 5000 && defisit > 0) return 'Gharimin - Beban hutang + defisit';
    if (defisit > BIAYA_HIDUP_POKOK_MESIR_PERBULAN) return 'Fakir - Defisit keuangan besar';
    if (totalPendapatan <= BIAYA_HIDUP_POKOK_MESIR_PERBULAN && data.kiriman_orangtua === 'Tidak') {
      return 'Fakir - Tidak memiliki penghasilan cukup';
    }
    if (penghasilanPerAnak <= 3000) return 'Miskin - Penghasilan keluarga sangat rendah';
    if (tanggungan >= 4 && totalPendapatan < biayaHidupTotal) return 'Miskin - Banyak tanggungan, pendapatan kurang';
    if (totalPendapatan < 2000) return 'Miskin - Pendapatan di bawah UMR Mesir';
    if (data.jenjang_pendidikan === 'Kuliah' || data.jenjang_pendidikan === 'Dauroh Lughoh') {
      if (data.punya_beasiswa === 'Tidak' || data.status_beasiswa === 'Beasiswa Sebagian') {
        return 'Ibnu Sabil - Pelajar/Mahasiswa dengan biaya hidup tinggi';
      }
    }
    return 'Fakir/Miskin - Memerlukan bantuan';
  }
  
  if (percentage >= 50) {
    if (totalHutang >= 5000 && rasioKecukupan < 0.7) return 'Gharimin - Beban hutang + defisit';
    if (totalHutang >= 5000) return 'Gharimin - Orang yang berhutang';
    if (defisit > 1500 && totalPendapatan < 3000) return 'Fakir - Defisit keuangan';
    if (penghasilanPerAnak <= 5000) return 'Miskin - Penghasilan keluarga rendah';
    if (tanggungan >= 3 && totalPendapatan < biayaHidupTotal) return 'Miskin - Banyak tanggungan';
    if (data.jenjang_pendidikan === 'Kuliah' || data.jenjang_pendidikan === 'Dauroh Lughoh') {
      return 'Ibnu Sabil - Pelajar/Mahasiswa';
    }
    return 'Miskin - Memerlukan bantuan';
  }
  
  if (percentage >= 35) {
    if (totalHutang >= 3000) return 'Gharimin - Orang yang berhutang';
    if (defisit > 0 && totalPendapatan < 4000) return 'Miskin - Defisit keuangan';
    return 'Miskin - Pendapatan kurang mencukupi';
  }
  
  return 'Tidak Direkomendasikan - Pendapatan mencukupi';
};

// ============================================================
// 🔥 FUNGSI UTAMA SCORING - SYNC VERSION
// ============================================================
export const calculateMustahiqScore = (data: MustahiqData): ScoreResult => {
  const rates = getRates();

  console.log('[Scoring] ========================================');
  console.log('[Scoring] 💱 KURS YANG DIGUNAKAN:');
  console.log(`[Scoring]   1 USD = ${rates.USD_TO_EGP} EGP`);
  console.log(`[Scoring]   1 IDR = ${rates.IDR_TO_EGP} EGP`);
  console.log(`[Scoring]   1 EGP = ${rates.EGP_TO_IDR} IDR`);
  console.log(`[Scoring]   Source: ${rates.isFallback ? 'FALLBACK' : 'API'}`);
  console.log('[Scoring] ========================================');
  
  const details: ScoreDetail[] = [];
  let totalScore = 0;
  const maxScore = 100;

  const pendapatan = hitungTotalPendapatan(data, rates);
  const totalPendapatan = pendapatan.total;
  
  const biayaSewa = parseBiayaSewa(data.biaya_sewa);
  const biayaHidupTotal = hitungBiayaHidupTotal(data.jumlah_tanggungan || 0, biayaSewa);
  const defisit = biayaHidupTotal - totalPendapatan;
  const rasioKecukupan = biayaHidupTotal > 0 ? totalPendapatan / biayaHidupTotal : 1;
  
  const totalHutang = hitungTotalHutang(data, rates);
  const penghasilanKeluargaEGP = hitungPenghasilanKeluarga(data, rates);
  const nilaiKendaraanEGP = hitungNilaiKendaraan(data, rates);
  
  const anakCount = parseInt(data.anak_keberapa?.split(' dari ')[1]?.replace(' bersaudara', '') || '1');
  const penghasilanPerAnak = anakCount > 0 ? penghasilanKeluargaEGP / anakCount : penghasilanKeluargaEGP;

  console.log('[Scoring] 💰 Total Pendapatan:', Math.round(totalPendapatan), 'EGP');
  console.log('[Scoring] 🏠 Biaya Hidup:', Math.round(biayaHidupTotal), 'EGP');
  console.log('[Scoring] 📉 Defisit:', Math.round(defisit), 'EGP');
  console.log('[Scoring] 💳 Total Hutang:', Math.round(totalHutang), 'EGP');

  // ============================================================
  // SCORING - 1. RASIO KECUKUPAN BIAYA HIDUP (Max: 40)
  // ============================================================
  let biayaHidupScore = 0;

  if (totalPendapatan <= 0) {
    biayaHidupScore = 40;
    details.push({ 
      category: 'Kecukupan Biaya Hidup', 
      score: 40, 
      maxScore: 40, 
      reason: `Tidak memiliki pendapatan sama sekali (butuh ${Math.round(biayaHidupTotal)} EGP/bln)` 
    });
  } else if (rasioKecukupan <= 0.15) {
    biayaHidupScore = 40;
    details.push({ 
      category: 'Kecukupan Biaya Hidup', 
      score: 40, 
      maxScore: 40, 
      reason: `Pendapatan hanya ${Math.round(rasioKecukupan * 100)}% dari kebutuhan ${Math.round(biayaHidupTotal)} EGP, sangat memprihatinkan` 
    });
  } else if (rasioKecukupan <= 0.30) {
    biayaHidupScore = 35;
    details.push({ 
      category: 'Kecukupan Biaya Hidup', 
      score: 35, 
      maxScore: 40, 
      reason: `Defisit ${Math.round(defisit)} EGP/bln (pendapatan ${Math.round(rasioKecukupan * 100)}% dari kebutuhan)` 
    });
  } else if (rasioKecukupan <= 0.45) {
    biayaHidupScore = 28;
    details.push({ 
      category: 'Kecukupan Biaya Hidup', 
      score: 28, 
      maxScore: 40, 
      reason: `Defisit ${Math.round(defisit)} EGP/bln (pendapatan ${Math.round(rasioKecukupan * 100)}% dari kebutuhan)` 
    });
  } else if (rasioKecukupan <= 0.60) {
    biayaHidupScore = 22;
    details.push({ 
      category: 'Kecukupan Biaya Hidup', 
      score: 22, 
      maxScore: 40, 
      reason: `Defisit ${Math.round(defisit)} EGP/bln (pendapatan ${Math.round(rasioKecukupan * 100)}% dari kebutuhan)` 
    });
  } else if (rasioKecukupan <= 0.75) {
    biayaHidupScore = 16;
    details.push({ 
      category: 'Kecukupan Biaya Hidup', 
      score: 16, 
      maxScore: 40, 
      reason: `Defisit ${Math.round(defisit)} EGP/bln (pendapatan ${Math.round(rasioKecukupan * 100)}% dari kebutuhan)` 
    });
  } else if (rasioKecukupan <= 0.85) {
    biayaHidupScore = 12;
    details.push({ 
      category: 'Kecukupan Biaya Hidup', 
      score: 12, 
      maxScore: 40, 
      reason: `Defisit ${Math.round(defisit)} EGP/bln (pendapatan ${Math.round(rasioKecukupan * 100)}% dari kebutuhan)` 
    });
  } else if (rasioKecukupan <= 0.95) {
    biayaHidupScore = 10;
    details.push({ 
      category: 'Kecukupan Biaya Hidup', 
      score: 10, 
      maxScore: 40, 
      reason: `Defisit ${Math.round(defisit)} EGP/bln (pendapatan ${Math.round(rasioKecukupan * 100)}% dari kebutuhan, hampir cukup)` 
    });
  } else if (rasioKecukupan <= 1.0) {
    biayaHidupScore = 7;
    details.push({ 
      category: 'Kecukupan Biaya Hidup', 
      score: 7, 
      maxScore: 40, 
      reason: `Defisit ${Math.round(defisit)} EGP/bln (pendapatan ${Math.round(rasioKecukupan * 100)}% dari kebutuhan, hampir cukup)` 
    });
  } else if (rasioKecukupan <= 1.10) {
    biayaHidupScore = 4;
    details.push({ 
      category: 'Kecukupan Biaya Hidup', 
      score: 4, 
      maxScore: 40, 
      reason: `Pendapatan ${Math.round(rasioKecukupan * 100)}% dari kebutuhan, sedikit surplus (${Math.round(-defisit)} EGP)` 
    });
  } else if (rasioKecukupan <= 1.30) {
    biayaHidupScore = 2;
    details.push({ 
      category: 'Kecukupan Biaya Hidup', 
      score: 2, 
      maxScore: 40, 
      reason: `Pendapatan ${Math.round(rasioKecukupan * 100)}% dari kebutuhan, surplus (${Math.round(-defisit)} EGP)` 
    });
  } else {
    biayaHidupScore = 0;
    details.push({ 
      category: 'Kecukupan Biaya Hidup', 
      score: 0, 
      maxScore: 40, 
      reason: `Pendapatan ${Math.round(totalPendapatan)} EGP jauh di atas kebutuhan ${Math.round(biayaHidupTotal)} EGP` 
    });
  }
  totalScore += biayaHidupScore;

  // ============================================================
  // SCORING - 2. FINANSIAL KELUARGA (Max: 18)
  // ============================================================
  let financialScore = 0;
  if (penghasilanPerAnak <= 1000) {
    financialScore = 18;
    details.push({ category: 'Finansial Keluarga', score: 18, maxScore: 18, reason: `Penghasilan per anak sangat rendah (≈${Math.round(penghasilanPerAnak)} EGP)` });
  } else if (penghasilanPerAnak <= 2500) {
    financialScore = 14;
    details.push({ category: 'Finansial Keluarga', score: 14, maxScore: 18, reason: `Penghasilan per anak rendah (≈${Math.round(penghasilanPerAnak)} EGP)` });
  } else if (penghasilanPerAnak <= 4000) {
    financialScore = 10;
    details.push({ category: 'Finansial Keluarga', score: 10, maxScore: 18, reason: `Penghasilan per anak cukup rendah (≈${Math.round(penghasilanPerAnak)} EGP)` });
  } else if (penghasilanPerAnak <= 6000) {
    financialScore = 6;
    details.push({ category: 'Finansial Keluarga', score: 6, maxScore: 18, reason: `Penghasilan per anak cukup (≈${Math.round(penghasilanPerAnak)} EGP)` });
  } else {
    financialScore = 2;
    details.push({ category: 'Finansial Keluarga', score: 2, maxScore: 18, reason: `Penghasilan per anak tinggi (≈${Math.round(penghasilanPerAnak)} EGP)` });
  }
  totalScore += financialScore;

  // ============================================================
  // SCORING - 3. BEBAN HUTANG (Max: 12)
  // ============================================================
  let debtScore = 0;
  if (data.punya_hutang === 'Ya, ada.' && totalHutang > 0) {
    if (totalHutang >= 15000 && defisit > 0) {
      debtScore = 12;
      details.push({ category: 'Beban Hutang', score: 12, maxScore: 12, reason: `Hutang sangat besar (${Math.round(totalHutang)} EGP) + defisit` });
    } else if (totalHutang >= 10000 && defisit > 0) {
      debtScore = 10;
      details.push({ category: 'Beban Hutang', score: 10, maxScore: 12, reason: `Hutang besar (${Math.round(totalHutang)} EGP) + defisit` });
    } else if (totalHutang >= 10000) {
      debtScore = 8;
      details.push({ category: 'Beban Hutang', score: 8, maxScore: 12, reason: `Hutang besar (${Math.round(totalHutang)} EGP)` });
    } else if (totalHutang >= 5000 && defisit > 0) {
      debtScore = 7;
      details.push({ category: 'Beban Hutang', score: 7, maxScore: 12, reason: `Hutang ${Math.round(totalHutang)} EGP + defisit` });
    } else if (totalHutang >= 5000) {
      debtScore = 5;
      details.push({ category: 'Beban Hutang', score: 5, maxScore: 12, reason: `Hutang sedang (${Math.round(totalHutang)} EGP)` });
    } else if (totalHutang >= 2000) {
      debtScore = 3;
      details.push({ category: 'Beban Hutang', score: 3, maxScore: 12, reason: `Hutang kecil (${Math.round(totalHutang)} EGP)` });
    } else {
      debtScore = 1;
      details.push({ category: 'Beban Hutang', score: 1, maxScore: 12, reason: `Hutang sangat kecil (${Math.round(totalHutang)} EGP)` });
    }
  } else {
    details.push({ category: 'Beban Hutang', score: 0, maxScore: 12, reason: 'Tidak ada hutang' });
  }
  totalScore += debtScore;

  // ============================================================
  // SCORING - 4. DUKUNGAN ORANG TUA (Max: 10)
  // ============================================================
  let supportScore = 0;
  if (data.kiriman_orangtua === 'Tidak') {
    if (totalPendapatan <= BIAYA_HIDUP_POKOK_MESIR_PERBULAN) {
      supportScore = 10;
      details.push({ category: 'Dukungan Orang Tua', score: 10, maxScore: 10, reason: `Tidak dikirim ortu & pendapatan ≤ ${BIAYA_HIDUP_POKOK_MESIR_PERBULAN} EGP` });
    } else if (totalPendapatan <= 2500) {
      supportScore = 7;
      details.push({ category: 'Dukungan Orang Tua', score: 7, maxScore: 10, reason: 'Tidak dikirim ortu, pendapatan pas-pasan' });
    } else if (totalPendapatan <= 4000) {
      supportScore = 4;
      details.push({ category: 'Dukungan Orang Tua', score: 4, maxScore: 10, reason: 'Tidak dikirim ortu, pendapatan cukup' });
    } else {
      supportScore = 1;
      details.push({ category: 'Dukungan Orang Tua', score: 1, maxScore: 10, reason: 'Tidak dikirim ortu tapi pendapatan tinggi' });
    }
  } else if (data.kiriman_orangtua === 'Ya, masih.') {
    if (totalPendapatan <= 2000) {
      supportScore = 8;
      details.push({ category: 'Dukungan Orang Tua', score: 8, maxScore: 10, reason: `Total pendapatan rendah (${Math.round(totalPendapatan)} EGP)` });
    } else if (totalPendapatan <= 3500) {
      supportScore = 5;
      details.push({ category: 'Dukungan Orang Tua', score: 5, maxScore: 10, reason: `Total pendapatan cukup (${Math.round(totalPendapatan)} EGP)` });
    } else {
      supportScore = 2;
      details.push({ category: 'Dukungan Orang Tua', score: 2, maxScore: 10, reason: `Total pendapatan besar (${Math.round(totalPendapatan)} EGP)` });
    }
  } else {
    supportScore = 5;
    details.push({ category: 'Dukungan Orang Tua', score: 5, maxScore: 10, reason: 'Status kiriman tidak jelas' });
  }
  totalScore += supportScore;

  // ============================================================
  // SCORING - 5. STATUS TEMPAT TINGGAL (Max: 5)
  // ============================================================
  let housingScore = 0;
  if (data.status_tempat_tinggal === 'Sewa(Bayar)' && biayaSewa > 0) {
    if (biayaSewa >= 1000) {
      housingScore = 5;
      details.push({ category: 'Tempat Tinggal', score: 5, maxScore: 5, reason: `Sewa tinggi (${Math.round(biayaSewa)} EGP/bulan)` });
    } else {
      housingScore = 4;
      details.push({ category: 'Tempat Tinggal', score: 4, maxScore: 5, reason: `Sewa ${Math.round(biayaSewa)} EGP/bulan` });
    }
  } else if (data.status_tempat_tinggal === 'Sewa(Bayar)') {
    housingScore = 3;
    details.push({ category: 'Tempat Tinggal', score: 3, maxScore: 5, reason: 'Tinggal sewa (biaya tidak diketahui)' });
  } else if (data.status_tempat_tinggal?.includes('Gratis')) {
    housingScore = 1;
    details.push({ category: 'Tempat Tinggal', score: 1, maxScore: 5, reason: 'Gratis di fasilitas' });
  } else {
    housingScore = 2;
    details.push({ category: 'Tempat Tinggal', score: 2, maxScore: 5, reason: 'Tinggal sendiri/gratis' });
  }
  totalScore += housingScore;

  // ============================================================
  // SCORING - 6. TANGGUNGAN (Max: 8)
  // ============================================================
  let dependentScore = 0;
  const tanggungan = data.jumlah_tanggungan || 0;
  
  if (data.punya_tanggungan === 'Ya' && tanggungan > 0) {
    if (tanggungan >= 4) {
      dependentScore = 8;
      details.push({ category: 'Tanggungan', score: 8, maxScore: 8, reason: `Banyak tanggungan (${tanggungan} orang)` });
    } else if (tanggungan >= 2) {
      dependentScore = 6;
      details.push({ category: 'Tanggungan', score: 6, maxScore: 8, reason: `Tanggungan sedang (${tanggungan} orang)` });
    } else {
      dependentScore = 4;
      details.push({ category: 'Tanggungan', score: 4, maxScore: 8, reason: `Ada tanggungan (${tanggungan} orang)` });
    }
    if (data.status_menikah === 'Menikah') dependentScore = Math.min(dependentScore + 1, 8);
  } else if (data.status_menikah === 'Menikah') {
    dependentScore = 2;
    details.push({ category: 'Tanggungan', score: 2, maxScore: 8, reason: 'Menikah tapi tidak ada tanggungan' });
  } else {
    dependentScore = 0;
    details.push({ category: 'Tanggungan', score: 0, maxScore: 8, reason: 'Tidak ada tanggungan' });
  }
  totalScore += dependentScore;

  // ============================================================
  // SCORING - 7. STATUS BEASISWA (Max: 3)
  // ============================================================
  let scholarshipScore = 0;
  if (data.punya_beasiswa === 'Tidak') {
    scholarshipScore = 3;
    details.push({ category: 'Beasiswa', score: 3, maxScore: 3, reason: 'Tidak mendapat beasiswa' });
  } else if (data.status_beasiswa === 'Beasiswa Sebagian') {
    scholarshipScore = 2;
    details.push({ category: 'Beasiswa', score: 2, maxScore: 3, reason: 'Beasiswa sebagian' });
  } else if (data.punya_beasiswa === 'Ya') {
    scholarshipScore = 0;
    details.push({ category: 'Beasiswa', score: 0, maxScore: 3, reason: 'Mendapat beasiswa penuh' });
  } else {
    scholarshipScore = 1;
    details.push({ category: 'Beasiswa', score: 1, maxScore: 3, reason: 'Status beasiswa tidak jelas' });
  }
  totalScore += scholarshipScore;

  // ============================================================
  // SCORING - 8. ASET KELUARGA (Max: 2)
  // ============================================================
  let assetScore = 0;
  const vehicleCount = data.jumlah_kendaraan || 0;
  
  if (vehicleCount === 0) {
    assetScore = 2;
    details.push({ category: 'Aset Keluarga', score: 2, maxScore: 2, reason: 'Tidak memiliki kendaraan' });
  } else {
    if (nilaiKendaraanEGP <= 5000) {
      assetScore = 1;
      details.push({ category: 'Aset Keluarga', score: 1, maxScore: 2, reason: `Memiliki kendaraan (nilai ≈${Math.round(nilaiKendaraanEGP)} EGP)` });
    } else {
      assetScore = 0;
      details.push({ category: 'Aset Keluarga', score: 0, maxScore: 2, reason: `Memiliki kendaraan bernilai > 5000 EGP` });
    }
  }
  totalScore += assetScore;

  // ============================================================
  // SCORING - 9. GAYA HIDUP & PEKERJAAN ORTU (Max: 2)
  // ============================================================
  let lifestyleScore = 0;
  const pekerjaanRendah = ['Buruh', 'Petani', 'Nelayan', 'Tidak Bekerja', 'Ibu Rumah Tangga', 'Wiraswasta Kecil', 'Lainnya'];
  
  if (pekerjaanRendah.some(p => data.pekerjaan_ayah.includes(p))) lifestyleScore += 1;
  if (pekerjaanRendah.some(p => data.pekerjaan_ibu.includes(p))) lifestyleScore += 1;
  
  if (data.merokok === 'Ya' && (data.rokok_per_hari || 0) >= 10) {
    lifestyleScore += 1;
  }
  
  lifestyleScore = Math.min(lifestyleScore, 2);
  
  if (lifestyleScore >= 2) {
    details.push({ category: 'Gaya Hidup & Pekerjaan', score: 2, maxScore: 2, reason: 'Pekerjaan ortu rendah &/atau perokok berat' });
  } else if (lifestyleScore === 1) {
    details.push({ category: 'Gaya Hidup & Pekerjaan', score: 1, maxScore: 2, reason: 'Salah satu faktor: pekerjaan rendah atau perokok' });
  } else {
    details.push({ category: 'Gaya Hidup & Pekerjaan', score: 0, maxScore: 2, reason: 'Pekerjaan stabil, tidak merokok' });
  }
  totalScore += lifestyleScore;

  // ============================================================
  // FINAL CALCULATION
  // ============================================================
  const percentage = Math.round((totalScore / maxScore) * 100);
  
  let grade: 'A' | 'B' | 'C' | 'D' | 'E';
  let recommendation: 'Sangat Layak' | 'Layak' | 'Dipertimbangkan' | 'Kurang Layak' | 'Tidak Layak';
  
  if (percentage >= 80) { 
    grade = 'A'; 
    recommendation = 'Sangat Layak'; 
  } else if (percentage >= 65) { 
    grade = 'B'; 
    recommendation = 'Layak'; 
  } else if (percentage >= 50) { 
    grade = 'C'; 
    recommendation = 'Dipertimbangkan'; 
  } else if (percentage >= 35) { 
    grade = 'D'; 
    recommendation = 'Kurang Layak'; 
  } else { 
    grade = 'E'; 
    recommendation = 'Tidak Layak'; 
  }

  const asnafRecommendation = getAsnafRecommendation(
    data, 
    percentage, 
    defisit, 
    rasioKecukupan, 
    totalHutang, 
    totalPendapatan,
    penghasilanKeluargaEGP,
    biayaHidupTotal,
    nilaiKendaraanEGP
  );

  const result: ScoreResult = { 
    totalScore, 
    maxScore, 
    percentage, 
    grade, 
    recommendation, 
    asnafRecommendation, 
    details,
    financialSummary: {
      totalPendapatanEGP: Math.round(totalPendapatan),
      totalBiayaHidupEGP: Math.round(biayaHidupTotal),
      defisitEGP: Math.round(defisit),
      totalHutangEGP: Math.round(totalHutang),
      penghasilanKeluargaEGP: Math.round(penghasilanKeluargaEGP),
      nilaiKendaraanEGP: Math.round(nilaiKendaraanEGP),
    }
  };

  console.log('[Scoring] ✅ Hasil Final:');
  console.log(`  Total Score: ${totalScore}/${maxScore}`);
  console.log(`  Percentage: ${percentage}%`);
  console.log(`  Grade: ${grade}`);
  console.log(`  Recommendation: ${recommendation}`);
  console.log(`  Asnaf: ${asnafRecommendation}`);

  return result;
};

// ============================================================
// TYPES
// ============================================================
interface ScoreDetail {
  category: string;
  score: number;
  maxScore: number;
  reason: string;
}

export interface ScoreResult {
  totalScore: number;
  maxScore: number;
  percentage: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  recommendation: 'Sangat Layak' | 'Layak' | 'Dipertimbangkan' | 'Kurang Layak' | 'Tidak Layak';
  asnafRecommendation: string;
  details: ScoreDetail[];
  financialSummary?: {
    totalPendapatanEGP: number;
    totalBiayaHidupEGP: number;
    defisitEGP: number;
    totalHutangEGP: number;
    penghasilanKeluargaEGP: number;
    nilaiKendaraanEGP: number;
  };
}

/**
 * 🔥 Async version dengan inisialisasi rates
 */
export const calculateMustahiqScoreAsync = async (data: MustahiqData): Promise<ScoreResult> => {
  await initializeScoringRates();
  return calculateMustahiqScore(data);
};