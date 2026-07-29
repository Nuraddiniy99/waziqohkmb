# WAZIQOH — Laporan Perbaikan

## Status

Semua error TypeScript yang dilaporkan telah ditangani pada akar masalahnya. Proyek juga diaudit untuk cacat runtime, konsistensi tipe, integritas data, unggah berkas, parsing nominal, filter tanggal, backup, dan autentikasi lama.

## Akar masalah error `never`

`lib/supabase/types.ts` sebelumnya belum mengikuti bentuk schema type yang diharapkan Supabase dan belum memuat tabel/kolom yang dipakai aplikasi, terutama `exchange_rates`. Akibatnya `.insert()`, `.update()`, dan hasil query disimpulkan TypeScript sebagai `never`.

Perbaikan:

- Melengkapi `Row`, `Insert`, `Update`, dan `Relationships` untuk seluruh tabel.
- Menambahkan `Views`, `Functions`, `Enums`, dan `CompositeTypes`.
- Menambahkan tabel `exchange_rates` dan kolom Mustahiq yang benar-benar dipakai aplikasi.
- Menghapus penutup masalah berupa `as any` pada seluruh alur bisnis utama.
- Mengetik hasil JSON Supabase dan melakukan normalisasi sebelum dipakai UI.

## Perbaikan utama lainnya

- Menambahkan deklarasi modul CSS sehingga `import './globals.css'` dikenali TypeScript.
- Memperbaiki perbandingan `string | boolean` dengan `number` pada `MustahiqForm`.
- Menghindari pembaruan state React saat render pada detail Mustahiq.
- Memastikan foto lama baru dihapus setelah row database berhasil diperbarui; foto baru dibersihkan bila transaksi database gagal.
- Menghapus row Mustahiq sebelum membersihkan file storage agar kegagalan storage tidak merusak data aktif.
- Memperbaiki filter tanggal agar transaksi pada hari terakhir tidak hilang dan memakai tanggal lokal, bukan tanggal UTC.
- Memperbaiki parser nominal Indonesia (`Rp 1.500.000`, `2,5 juta`, rentang, tanda `<`/`>`).
- Memperbaiki `terbilang`, tanggal tidak valid, persentase negatif, dan perhitungan jatuh tempo.
- Memperbaiki fallback kurs: setiap provider kini memiliki timeout baru, request paralel, cache enam jam, serta fallback database/hardcoded yang konsisten.
- Memperbaiki progress hutang lintas mata uang agar nilai IDR/EGP/USD tidak dijumlahkan sebagai satu unit.
- Memvalidasi mata uang cicilan terhadap mata uang akad.
- Memperbaiki import backup: validasi struktur, konfirmasi destruktif, urutan foreign key, dan rollback best-effort bila restore gagal.
- Mencegah admin menonaktifkan dirinya sendiri atau admin aktif terakhir.
- Mengganti password Base64 dengan PBKDF2-SHA256 (210.000 iterasi). Password lama tetap dapat dipakai dan dimigrasikan otomatis setelah login berhasil.
- Menambahkan rate limit dasar pada endpoint login.
- Menambahkan security headers pada middleware.
- Menambahkan `npm run typecheck`, `.env.example`, `.gitignore`, dan migration schema.

## Validasi yang dilakukan

- Pemeriksaan TypeScript strict lintas file: **lulus** menggunakan deklarasi dependensi lokal karena registry npm tidak tersedia di lingkungan pengerjaan.
- Pemeriksaan seluruh import internal: **lulus**.
- Tes parser nominal, tanggal, `terbilang`, dan pergantian tahun: **lulus**.
- Tes hash PBKDF2, password salah, dan kompatibilitas Base64 lama: **lulus**.
- Pencarian `as any` pada `app`, `components`, `lib`, dan `types`: **tidak ditemukan**.

## Langkah di komputer Anda

```bash
npm ci
npm run typecheck
npm run build
npm run dev
```

Bila schema Supabase belum memiliki tabel/kolom/index yang dibutuhkan, tinjau lalu jalankan:

```text
supabase/migrations/20260729_schema_alignment.sql
```

Pastikan bucket Storage `mustahiq-photos` dan policy Storage sesuai kebutuhan pengguna aplikasi.

## Batasan arsitektur yang masih perlu keputusan

Aplikasi masih memakai sesi aplikasi di `localStorage` dan operasi data langsung dari browser melalui Supabase anon key. PBKDF2 memperbaiki penyimpanan password, tetapi untuk produksi dengan data sensitif, autentikasi idealnya dipindahkan penuh ke **Supabase Auth** dan semua tabel dilindungi **Row Level Security (RLS)**. Perubahan itu memerlukan keputusan role/policy bisnis dan tidak aman untuk ditebak otomatis.

File `.env.local` sengaja tidak disertakan dalam paket hasil karena memuat konfigurasi lingkungan.
