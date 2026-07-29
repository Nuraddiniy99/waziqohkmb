// ============================================================
// WAZIQOH SUPER APP V4.0 - TYPE DEFINITIONS
// ============================================================

export type Currency = 'IDR' | 'EGP' | 'USD';

export interface User {
  id: string;
  username: string;
  password_hash?: string;
  role: 'admin' | 'user';
  nama_lengkap: string;
  status_aktif: boolean;
  created_at: string;
}

export interface Settings {
  id?: string;
  key: string;
  value: string;
  last_updated: string;
}

export interface SystemConfig {
  masa_jabatan: string;
  tahun_aktif: string;
  ttd_direktur_url: string;
  ttd_direktur_nama: string;
  ttd_direktur_jabatan: string;
  kop_surat_url: string;
}

export interface Donatur {
  id: string;
  invoice_number: string;
  nama: string;
  kekeluargaan: string;
  jenis_pembayaran: PaymentItem[];
  metode_pembayaran: 'Tunai' | 'Transfer';
  total_egp: number;
  total_idr: number;
  total_usd: number;
  timestamp: string;
  tahun: string;
  last_modified: string;
}

export interface PaymentItem {
  jenis: string;
  nominal_egp: number;
  nominal_idr: number;
  nominal_usd?: number;
}

export interface Penghutang {
  id: string;
  id_penghutang: string;
  nama_lengkap: string;
  alamat_mesir: string;
  alamat_indonesia: string;
  no_wa_pribadi: string;
  no_wa_kerabat: string;
  no_telp_seluler: string | null;
  foto_ttd_url: string | null;
  status_umum: 'Aktif' | 'Selesai';
  registered_date: string;
}

export interface Hutang {
  id: string;
  id_hutang: string;
  id_penghutang: string;
  rincian_hutang: string;
  jenis_akad: string;
  nominal_pokok: number;
  nominal_total: number;
  mata_uang: Currency;
  tanggal_jatuh_tempo: string;
  status_hutang: 'Belum Lunas' | 'Lunas';
  created_date: string;
}

export interface Cicilan {
  id: string;
  id_cicilan: string;
  id_hutang: string;
  id_penghutang: string;
  tanggal_bayar: string;
  nominal_bayar: number;
  mata_uang: Currency;
  metode_bayar: 'Tunai' | 'Transfer Bank Mesir' | 'Transfer Bank Indonesia';
  bukti_bayar_url?: string | null;
  catatan: string | null;
  created_date: string;
}

// ============================================================
// MUSTAHIQ - FULL DATA (REVISI LENGKAP)
// ============================================================

export interface Kendaraan {
  jenis: string;
  rincian: string;
}

export interface HutangData {
  kepada: string;
  kekeluargaan: string;
  nominal: number;
  mata_uang: string;
  tujuan: string;
  tujuan_lainnya?: string;
}

// ============================================================
// 🔥 TYPE UNTUK SCORING - MUSTAHIQ DATA
// ============================================================
export interface MustahiqData {
  nama_lengkap: string;
  status_tempat_tinggal: string;
  jenjang_pendidikan?: string;
  biaya_sewa?: string;
  penghasilan_ayah: string;
  penghasilan_ibu: string;
  pekerjaan_ayah: string;
  pekerjaan_ibu: string;
  anak_keberapa: string;
  jumlah_kendaraan: number;
  kendaraan_list?: Kendaraan[];
  kiriman_orangtua: string;
  nominal_kiriman?: string;
  sumber_dana_utama?: string;
  sumber_dana_lainnya?: string;
  nominal_pendapatan?: string | null;
  status_menikah: string;
  punya_tanggungan: string;
  jumlah_tanggungan: number;
  rincian_tanggungan?: string;
  punya_hutang: string;
  hutang_list?: HutangData[];
  punya_beasiswa: string;
  status_beasiswa?: string;
  cakupan_beasiswa?: string;
  nominal_beasiswa?: string | null;
  merokok: string;
  rokok_per_hari: number;
}

