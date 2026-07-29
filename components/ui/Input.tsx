// components/ui/Input.tsx

"use client";

import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  warning?: string;  // 🔥 TAMBAHKAN PROP WARNING
  helperText?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ 
    label, 
    error, 
    warning,  // 🔥 TERIMA PROP WARNING
    helperText, 
    icon, 
    iconPosition = 'left', 
    className = '', 
    ...props 
  }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-semibold text-emerald-dark mb-1.5">
            {label}
            {props.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          {icon && iconPosition === 'left' && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full bg-white/70 backdrop-blur-sm border rounded-xl px-4 py-2.5 text-sm text-emerald-dark
              placeholder:text-slate-400
              focus:outline-none focus:ring-2 focus:ring-emerald-brand/30 focus:border-emerald-brand
              transition-all duration-200
              ${icon && iconPosition === 'left' ? 'pl-10' : ''}
              ${icon && iconPosition === 'right' ? 'pr-10' : ''}
              ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}
              ${warning ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-200' : ''}
              ${!error && !warning ? 'border-glass-emerald hover:border-emerald-brand/40' : ''}
              ${className}
            `}
            {...props}
          />
          {icon && iconPosition === 'right' && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              {icon}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1 text-xs text-red-500 font-medium">{error}</p>
        )}
        {warning && !error && (
          <p className="mt-1 text-xs text-amber-600 font-medium">{warning}</p>
        )}
        {helperText && !error && !warning && (
          <p className="mt-1 text-xs text-slate-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';