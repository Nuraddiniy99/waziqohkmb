export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type EmptyRelationships = [];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          username: string;
          password_hash: string;
          role: 'admin' | 'user';
          nama_lengkap: string;
          status_aktif: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          password_hash: string;
          role?: 'admin' | 'user';
          nama_lengkap: string;
          status_aktif?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          password_hash?: string;
          role?: 'admin' | 'user';
          nama_lengkap?: string;
          status_aktif?: boolean;
          created_at?: string;
        };
        Relationships: EmptyRelationships;
      };
      settings: {
        Row: {
          id: string;
          key: string;
          value: string;
          last_updated: string;
        };
        Insert: {
          id?: string;
          key: string;
          value: string;
          last_updated?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: string;
          last_updated?: string;
        };
        Relationships: EmptyRelationships;
      };
      donatur: {
        Row: {
          id: string;
          invoice_number: string;
          nama: string;
          kekeluargaan: string;
          jenis_pembayaran: Json;
          metode_pembayaran: string;
          total_egp: number;
          total_idr: number;
          total_usd: number;
          timestamp: string;
          tahun: string;
          last_modified: string;
        };
        Insert: {
          id?: string;
          invoice_number: string;
          nama: string;
          kekeluargaan: string;
          jenis_pembayaran: Json;
          metode_pembayaran: string;
          total_egp?: number;
          total_idr?: number;
          total_usd?: number;
          timestamp?: string;
          tahun: string;
          last_modified?: string;
        };
        Update: {
          id?: string;
          invoice_number?: string;
          nama?: string;
          kekeluargaan?: string;
          jenis_pembayaran?: Json;
          metode_pembayaran?: string;
          total_egp?: number;
          total_idr?: number;
          total_usd?: number;
          timestamp?: string;
          tahun?: string;
          last_modified?: string;
        };
        Relationships: EmptyRelationships;
      };
      penghutang: {
        Row: {
          id: string;
          id_penghutang: string;
          nama_lengkap: string;
          alamat_mesir: string;
          alamat_indonesia: string;
          no_wa_pribadi: string;
          no_wa_kerabat: string;
          no_telp_seluler: string | null;
          foto_ttd_url: string | null;
          status_umum: string;
          registered_date: string;
        };
        Insert: {
          id?: string;
          id_penghutang: string;
          nama_lengkap: string;
          alamat_mesir: string;
          alamat_indonesia: string;
          no_wa_pribadi: string;
          no_wa_kerabat: string;
          no_telp_seluler?: string | null;
          foto_ttd_url?: string | null;
          status_umum?: string;
          registered_date?: string;
        };
        Update: {
          id?: string;
          id_penghutang?: string;
          nama_lengkap?: string;
          alamat_mesir?: string;
          alamat_indonesia?: string;
          no_wa_pribadi?: string;
          no_wa_kerabat?: string;
          no_telp_seluler?: string | null;
          foto_ttd_url?: string | null;
          status_umum?: string;
          registered_date?: string;
        };
        Relationships: EmptyRelationships;
      };
      hutang: {
        Row: {
          id: string;
          id_hutang: string;
          id_penghutang: string;
          rincian_hutang: string;
          jenis_akad: string;
          nominal_pokok: number;
          nominal_total: number;
          mata_uang: string;
          tanggal_jatuh_tempo: string;
          status_hutang: string;
          created_date: string;
        };
        Insert: {
          id?: string;
          id_hutang: string;
          id_penghutang: string;
          rincian_hutang: string;
          jenis_akad: string;
          nominal_pokok: number;
          nominal_total: number;
          mata_uang: string;
          tanggal_jatuh_tempo: string;
          status_hutang?: string;
          created_date?: string;
        };
        Update: {
          id?: string;
          id_hutang?: string;
          id_penghutang?: string;
          rincian_hutang?: string;
          jenis_akad?: string;
          nominal_pokok?: number;
          nominal_total?: number;
          mata_uang?: string;
          tanggal_jatuh_tempo?: string;
          status_hutang?: string;
          created_date?: string;
        };
        Relationships: EmptyRelationships;
      };
      cicilan: {
        Row: {
          id: string;
          id_cicilan: string;
          id_hutang: string;
          id_penghutang: string;
          tanggal_bayar: string;
          nominal_bayar: number;
          mata_uang: string;
          metode_bayar: string;
          bukti_bayar_url: string | null;
          catatan: string | null;
          created_date: string;
        };
        Insert: {
          id?: string;
          id_cicilan: string;
          id_hutang: string;
          id_penghutang: string;
          tanggal_bayar: string;
          nominal_bayar: number;
          mata_uang: string;
          metode_bayar: string;
          bukti_bayar_url?: string | null;
          catatan?: string | null;
          created_date?: string;
        };
        Update: {
          id?: string;
          id_cicilan?: string;
          id_hutang?: string;
          id_penghutang?: string;
          tanggal_bayar?: string;
          nominal_bayar?: number;
          mata_uang?: string;
          metode_bayar?: string;
          bukti_bayar_url?: string | null;
          catatan?: string | null;
          created_date?: string;
        };
        Relationships: EmptyRelationships;
      };
      mustahiq: {
        Row: {
          id: string;
          id_mustahiq: string;
          nama_lengkap: string;
          almamater: string | null;
          tahun_kedatangan: number;
          no_telp_mesir: string | null;
          no_wa_aktif: string;
          alamat_mesir: string;
          alamat_indonesia: string;
          jenjang_pendidikan: string | null;
          mustawa_tingkat: string | null;
          nama_fakultas: string | null;
          nama_jurusan: string | null;
          tingkat_kuliah: string | null;
          pendidikan_lainnya: string | null;
          status_tempat_tinggal: string | null;
          biaya_sewa: string | null;
          pekerjaan_ayah: string | null;
          pekerjaan_ayah_lainnya: string | null;
          pekerjaan_ibu: string | null;
          pekerjaan_ibu_lainnya: string | null;
          penghasilan_ayah: string | null;
          penghasilan_ibu: string | null;
          anak_keberapa: string | null;
          jumlah_kendaraan: number;
          kendaraan_list: Json | null;
          kiriman_orangtua: string | null;
          nominal_kiriman: string | null;
          sumber_dana_utama: string | null;
          sumber_dana_lainnya: string | null;
          nominal_pendapatan: string | null;
          status_menikah: string | null;
          punya_tanggungan: string | null;
          jumlah_tanggungan: number;
          rincian_tanggungan: string | null;
          punya_hutang: string | null;
          hutang_list: Json | null;
          punya_beasiswa: string | null;
          status_beasiswa: string | null;
          cakupan_beasiswa: string | null;
          nominal_beasiswa: string | null;
          merokok: string | null;
          rokok_per_hari: number;
          foto_url: string | null;
          status_verifikasi: string;
          asnaf: string | null;
          kekeluargaan: string | null;
          nominal_diterima: number;
          mata_uang: string;
          tanggal_distribusi: string;
          keterangan: string | null;
          tahun: string;
          scoring: number | null;
          scoring_details: Json | null;
          created_at: string;
          last_modified: string | null;
        };
        Insert: {
          id?: string;
          id_mustahiq: string;
          nama_lengkap: string;
          almamater?: string | null;
          tahun_kedatangan?: number;
          no_telp_mesir?: string | null;
          no_wa_aktif?: string;
          alamat_mesir: string;
          alamat_indonesia: string;
          jenjang_pendidikan?: string | null;
          mustawa_tingkat?: string | null;
          nama_fakultas?: string | null;
          nama_jurusan?: string | null;
          tingkat_kuliah?: string | null;
          pendidikan_lainnya?: string | null;
          status_tempat_tinggal?: string | null;
          biaya_sewa?: string | null;
          pekerjaan_ayah?: string | null;
          pekerjaan_ayah_lainnya?: string | null;
          pekerjaan_ibu?: string | null;
          pekerjaan_ibu_lainnya?: string | null;
          penghasilan_ayah?: string | null;
          penghasilan_ibu?: string | null;
          anak_keberapa?: string | null;
          jumlah_kendaraan?: number;
          kendaraan_list?: Json | null;
          kiriman_orangtua?: string | null;
          nominal_kiriman?: string | null;
          sumber_dana_utama?: string | null;
          sumber_dana_lainnya?: string | null;
          nominal_pendapatan?: string | null;
          status_menikah?: string | null;
          punya_tanggungan?: string | null;
          jumlah_tanggungan?: number;
          rincian_tanggungan?: string | null;
          punya_hutang?: string | null;
          hutang_list?: Json | null;
          punya_beasiswa?: string | null;
          status_beasiswa?: string | null;
          cakupan_beasiswa?: string | null;
          nominal_beasiswa?: string | null;
          merokok?: string | null;
          rokok_per_hari?: number;
          foto_url?: string | null;
          status_verifikasi?: string;
          asnaf?: string | null;
          kekeluargaan?: string | null;
          nominal_diterima?: number;
          mata_uang?: string;
          tanggal_distribusi?: string;
          keterangan?: string | null;
          tahun: string;
          scoring?: number | null;
          scoring_details?: Json | null;
          created_at?: string;
          last_modified?: string | null;
        };
        Update: {
          id?: string;
          id_mustahiq?: string;
          nama_lengkap?: string;
          almamater?: string | null;
          tahun_kedatangan?: number;
          no_telp_mesir?: string | null;
          no_wa_aktif?: string;
          alamat_mesir?: string;
          alamat_indonesia?: string;
          jenjang_pendidikan?: string | null;
          mustawa_tingkat?: string | null;
          nama_fakultas?: string | null;
          nama_jurusan?: string | null;
          tingkat_kuliah?: string | null;
          pendidikan_lainnya?: string | null;
          status_tempat_tinggal?: string | null;
          biaya_sewa?: string | null;
          pekerjaan_ayah?: string | null;
          pekerjaan_ayah_lainnya?: string | null;
          pekerjaan_ibu?: string | null;
          pekerjaan_ibu_lainnya?: string | null;
          penghasilan_ayah?: string | null;
          penghasilan_ibu?: string | null;
          anak_keberapa?: string | null;
          jumlah_kendaraan?: number;
          kendaraan_list?: Json | null;
          kiriman_orangtua?: string | null;
          nominal_kiriman?: string | null;
          sumber_dana_utama?: string | null;
          sumber_dana_lainnya?: string | null;
          nominal_pendapatan?: string | null;
          status_menikah?: string | null;
          punya_tanggungan?: string | null;
          jumlah_tanggungan?: number;
          rincian_tanggungan?: string | null;
          punya_hutang?: string | null;
          hutang_list?: Json | null;
          punya_beasiswa?: string | null;
          status_beasiswa?: string | null;
          cakupan_beasiswa?: string | null;
          nominal_beasiswa?: string | null;
          merokok?: string | null;
          rokok_per_hari?: number;
          foto_url?: string | null;
          status_verifikasi?: string;
          asnaf?: string | null;
          kekeluargaan?: string | null;
          nominal_diterima?: number;
          mata_uang?: string;
          tanggal_distribusi?: string;
          keterangan?: string | null;
          tahun?: string;
          scoring?: number | null;
          scoring_details?: Json | null;
          created_at?: string;
          last_modified?: string | null;
        };
        Relationships: EmptyRelationships;
      };
      exchange_rates: {
        Row: {
          id: string;
          usd_to_egp: number;
          idr_to_egp: number;
          egp_to_idr: number;
          is_fallback: boolean;
          source: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          usd_to_egp: number;
          idr_to_egp: number;
          egp_to_idr: number;
          is_fallback?: boolean;
          source?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          usd_to_egp?: number;
          idr_to_egp?: number;
          egp_to_idr?: number;
          is_fallback?: boolean;
          source?: string;
          updated_at?: string;
        };
        Relationships: EmptyRelationships;
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<
  TableName extends keyof Database['public']['Tables'],
> = Database['public']['Tables'][TableName]['Row'];

export type TablesInsert<
  TableName extends keyof Database['public']['Tables'],
> = Database['public']['Tables'][TableName]['Insert'];

export type TablesUpdate<
  TableName extends keyof Database['public']['Tables'],
> = Database['public']['Tables'][TableName]['Update'];

// Stable application-facing Supabase types.
// This adapter keeps table typing independent from internal generic changes
// between @supabase/ssr and @supabase/supabase-js releases.
export interface SupabaseQueryError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  [key: string]: unknown;
}

