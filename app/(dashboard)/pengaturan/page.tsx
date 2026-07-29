// app/(dashboard)/pengaturan/page.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { User, SystemConfig } from '@/types';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { DEFAULT_SYSTEM_CONFIG } from '@/lib/utils/constants';
import toast from 'react-hot-toast';
import type { Database } from '@/lib/supabase/types';
import { hashPassword } from '@/lib/utils/password';

const BACKUP_TABLES = ['users', 'settings', 'donatur', 'penghutang', 'hutang', 'cicilan', 'mustahiq'] as const;
type BackupTable = (typeof BACKUP_TABLES)[number];
type BackupPayload = Partial<Record<BackupTable, unknown[]>>;

const isBackupTable = (value: string): value is BackupTable =>
  (BACKUP_TABLES as readonly string[]).includes(value);

const readBackupTable = async (table: BackupTable): Promise<unknown[]> => {
  let result: { data: unknown[] | null; error: { message: string } | null };
  switch (table) {
    case 'users': result = await supabase.from('users').select('*'); break;
    case 'settings': result = await supabase.from('settings').select('*'); break;
    case 'donatur': result = await supabase.from('donatur').select('*'); break;
    case 'penghutang': result = await supabase.from('penghutang').select('*'); break;
    case 'hutang': result = await supabase.from('hutang').select('*'); break;
    case 'cicilan': result = await supabase.from('cicilan').select('*'); break;
    case 'mustahiq': result = await supabase.from('mustahiq').select('*'); break;
  }
  if (result.error) throw new Error(`Gagal membaca ${table}: ${result.error.message}`);
  return result.data ?? [];
};

