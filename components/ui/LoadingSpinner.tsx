"use client";

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  className?: string;
  showLogo?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = '#0f7b54',
  className = '',
  showLogo = true,
}) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-20 h-20',
  };

  const containerSizes = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-28 h-28',
    xl: 'w-40 h-40',
  };

  const logoUrl = 'https://dsjkuzirvaniunhwwnml.supabase.co/storage/v1/object/public/assets/icon.png';

  if (showLogo) {
    return (
      <div className={`flex flex-col items-center justify-center ${className}`}>
        <div className={`relative ${containerSizes[size]} flex items-center justify-center`}>
          {/* Single logo with pulse scale effect */}
          <img
            src={logoUrl}
            alt="WAZIQOH Logo"
            className="w-full h-full object-contain animate-pulse-logo"
            style={{
              filter: 'brightness(0) saturate(100%) invert(30%) sepia(98%) saturate(1034%) hue-rotate(110deg) brightness(92%) contrast(89%)',
            }}
            width={size === 'xl' ? 80 : size === 'lg' ? 48 : size === 'md' ? 32 : 16}
            height={size === 'xl' ? 80 : size === 'lg' ? 48 : size === 'md' ? 32 : 16}
          />
        </div>
        <p className="mt-4 text-sm font-medium text-emerald-brand animate-pulse">Memuat...</p>

        <style jsx>{`
          @keyframes pulse-logo {
            0%, 100% { 
              transform: scale(0.8);
            }
            50% { 
              transform: scale(1.2);
            }
          }
          .animate-pulse-logo {
            animation: pulse-logo 1.5s ease-in-out infinite;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg
        className={`animate-spin ${sizes[size]}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke={color}
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill={color}
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
};