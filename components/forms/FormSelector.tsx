"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { motion } from 'framer-motion';

interface FormSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDonatur?: () => void;
  onOpenPenghutang?: () => void;
}

export const FormSelector: React.FC<FormSelectorProps> = ({ 
  isOpen, 
  onClose,
  onOpenDonatur,
  onOpenPenghutang
}) => {
  const router = useRouter();

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleDonaturClick = () => {
    if (onOpenDonatur) {
      onOpenDonatur();
    } else {
      // Fallback: redirect to donatur page with form param
      router.push('/donatur?form=new');
    }
    onClose();
  };

  const handlePenghutangClick = () => {
    if (onOpenPenghutang) {
      onOpenPenghutang();
    } else {
      // Fallback: redirect to hutang page with form param
      router.push('/hutang?form=penghutang');
    }
    onClose();
  };

  const options = [
    {
      id: 'donasi',
      title: 'Form Donasi',
      description: 'Catat transaksi donatur dan zakat',
      color: 'from-emerald-600 to-emerald-700',
      bgColor: 'bg-emerald-brand',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
          <path d="M12 5v14" />
          <path d="M8 11h8" />
        </svg>
      ),
      onClick: handleDonaturClick,
    },
    {
      id: 'penghutang',
      title: 'Form Daftar Penghutang',
      description: 'Daftarkan profil penghutang baru',
      color: 'from-blue-600 to-blue-700',
      bgColor: 'bg-blue-500',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      onClick: handlePenghutangClick,
    },
  ];

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size="md" 
      showCloseButton={false}
    >
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-emerald-brand/10 flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0f7b54" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            <path d="M9 14l2 2 4-4" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-emerald-dark mb-1">Pilih Formulir</h3>
        <p className="text-sm text-slate-500">Silakan pilih jenis transaksi yang ingin dicatat</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {options.map((option, index) => (
          <motion.button
            key={option.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, type: 'spring', stiffness: 300, damping: 25 }}
            onClick={option.onClick}
            className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-emerald-brand/50"
          >
            {/* Background Gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${option.color} opacity-90`} />
            
            {/* Decorative Pattern */}
            <div className="absolute inset-0 opacity-10">
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id={`grid-${option.id}`} width="16" height="16" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1" fill="white" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill={`url(#grid-${option.id})`} />
              </svg>
            </div>

            {/* Glow Effect on Hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-t from-white/10 to-transparent" />

            <div className="relative z-10">
              {/* Icon */}
              <div className={`w-14 h-14 rounded-xl ${option.bgColor} flex items-center justify-center mb-4 shadow-lg`}>
                {option.icon}
              </div>
              
              {/* Title */}
              <h4 className="text-lg font-bold text-white mb-1">{option.title}</h4>
              
              {/* Description */}
              <p className="text-sm text-white/80 leading-relaxed">{option.description}</p>
              
              {/* Arrow Indicator */}
              <div className="mt-4 flex items-center gap-1 text-white/60 group-hover:text-white transition-colors">
                <span className="text-sm font-medium">Pilih</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-slate-200/50 text-center">
        <button
          onClick={onClose}
          className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          Tutup
        </button>
      </div>
    </Modal>
  );
};