export interface SupabaseQueryResult<T> {
  data: T | null;
  error: SupabaseQueryError | null;
  count?: number | null;
  status?: number;
  statusText?: string;
}

export type DatabaseTableName = keyof Database['public']['Tables'];
export type DatabaseRow<T extends DatabaseTableName> = Database['public']['Tables'][T]['Row'];
export type DatabaseInsert<T extends DatabaseTableName> = Database['public']['Tables'][T]['Insert'];
export type DatabaseUpdate<T extends DatabaseTableName> = Database['public']['Tables'][T]['Update'];

export interface TypedSupabaseQueryBuilder<Row, Insert, Update, Result = Row[]>
  extends PromiseLike<SupabaseQueryResult<Result>> {
  select(columns?: string): TypedSupabaseQueryBuilder<Row, Insert, Update, Row[]>;
  insert(values: Insert | Insert[]): TypedSupabaseQueryBuilder<Row, Insert, Update, Row[]>;
  update(values: Update): TypedSupabaseQueryBuilder<Row, Insert, Update, Row[]>;
  upsert(
    values: Insert | Insert[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean; count?: string },
  ): TypedSupabaseQueryBuilder<Row, Insert, Update, Row[]>;
  delete(options?: { count?: string }): TypedSupabaseQueryBuilder<Row, Insert, Update, Row[]>;
  eq(column: string, value: unknown): this;
  neq(column: string, value: unknown): this;
  gt(column: string, value: unknown): this;
  gte(column: string, value: unknown): this;
  lt(column: string, value: unknown): this;
  lte(column: string, value: unknown): this;
  in(column: string, values: readonly unknown[]): this;
  is(column: string, value: unknown): this;
  match(query: Record<string, unknown>): this;
  filter(column: string, operator: string, value: unknown): this;
  not(column: string, operator: string, value: unknown): this;
  contains(column: string, value: unknown): this;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean; referencedTable?: string }): this;
  limit(count: number, options?: { referencedTable?: string }): this;
  range(from: number, to: number, options?: { referencedTable?: string }): this;
  single(): Promise<SupabaseQueryResult<Row>>;
  maybeSingle(): Promise<SupabaseQueryResult<Row | null>>;
}

export interface TypedStorageBucket {
  upload(
    path: string,
    fileBody: Blob | ArrayBuffer | ArrayBufferView | File | FormData | string,
    options?: { cacheControl?: string; contentType?: string; upsert?: boolean },
  ): Promise<SupabaseQueryResult<{ path: string; fullPath?: string }>>;
  remove(paths: string[]): Promise<SupabaseQueryResult<unknown>>;
  getPublicUrl(path: string): { data: { publicUrl: string } };
}

export interface TypedSupabaseClient {
  from<T extends DatabaseTableName>(
    table: T,
  ): TypedSupabaseQueryBuilder<DatabaseRow<T>, DatabaseInsert<T>, DatabaseUpdate<T>>;
  storage: {
    from(bucket: string): TypedStorageBucket;
  };
}