// ============================================================
// 🔥 TYPE UNTUK EXCHANGE RATES
// ============================================================
export interface ExchangeRates {
  USD_TO_EGP: number;
  IDR_TO_EGP: number;
  EGP_TO_IDR: number;
  lastUpdated: Date;
  isFallback?: boolean;
}

// ============================================================
// MUSTAHIQ - TYPE UTAMA (untuk database)
// ============================================================
export interface Mustahiq {
  id: string;
  id_mustahiq: string;
  
  // SECTION 1: DATA DIRI & IDENTITAS
  nama_lengkap: string;
  almamater: string | null;
  tahun_kedatangan: number;
  no_telp_mesir: string | null;
  no_wa_aktif: string;
  alamat_mesir: string;
  alamat_indonesia: string;
  foto_url: string | null;
  
  // SECTION 2: AKADEMIK & PENDIDIKAN
  jenjang_pendidikan: string | null;
  mustawa_tingkat: string | null;
  nama_fakultas: string | null;
  nama_jurusan: string | null;
  tingkat_kuliah: string | null;
  pendidikan_lainnya: string | null;
  
  // SECTION 3: DOMISILI & TEMPAT TINGGAL
  status_tempat_tinggal: string;
  biaya_sewa: string | null;
  
  // SECTION 4: DATA ORANG TUA & ASET KELUARGA
  pekerjaan_ayah: string;
  pekerjaan_ayah_lainnya: string | null;
  pekerjaan_ibu: string;
  pekerjaan_ibu_lainnya: string | null;
  penghasilan_ayah: string | null;
  penghasilan_ibu: string | null;
  anak_keberapa: string | null;
  jumlah_kendaraan: number;
  kendaraan_list: Kendaraan[] | null;
  
  // SECTION 5: FINANSIAL & PENDAPATAN
  kiriman_orangtua: string;
  nominal_kiriman: string | null;
  sumber_dana_utama: string | null;
  sumber_dana_lainnya: string | null;
  nominal_pendapatan: string | null;
  
  // SECTION 6: TANGGUNGAN, HUTANG & BEASISWA
  status_menikah: string;
  punya_tanggungan: string;
  jumlah_tanggungan: number;
  rincian_tanggungan: string | null;
  punya_hutang: string;
  hutang_list: HutangData[] | null;
  punya_beasiswa: string;
  status_beasiswa: string | null;
  cakupan_beasiswa: string | null;
  nominal_beasiswa: string | null;
  
  // SECTION 7: GAYA HIDUP
  merokok: string;
  rokok_per_hari: number;
  
  // STATUS & METADATA
  status_verifikasi: string;
  asnaf: string | null;
  kekeluargaan: string | null;
  nominal_diterima: number;
  mata_uang: string;
  tanggal_distribusi: string;
  tahun: string;
  keterangan: string | null;
  created_at?: string;
  last_modified?: string;
  scoring?: number;
  scoring_details?: unknown;
}

// ============================================================
// DASHBOARD & CHART TYPES
// ============================================================

export interface DashboardStats {
  total_donasi_idr: number;
  total_donasi_egp: number;
  total_donasi_usd?: number;
  total_hutang_beredar_idr: number;
  total_hutang_beredar_egp: number;
  total_hutang_beredar_usd: number;
  total_cicilan_masuk_idr: number;
  total_cicilan_masuk_egp: number;
  total_cicilan_masuk_usd: number;
  total_mustahiq: number;
  total_dana_disalurkan_idr: number;
  total_dana_disalurkan_egp: number;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    borderWidth?: number;
  }[];
}

export interface FilterOptions {
  rentang_waktu: 'hari_ini' | '7_hari' | 'bulan_ini' | 'tahun_aktif' | 'custom';
  dari_tanggal?: string;
  sampai_tanggal?: string;
  kekeluargaan?: string;
  jenis_transaksi?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export type ViewMode = 'list' | 'grid';
export type SortOrder = 'asc' | 'desc';