const clearBackupTable = async (table: BackupTable): Promise<void> => {
  let error: { message: string } | null = null;
  switch (table) {
    case 'users': ({ error } = await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000')); break;
    case 'settings': ({ error } = await supabase.from('settings').delete().neq('id', '00000000-0000-0000-0000-000000000000')); break;
    case 'donatur': ({ error } = await supabase.from('donatur').delete().neq('id', '00000000-0000-0000-0000-000000000000')); break;
    case 'penghutang': ({ error } = await supabase.from('penghutang').delete().neq('id', '00000000-0000-0000-0000-000000000000')); break;
    case 'hutang': ({ error } = await supabase.from('hutang').delete().neq('id', '00000000-0000-0000-0000-000000000000')); break;
    case 'cicilan': ({ error } = await supabase.from('cicilan').delete().neq('id', '00000000-0000-0000-0000-000000000000')); break;
    case 'mustahiq': ({ error } = await supabase.from('mustahiq').delete().neq('id', '00000000-0000-0000-0000-000000000000')); break;
  }
  if (error) throw new Error(`Gagal mengosongkan ${table}: ${error.message}`);
};

const restoreBackupTable = async (table: BackupTable, rows: unknown[]): Promise<void> => {
  if (rows.length === 0) return;

  let error: { message: string } | null = null;
  switch (table) {
    case 'users': ({ error } = await supabase.from('users').insert(rows as Database['public']['Tables']['users']['Insert'][])); break;
    case 'settings': ({ error } = await supabase.from('settings').insert(rows as Database['public']['Tables']['settings']['Insert'][])); break;
    case 'donatur': ({ error } = await supabase.from('donatur').insert(rows as Database['public']['Tables']['donatur']['Insert'][])); break;
    case 'penghutang': ({ error } = await supabase.from('penghutang').insert(rows as Database['public']['Tables']['penghutang']['Insert'][])); break;
    case 'hutang': ({ error } = await supabase.from('hutang').insert(rows as Database['public']['Tables']['hutang']['Insert'][])); break;
    case 'cicilan': ({ error } = await supabase.from('cicilan').insert(rows as Database['public']['Tables']['cicilan']['Insert'][])); break;
    case 'mustahiq': ({ error } = await supabase.from('mustahiq').insert(rows as Database['public']['Tables']['mustahiq']['Insert'][])); break;
  }
  if (error) throw new Error(`Gagal memulihkan ${table}: ${error.message}`);
};

export default function PengaturanPage() {
  const { isAdmin, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [config, setConfig] = useLocalStorage<SystemConfig>('waziqoh_config', DEFAULT_SYSTEM_CONFIG);
  const [users, setUsers] = useState<User[]>([]);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [activeTab, setActiveTab] = useState('umum');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Form states
  const [settingsForm, setSettingsForm] = useState(config);
  const [userForm, setUserForm] = useState({ 
    username: '', 
    password: '', 
    nama_lengkap: '', 
    role: 'user' as 'admin' | 'user' 
  });

  // Check auth and redirect
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/');
    }
  }, [authLoading, isAdmin, router]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  useEffect(() => {
    setSettingsForm(config);
  }, [config]);

  // 🔥 FIXED: fetchUsers dengan type assertion
  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, role, nama_lengkap, status_aktif, created_at')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setUsers(data ?? []);
    } catch (err) {
      console.error('Fetch users error:', err);
      toast.error('Gagal memuat data pengguna');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // 🔥 FIXED: handleSaveSettings dengan type yang benar
  const handleSaveSettings = async () => {
    if (!settingsForm.masa_jabatan.match(/^\d{4}\/\d{4}$/)) {
      toast.error('Format masa jabatan harus XXXX/XXXX');
      return;
    }

    try {
      const settingsData = [
        { key: 'masa_jabatan', value: settingsForm.masa_jabatan },
        { key: 'tahun_aktif', value: settingsForm.tahun_aktif },
        { key: 'ttd_direktur_url', value: settingsForm.ttd_direktur_url },
        { key: 'ttd_direktur_nama', value: settingsForm.ttd_direktur_nama },
        { key: 'ttd_direktur_jabatan', value: settingsForm.ttd_direktur_jabatan },
        { key: 'kop_surat_url', value: settingsForm.kop_surat_url },
      ];

      for (const s of settingsData) {
        const { error } = await supabase
          .from('settings')
          .upsert(
            { key: s.key, value: s.value, last_updated: new Date().toISOString() },
            { onConflict: 'key' }
          );
        if (error) throw error;
      }

      setConfig(settingsForm);
      toast.success('Pengaturan berhasil disimpan');
    } catch (err) {
      console.error('Save settings error:', err);
      toast.error('Gagal menyimpan pengaturan');
    }
  };

  // 🔥 FIXED: handleAddUser dengan type yang benar
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = userForm.username.trim();
    const namaLengkap = userForm.nama_lengkap.trim();
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
      toast.error('Username harus 3–32 karakter dan hanya boleh berisi huruf, angka, titik, garis bawah, atau strip');
      return;
    }
    if (userForm.password.length < 8) {
      toast.error('Password baru minimal 8 karakter');
      return;
    }
    if (!namaLengkap) {
      toast.error('Nama lengkap wajib diisi');
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .insert({
          username,
          password_hash: await hashPassword(userForm.password),
          nama_lengkap: namaLengkap,
          role: userForm.role,
          status_aktif: true,
        });

      if (error) throw error;
      
      toast.success('Pengguna berhasil ditambahkan');
      setShowUserForm(false);
      setUserForm({ username: '', password: '', nama_lengkap: '', role: 'user' });
      fetchUsers();
    } catch (err) {
      console.error('Add user error:', err);
      toast.error('Gagal menambahkan pengguna');
    }
  };

  const handleToggleUser = async (id: string, currentStatus: boolean) => {
    const target = users.find((item) => item.id === id);
    if (!target) return;
    if (target.id === user?.id && currentStatus) {
      toast.error('Akun yang sedang digunakan tidak dapat dinonaktifkan');
      return;
    }
    if (target.role === 'admin' && currentStatus) {
      const activeAdminCount = users.filter((item) => item.role === 'admin' && item.status_aktif).length;
      if (activeAdminCount <= 1) {
        toast.error('Minimal satu akun admin harus tetap aktif');
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ status_aktif: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      toast.success('Status berhasil diubah');
      await fetchUsers();
    } catch (err) {
      console.error('Toggle user error:', err);
      toast.error('Gagal mengubah status');
    }
  };


  const handleResetData = async () => {
    if (!user) {
      toast.error('Sesi admin tidak ditemukan');
      return;
    }
    if (resetConfirmText !== 'HAPUS DATA WAZIQOH') {
      toast.error('Teks konfirmasi tidak sesuai');
      return;
    }

    try {
      const verificationResponse = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, password: resetPassword }),
        cache: 'no-store',
      });
      const verification = await verificationResponse.json() as {
        success?: boolean;
        user?: { id?: string; role?: string };
      };
      if (!verificationResponse.ok || verification.success !== true
        || verification.user?.id !== user.id || verification.user.role !== 'admin') {
        toast.error('Password admin salah');
        return;
      }

      // Urutan penghapusan mengikuti dependensi foreign key.
      for (const table of ['cicilan', 'hutang', 'penghutang', 'donatur', 'mustahiq'] as const) {
        await clearBackupTable(table);
      }

      toast.success('Semua data transaksi berhasil dihapus');
      setShowResetConfirm(false);
      setResetPassword('');
      setResetConfirmText('');
    } catch (err) {
      console.error('Reset data error:', err);
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus data');
    }
  };

  const handleExportJSON = async () => {
    try {
      const backup: BackupPayload = {};

      for (const table of BACKUP_TABLES) {
        backup[table] = await readBackupTable(table);
      }

      const backupDocument = { _meta: { app: 'WAZIQOH', version: 1, exported_at: new Date().toISOString() }, ...backup };
      const blob = new Blob([JSON.stringify(backupDocument, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `waziqoh_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup berhasil diunduh');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Gagal export data');
    }
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Format backup tidak valid');
      }

      const backup: BackupPayload = {};
      for (const [table, rows] of Object.entries(parsed)) {
        if (!isBackupTable(table) || !Array.isArray(rows)) continue;
        if (!rows.every((row) => row && typeof row === 'object' && !Array.isArray(row))) {
          throw new Error(`Isi tabel ${table} tidak valid`);
        }
        backup[table] = rows;
      }

      const presentTables = BACKUP_TABLES.filter((table) => Array.isArray(backup[table]));
      if (presentTables.length === 0) throw new Error('Backup tidak memuat tabel yang dikenali');

      if (backup.users) {
        const hasActiveAdmin = backup.users.some((row) => {
          const item = row as Record<string, unknown>;
          return item.role === 'admin' && item.status_aktif === true;
        });
        if (!hasActiveAdmin) throw new Error('Backup pengguna harus memiliki minimal satu admin aktif');
      }

      const approved = window.confirm(
        `Import akan mengganti data pada ${presentTables.length} tabel. Lanjutkan hanya jika file backup tepercaya.`,
      );
      if (!approved) return;

      const deleteOrder: BackupTable[] = ['cicilan', 'hutang', 'penghutang', 'donatur', 'mustahiq', 'settings', 'users'];
      const insertOrder: BackupTable[] = ['users', 'settings', 'donatur', 'penghutang', 'hutang', 'cicilan', 'mustahiq'];
      const previousData: BackupPayload = {};
      for (const table of presentTables) previousData[table] = await readBackupTable(table);

      try {
        for (const table of deleteOrder) {
          if (presentTables.includes(table)) await clearBackupTable(table);
        }
        for (const table of insertOrder) {
          const rows = backup[table];
          if (rows) await restoreBackupTable(table, rows);
        }
      } catch (restoreError) {
        console.error('Import gagal, menjalankan rollback:', restoreError);
        try {
          for (const table of deleteOrder) {
            if (presentTables.includes(table)) await clearBackupTable(table);
          }
          for (const table of insertOrder) {
            const rows = previousData[table];
            if (rows) await restoreBackupTable(table, rows);
          }
        } catch (rollbackError) {
          console.error('Rollback backup gagal:', rollbackError);
          throw new Error('Import dan rollback gagal. Pulihkan database dari backup manual secepatnya.');
        }
        throw restoreError;
      }

      toast.success('Data berhasil dipulihkan');
      await fetchUsers();
    } catch (err) {
      console.error('Import error:', err);
      toast.error(err instanceof Error ? err.message : 'Gagal import data');
    } finally {
      e.target.value = '';
    }
  };


  // If loading or not admin, show nothing (redirect handled by useEffect)
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-brand" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-emerald-dark">Pengaturan</h1>
        <p className="text-sm text-slate-500 mt-1">Pusat kendali sistem (Admin Only)</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {[
          { id: 'umum', label: 'Umum' },
          { id: 'users', label: 'Manajemen Akun' },
          { id: 'data', label: 'Data & Backup' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id 
                ? 'border-emerald-brand text-emerald-brand' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Umum */}
      {activeTab === 'umum' && (
        <div className="space-y-6 max-w-2xl">
          <Card>
            <h3 className="text-lg font-semibold text-emerald-dark mb-4">Konfigurasi Sistem</h3>
            <div className="space-y-4">
              <Input
                label="Masa Jabatan"
                value={settingsForm.masa_jabatan}
                onChange={(e) => setSettingsForm({ ...settingsForm, masa_jabatan: e.target.value })}
                placeholder="2025/2026"
                helperText="Format wajib: XXXX/XXXX"
              />
              <Input
                label="Tahun Aktif"
                value={settingsForm.tahun_aktif}
                onChange={(e) => setSettingsForm({ ...settingsForm, tahun_aktif: e.target.value })}
                placeholder="2026"
              />
              <Input
                label="Nama Direktur"
                value={settingsForm.ttd_direktur_nama}
                onChange={(e) => setSettingsForm({ ...settingsForm, ttd_direktur_nama: e.target.value })}
                placeholder="Ust. Nuraddiniy, S.Lc."
              />
              <Input
                label="Jabatan Direktur"
                value={settingsForm.ttd_direktur_jabatan}
                onChange={(e) => setSettingsForm({ ...settingsForm, ttd_direktur_jabatan: e.target.value })}
                placeholder="Direktur Utama WAZIQOH KMB Mesir"
              />
              <Input
                label="URL Tanda Tangan Direktur"
                value={settingsForm.ttd_direktur_url}
                onChange={(e) => setSettingsForm({ ...settingsForm, ttd_direktur_url: e.target.value })}
                placeholder="https://..."
                helperText="URL gambar transparan PNG"
              />
              <Input
                label="URL Kop Surat"
                value={settingsForm.kop_surat_url}
                onChange={(e) => setSettingsForm({ ...settingsForm, kop_surat_url: e.target.value })}
                placeholder="https://..."
              />
              <Button onClick={handleSaveSettings} className="w-full">
                Simpan Pengaturan
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Users */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-emerald-dark">Daftar Pengguna</h3>
            <Button size="sm" onClick={() => setShowUserForm(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Tambah Akun
            </Button>
          </div>

          {isLoadingUsers ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-brand" />
            </div>
          ) : (
            <Table
              columns={[
                { key: 'username', header: 'Username' },
                { key: 'nama_lengkap', header: 'Nama Lengkap' },
                { 
                  key: 'role', 
                  header: 'Role', 
                  render: (u: User) => <Badge variant={u.role === 'admin' ? 'danger' : 'primary'}>{u.role}</Badge> 
                },
                { 
                  key: 'status', 
                  header: 'Status', 
                  render: (u: User) => <Badge variant={u.status_aktif ? 'success' : 'default'}>{u.status_aktif ? 'Aktif' : 'Nonaktif'}</Badge> 
                },
                { 
                  key: 'actions', 
                  header: 'Aksi', 
                  render: (u: User) => (
                    <button
                      onClick={() => handleToggleUser(u.id, u.status_aktif)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        u.status_aktif 
                          ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                          : 'bg-green-100 text-green-600 hover:bg-green-200'
                      }`}
                    >
                      {u.status_aktif ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  )
                },
              ]}
              data={users}
              keyExtractor={(u) => u.id}
            />
          )}

          <Modal isOpen={showUserForm} onClose={() => setShowUserForm(false)} title="Tambah Akun Baru">
            <form onSubmit={handleAddUser} className="space-y-4">
              <Input 
                label="Username" 
                value={userForm.username} 
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} 
                required 
              />
              <Input 
                label="Password" 
                type="password" 
                value={userForm.password} 
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} 
                required 
              />
              <Input 
                label="Nama Lengkap" 
                value={userForm.nama_lengkap} 
                onChange={(e) => setUserForm({ ...userForm, nama_lengkap: e.target.value })} 
                required 
              />
              <Select 
                label="Role" 
                value={userForm.role} 
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'admin' | 'user' })} 
                options={[{ value: 'user', label: 'User' }, { value: 'admin', label: 'Admin' }]} 
              />
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => setShowUserForm(false)} className="flex-1">
                  Batal
                </Button>
                <Button type="submit" className="flex-1">
                  Tambah
                </Button>
              </div>
            </form>
          </Modal>
        </div>
      )}

      {/* Tab: Data */}
      {activeTab === 'data' && (
        <div className="space-y-6 max-w-2xl">
          <Card>
            <h3 className="text-lg font-semibold text-emerald-dark mb-4">Export & Import Data</h3>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" onClick={handleExportJSON} className="flex-1">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export JSON
                </Button>
                <label className="flex-1 cursor-pointer">
                  <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                  <div className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2 border-emerald-brand text-emerald-brand font-semibold text-sm hover:bg-emerald-brand hover:text-white transition-all">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Import JSON
                  </div>
                </label>
              </div>
            </div>
          </Card>

          <Card className="border-red-200 bg-red-50/50">
            <h3 className="text-lg font-semibold text-red-600 mb-2">Zona Berbahaya</h3>
            <p className="text-sm text-slate-600 mb-4">Hapus semua data permanen. Tindakan ini tidak dapat dibatalkan.</p>
            <Button variant="danger" onClick={() => setShowResetConfirm(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Hapus Semua Data
            </Button>
          </Card>

          <Modal isOpen={showResetConfirm} onClose={() => setShowResetConfirm(false)} title="Konfirmasi Penghapusan" size="md">
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-600 font-semibold">⚠️ PERINGATAN: Tindakan ini akan menghapus SEMUA data secara permanen!</p>
              </div>
              <Input
                label="Masukkan Password Admin"
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Password saat ini"
              />
              <Input
                label="Ketik konfirmasi: HAPUS DATA WAZIQOH"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="HAPUS DATA WAZIQOH"
              />
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => setShowResetConfirm(false)} className="flex-1">
                  Batal
                </Button>
                <Button variant="danger" onClick={handleResetData} className="flex-1">
                  Hapus Permanen
                </Button>
              </div>
            </div>
          </Modal>
        </div>
      )}
    </div>
  );
}