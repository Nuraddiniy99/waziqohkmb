"use client";

import React, { useState } from 'react';
import { Donatur } from '@/types';
import toast from 'react-hot-toast';

interface ShareButtonProps {
  donatur: Donatur;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ShareButton: React.FC<ShareButtonProps> = ({ 
  donatur, 
  className = '',
  size = 'md'
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5'
  };

  const iconSizes = {
    sm: 16,
    md: 18,
    lg: 20
  };

  const handleShare = async () => {
    setIsLoading(true);
    const url = `${window.location.origin}/donasisukses?invoice=${donatur.invoice_number}`;
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Bukti Pembayaran WAZIQOH',
          text: `Bukti pembayaran donasi ${donatur.nama}`,
          url: url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link bukti pembayaran berhasil disalin!');
      }
    } catch (error: unknown) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        try {
          await navigator.clipboard.writeText(url);
          toast.success('Link bukti pembayaran berhasil disalin!');
        } catch {
          const input = document.createElement('input');
          input.value = url;
          document.body.appendChild(input);
          input.select();
          document.execCommand('copy');
          document.body.removeChild(input);
          toast.success('Link bukti pembayaran berhasil disalin!');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={isLoading}
      className={`${sizeClasses[size]} rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white transition-all duration-200 ${className}`}
      title="Bagikan Bukti Pembayaran"
    >
      {isLoading ? (
        <div className="animate-spin rounded-full border-2 border-blue-600 border-t-transparent" 
          style={{ width: iconSizes[size], height: iconSizes[size] }} 
        />
      ) : (
        <svg 
          width={iconSizes[size]} 
          height={iconSizes[size]} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      )}
    </button>
  );
};