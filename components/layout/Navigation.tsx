"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { Header } from './Header';
import { MobileHeader } from './MobileHeader';
import { FormSelector } from '@/components/forms/FormSelector';
import { DonaturForm } from '@/components/forms/DonaturForm';
import { PenghutangForm } from '@/components/forms/PenghutangForm';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { DEFAULT_SYSTEM_CONFIG } from '@/lib/utils/constants';

export const Navigation: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showFormSelector, setShowFormSelector] = useState(false);
  const [showDonaturForm, setShowDonaturForm] = useState(false);
  const [showPenghutangForm, setShowPenghutangForm] = useState(false);
  const [config] = useLocalStorage('waziqoh_config', DEFAULT_SYSTEM_CONFIG);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Prevent flash of incorrect content on mobile
  if (!isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50/50 via-white to-gold-soft/30">
        <div className="lg:ml-[260px] min-h-screen flex flex-col">
          <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6">
            {children}
          </main>
        </div>
      </div>
    );
  }

  const handleOpenDonatur = () => {
    // Tutup form selector dulu
    setShowFormSelector(false);
    // Kemudian buka donatur form setelah delay kecil agar transisi smooth
    setTimeout(() => {
      setShowDonaturForm(true);
    }, 100);
  };

  const handleOpenPenghutang = () => {
    // Tutup form selector dulu
    setShowFormSelector(false);
    // Kemudian buka penghutang form setelah delay kecil agar transisi smooth
    setTimeout(() => {
      setShowPenghutangForm(true);
    }, 100);
  };

  const handleCloseDonaturForm = () => {
    setShowDonaturForm(false);
  };

  const handleClosePenghutangForm = () => {
    setShowPenghutangForm(false);
  };

  const handleDonaturSuccess = () => {
    setShowDonaturForm(false);
    // Refresh halaman untuk menampilkan data terbaru
    window.location.reload();
  };

  const handlePenghutangSuccess = () => {
    setShowPenghutangForm(false);
    // Refresh halaman untuk menampilkan data terbaru
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/50 via-white to-gold-soft/30">
      <Sidebar onFormClick={() => setShowFormSelector(true)} masaJabatan={config.masa_jabatan} />
      <BottomNav onFormClick={() => setShowFormSelector(true)} />

      <div className="lg:ml-[260px] min-h-screen flex flex-col">
        <MobileHeader />
        <Header />
        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Form Selector */}
      <FormSelector 
        isOpen={showFormSelector} 
        onClose={() => setShowFormSelector(false)}
        onOpenDonatur={handleOpenDonatur}
        onOpenPenghutang={handleOpenPenghutang}
      />

      {/* Donatur Form Modal */}
      {showDonaturForm && (
        <DonaturForm
          editData={null}
          isOpen={showDonaturForm}
          onClose={handleCloseDonaturForm}
          onSuccess={handleDonaturSuccess}
        />
      )}

      {/* Penghutang Form Modal */}
      {showPenghutangForm && (
        <PenghutangForm
          editData={null}
          isOpen={showPenghutangForm}
          onClose={handleClosePenghutangForm}
          onSuccess={handlePenghutangSuccess}
        />
      )}
    </div>
  );
};