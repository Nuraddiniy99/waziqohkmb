# WAZIQOH Super App V4.0

## Menjalankan proyek

1. Salin `.env.example` menjadi `.env.local` dan isi kredensial Supabase.
2. Pastikan schema database selaras dengan `lib/supabase/types.ts`.
3. Instal dan validasi:

```bash
npm ci
npm run typecheck
npm run build
npm run dev
```

Rincian perbaikan tersedia di [`FIX_REPORT.md`](./FIX_REPORT.md).
