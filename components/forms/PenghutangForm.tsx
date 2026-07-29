// components/forms/PenghutangForm.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Penghutang } from '@/types';
import { generateIdPenghutang, getNow } from '@/lib/utils/formatters';
import { validateWA } from '@/lib/utils/validators';
import toast from 'react-hot-toast';
import type { Database } from '@/lib/supabase/types';

interface PenghutangFormProps {
  editData?: Penghutang | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PenghutangForm: React.FC<PenghutangFormProps> = ({
  editData,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    nama_lengkap: '',
    alamat_mesir: '',
    alamat_indonesia: '',
    no_wa_pribadi: '',
    no_wa_kerabat: '',
    no_telp_seluler: '',
    foto_ttd_url: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editData) {
      setFormData({
        nama_lengkap: editData.nama_lengkap,
        alamat_mesir: editData.alamat_mesir,
        alamat_indonesia: editData.alamat_indonesia,
        no_wa_pribadi: editData.no_wa_pribadi,
        no_wa_kerabat: editData.no_wa_kerabat,
        no_telp_seluler: editData.no_telp_seluler || '',
        foto_ttd_url: editData.foto_ttd_url || '',
      });
    } else {
      setFormData({
        nama_lengkap: '',
        alamat_mesir: '',
        alamat_indonesia: '',
        no_wa_pribadi: '',
        no_wa_kerabat: '',
        no_telp_seluler: '',
        foto_ttd_url: '',
      });
      setErrors({});
    }
  }, [editData, isOpen]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nama_lengkap.trim()) newErrors.nama_lengkap = 'Nama wajib diisi';
    if (!formData.alamat_mesir.trim()) newErrors.alamat_mesir = 'Alamat Mesir wajib diisi';
    if (!formData.alamat_indonesia.trim()) newErrors.alamat_indonesia = 'Alamat Indonesia wajib diisi';
    if (!formData.no_wa_pribadi.trim()) {
      newErrors.no_wa_pribadi = 'No. WA wajib diisi';
    } else if (!validateWA(formData.no_wa_pribadi)) {
      newErrors.no_wa_pribadi = 'Format WA tidak valid (gunakan +20 atau +62)';
    }
    if (!formData.no_wa_kerabat.trim()) {
      newErrors.no_wa_kerabat = 'No. WA kerabat wajib diisi';
    } else if (!validateWA(formData.no_wa_kerabat)) {
      newErrors.no_wa_kerabat = 'Format WA tidak valid (gunakan +20 atau +62)';
    }
    if (!formData.foto_ttd_url.trim()) newErrors.foto_ttd_url = 'Foto TTD wajib diisi';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 🔥 FIXED: handleSubmit dengan type assertion untuk Supabase
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);

    try {
      if (editData) {
        const updateData: Database['public']['Tables']['penghutang']['Update'] = {
          ...formData,
          no_telp_seluler: formData.no_telp_seluler || null,
        };

        const { error } = await supabase
          .from('penghutang')
          .update(updateData)
          .eq('id', editData.id);

        if (error) throw error;
        toast.success('Data penghutang diperbarui');
      } else {
        // Get next ID
        const { data: existing, error: fetchError } = await supabase
          .from('penghutang')
          .select('id_penghutang')
          .order('registered_date', { ascending: false })
          .limit(1);

        if (fetchError) throw fetchError;

        let sequence = 1;
        if (existing && existing.length > 0) {
          // 🔥 FIX: Type assertion untuk data existing
          const typedExisting = existing as { id_penghutang: string }[];
          const lastNum = parseInt(typedExisting[0].id_penghutang.split('/').pop() || '0');
          sequence = lastNum + 1;
        }

        // 🔥 FIX: Type assertion untuk insert
        const insertData: Database['public']['Tables']['penghutang']['Insert'] = {
          id_penghutang: generateIdPenghutang(sequence),
          ...formData,
          no_telp_seluler: formData.no_telp_seluler || null,
          status_umum: 'Aktif',
          registered_date: getNow(),
        };

        const { error } = await supabase
          .from('penghutang')
          .insert(insertData);

        if (error) throw error;
        toast.success('Penghutang berhasil didaftarkan');
      }

      // Reset form
      setFormData({
        nama_lengkap: '',
        alamat_mesir: '',
        alamat_indonesia: '',
        no_wa_pribadi: '',
        no_wa_kerabat: '',
        no_telp_seluler: '',
        foto_ttd_url: '',
      });
      setErrors({});
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Gagal menyimpan data');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editData ? 'Edit Penghutang' : 'Pendaftaran Penghutang Baru'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nama Lengkap"
          value={formData.nama_lengkap}
          onChange={(e) => handleChange('nama_lengkap', e.target.value)}
          error={errors.nama_lengkap}
          required
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-emerald-dark mb-1.5">
              Alamat Lengkap di Mesir <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.alamat_mesir}
              onChange={(e) => handleChange('alamat_mesir', e.target.value)}
              rows={3}
              className={`w-full bg-white/70 backdrop-blur-sm border rounded-xl px-4 py-2.5 text-sm text-emerald-dark focus:outline-none focus:ring-2 focus:ring-emerald-brand/30 focus:border-emerald-brand transition-all ${errors.alamat_mesir ? 'border-red-300' : 'border-glass-emerald'}`}
            />
            {errors.alamat_mesir && <p className="mt-1 text-xs text-red-500">{errors.alamat_mesir}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-emerald-dark mb-1.5">
              Alamat Lengkap di Indonesia <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.alamat_indonesia}
              onChange={(e) => handleChange('alamat_indonesia', e.target.value)}
              rows={3}
              className={`w-full bg-white/70 backdrop-blur-sm border rounded-xl px-4 py-2.5 text-sm text-emerald-dark focus:outline-none focus:ring-2 focus:ring-emerald-brand/30 focus:border-emerald-brand transition-all ${errors.alamat_indonesia ? 'border-red-300' : 'border-glass-emerald'}`}
            />
            {errors.alamat_indonesia && <p className="mt-1 text-xs text-red-500">{errors.alamat_indonesia}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="No. WhatsApp Pribadi"
            value={formData.no_wa_pribadi}
            onChange={(e) => handleChange('no_wa_pribadi', e.target.value)}
            placeholder="+20xxxxxxxxxx"
            error={errors.no_wa_pribadi}
            helperText="Format internasional, diawali +20 atau +62"
            required
          />
          <Input
            label="No. WhatsApp Kerabat di Indonesia"
            value={formData.no_wa_kerabat}
            onChange={(e) => handleChange('no_wa_kerabat', e.target.value)}
            placeholder="+62xxxxxxxxxx"
            error={errors.no_wa_kerabat}
            helperText="Kontak darurat keluarga"
            required
          />
        </div>

        <Input
          label="No. Telepon Seluler (GSM/Local Mesir)"
          value={formData.no_telp_seluler}
          onChange={(e) => handleChange('no_telp_seluler', e.target.value)}
          placeholder="Opsional"
        />

        <div>
          <label className="block text-sm font-semibold text-emerald-dark mb-1.5">
            Link Foto Tanda Tangan <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={formData.foto_ttd_url}
              onChange={(e) => handleChange('foto_ttd_url', e.target.value)}
              placeholder="https://..."
              className={`flex-1 bg-white/70 backdrop-blur-sm border rounded-xl px-4 py-2.5 text-sm text-emerald-dark focus:outline-none focus:ring-2 focus:ring-emerald-brand/30 focus:border-emerald-brand transition-all ${errors.foto_ttd_url ? 'border-red-300' : 'border-glass-emerald'}`}
            />
          </div>
          {errors.foto_ttd_url && <p className="mt-1 text-xs text-red-500">{errors.foto_ttd_url}</p>}
          <p className="mt-1 text-xs text-slate-500">URL gambar dari Google Drive, ImgBB, atau Cloudinary</p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Batal
          </Button>
          <Button type="submit" isLoading={isLoading} className="flex-1">
            {editData ? 'Simpan Perubahan' : 'Daftarkan Penghutang'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};