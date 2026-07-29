// ============================================================
// CONSTANTS
// ============================================================

export const KEKELUARGAAN_OPTIONS = [
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

export const JENIS_PEMBAYARAN_OPTIONS = [
  'Zakat',
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

export const METODE_PEMBAYARAN_OPTIONS = [
  'Tunai',
  'Transfer',
];

export const JENIS_AKAD_OPTIONS = [
  'Mudhorobah',
  'Qardh Hasan',
  'Murabahah',
  'Ijarah',
  'Lainnya',
];

export const MATA_UANG_OPTIONS = [
  'IDR',
  'EGP',
  'USD',
];

export const METODE_BAYAR_OPTIONS = [
  'Tunai',
  'Transfer Bank Mesir',
  'Transfer Bank Indonesia',
];

export const ASNAF_OPTIONS = [
  'Fakir',
  'Miskin',
  'Amil',
  'Muallaf',
  'Riqab',
  'Gharim',
  'Fisabilillah',
  'Ibnu Sabil',
];

export const STATUS_VERIFIKASI_OPTIONS = [
  'Proses Survei',
  'Terverifikasi Layak',
  'Ditolak',
];

export const STATUS_HUTANG_OPTIONS = [
  'Belum Lunas',
  'Lunas',
];

export const STATUS_UMUM_OPTIONS = [
  'Aktif',
  'Selesai',
];

export const RENTANG_WAKTU_OPTIONS = [
  { value: 'hari_ini', label: 'Hari Ini' },
  { value: '7_hari', label: '7 Hari Terakhir' },
  { value: 'bulan_ini', label: 'Bulan Ini' },
  { value: 'tahun_aktif', label: 'Tahun Aktif' },
  { value: 'custom', label: 'Rentang Kustom' },
];

export const DEFAULT_SYSTEM_CONFIG = {
  masa_jabatan: '2025/2026',
  tahun_aktif: '2026',
  ttd_direktur_url: '',
  ttd_direktur_nama: 'Ust. Nuraddiniy, S.Lc.',
  ttd_direktur_jabatan: 'Direktur Utama WAZIQOH KMB Mesir',
  kop_surat_url: '',
};

export const APP_NAME = 'WAZIQOH';
export const APP_FULL_NAME = 'WAZIQOH KMB Mesir';
export const APP_VERSION = '4.0.0';

export const SIDEBAR_WIDTH = 260;
export const BOTTOM_NAV_HEIGHT = 72;
export const HEADER_HEIGHT = 64;

export const MOBILE_BREAKPOINT = 1024;

// ============================================================
// MUSTAHIQ CONSTANTS
// ============================================================

export const JENJANG_PENDIDIKAN_OPTIONS = [
  'Dauroh Lughoh',
  "Ma'had",
  'Kuliah',
  'Lainnya',
];

export const TINGKAT_KULIAH_OPTIONS = [
  '1',
  '2',
  '3',
  '4',
  'Dirosat Ulya 1',
  'Dirosat Ulya 2',
  'Duktural',
];

export const STATUS_TEMPAT_TINGGAL_OPTIONS = [
  'Asrama(gratis)',
  'Sewa(Bayar)',
];

export const BIAYA_SEWA_OPTIONS = [
  'Gratis',
  '500-750',
  '750-1000',
  '1000-1250',
  '1250-1500',
  '1500-1750',
  '1750-2000',
  '>2000',
];

export const PEKERJAAN_AYAH_OPTIONS = [
  'Tidak Bekerja',
  'Sudah Meninggal',
  'PNS / ASN',
  'TNI',
  'POLRI',
  'Pegawai BUMN / BUMD',
  'Karyawan Swasta',
  'Wiraswasta / Pengusaha',
  'Pedagang',
  'Petani / Pekebun',
  'Peternak',
  'Nelayan',
  'Guru / Dosen / Tenaga Pendidik',
  'Dokter / Tenaga Kesehatan',
  'Pengacara / Notaris / Konsultan',
  'Arsitek / Insinyur',
  'Sopir / Driver / Kurir',
  'Buruh (Tani / Pabrik / Bangunan)',
  'Pekerja Lepas (Freelancer)',
  'Mekanik / Teknisi',
  'Satpam / Petugas Keamanan',
  'Pemuka Agama / Rohaniwan',
  'Pekerja Seni / Industri Kreatif',
  'Pensiunan',
  'Lainnya',
];

export const PEKERJAAN_IBU_OPTIONS = [
  'Sudah Meninggal',
  'Ibu Rumah Tangga',
  'Tidak Bekerja',
  'PNS / ASN',
  'TNI',
  'POLRI',
  'Pegawai BUMN / BUMD',
  'Karyawan Swasta',
  'Wiraswasta / Pengusaha',
  'Pedagang',
  'Petani / Pekebun',
  'Peternak',
  'Nelayan',
  'Guru / Dosen / Tenaga Pendidik',
  'Dokter / Tenaga Kesehatan (Perawat / Bidan)',
  'Pengacara / Notaris / Konsultan',
  'Arsitek / Insinyur',
  'Sopir / Driver / Kurir',
  'Buruh (Tani / Pabrik / Bangunan)',
  'Pekerja Lepas (Freelancer)',
  'Penjahit / Pengerajin',
  'Pekerja Rumah Tangga',
  'Mekanik / Teknisi',
  'Satpam / Petugas Keamanan',
  'Pemuka Agama / Rohaniwan',
  'Pekerja Seni / Industri Kreatif',
  'Pensiunan',
  'Lainnya',
];

export const PENGHASILAN_OPTIONS = [
  '< 2 Juta',
  '2 Juta - 5 Juta',
  '5 Juta - 10 Juta',
  '10 Juta - 20 Juta',
  '> 20 Juta',
  'Tidak Ada Penghasilan',
];

export const JUMLAH_KENDARAAN_OPTIONS = [
  '0 (Tidak Ada)',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
];

export const JENIS_KENDARAAN_OPTIONS = [
  'Sepeda Motor',
  'Mobil',
  'Truk/Pick Up',
  'Lainnya',
];

export const NOMINAL_KIRIMAN_OPTIONS = [
  '< Rp 500.000',
  'Rp 500.000 - Rp 750.000',
  'Rp 750.000 - Rp 1.000.000',
  'Rp 1.000.000 - Rp 1.250.000',
  'Rp 1.250.000 - Rp 1.500.000',
  'Rp 1.500.000 - Rp 1.750.000',
  'Rp 1.750.000 - Rp 2.000.000',
  'Rp 2.000.000 - Rp 2.250.000',
  'Rp 2.250.000 - Rp 2.500.000',
  'Rp 2.500.000 - Rp 2.750.000',
  'Rp 2.750.000 - Rp 3.000.000',
  '> Rp 3.000.000',
];

export const SUMBER_DANA_OPTIONS = [
  'Bekerja paruh waktu',
  'Beasiswa Penuh',
  'Beasiswa sebagian',
  'Lainnya',
];

export const TUJUAN_HUTANG_OPTIONS = [
  'Kebutuhan Makan / Sehari-hari',
  'Sewa Tempat Tinggal',
  'Kesehatan / Pengobatan',
  'Biaya Pendidikan / Pendaftaran',
  'Lainnya',
];

export const STATUS_BEASISWA_OPTIONS = [
  'Beasiswa Penuh',
  'Beasiswa Sebagian',
];

export const CAKUPAN_BEASISWA_OPTIONS = [
  'Hanya Bebas Biaya Kuliah',
  'Mendapatkan Tunjangan Bulanan',
];

export const KIRIMAN_ORANGTUA_OPTIONS = [
  'Ya, masih.',
  'Tidak',
];

export const STATUS_MENIKAH_OPTIONS = [
  'Sudah',
  'Belum',
];

export const YA_TIDAK_OPTIONS = [
  'Ya',
  'Tidak',
];

export const YA_TIDAK_HUTANG_OPTIONS = [
  'Ya, ada.',
  'Tidak',
];

export const MEROKOK_OPTIONS = [
  'Ya',
  'Tidak',
];