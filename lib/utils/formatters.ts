// ============================================================
// FORMATTERS & HELPERS
// ============================================================

import type { Currency } from '@/types';

const isValidDate = (date: Date): boolean => !Number.isNaN(date.getTime());

const parseDateValue = (value: string): Date | null => {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return isValidDate(date) ? date : null;
};

const pad2 = (value: number): string => String(value).padStart(2, '0');

export const formatRupiah = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
};

export const formatEGP = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
};

export const formatUSD = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
};

export const formatCurrency = (amount: number, currency: Currency | string): string => {
  switch (currency.toUpperCase()) {
    case 'IDR': return formatRupiah(amount);
    case 'EGP': return formatEGP(amount);
    case 'USD': return formatUSD(amount);
    default: return new Intl.NumberFormat('id-ID').format(Number.isFinite(amount) ? amount : 0);
  }
};

export const formatDate = (dateString: string | null | undefined): string => {
  const date = dateString ? parseDateValue(dateString) : null;
  if (!date) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

export const formatDateTime = (dateString: string | null | undefined): string => {
  const date = dateString ? parseDateValue(dateString) : null;
  if (!date) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('id-ID').format(Number.isFinite(num) ? num : 0);
};

export const terbilang = (value: number): string => {
  if (!Number.isFinite(value)) return 'Nol';

  const angka = Math.trunc(Math.abs(value));
  const bilangan = [
    '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan',
    'Sepuluh', 'Sebelas',
  ];

  const spell = (number: number): string => {
    if (number === 0) return '';
    if (number < 12) return bilangan[number];
    if (number < 20) return `${spell(number - 10)} Belas`;
    if (number < 100) return `${spell(Math.floor(number / 10))} Puluh ${spell(number % 10)}`;
    if (number < 200) return `Seratus ${spell(number - 100)}`;
    if (number < 1_000) return `${spell(Math.floor(number / 100))} Ratus ${spell(number % 100)}`;
    if (number < 2_000) return `Seribu ${spell(number - 1_000)}`;
    if (number < 1_000_000) return `${spell(Math.floor(number / 1_000))} Ribu ${spell(number % 1_000)}`;
    if (number < 1_000_000_000) return `${spell(Math.floor(number / 1_000_000))} Juta ${spell(number % 1_000_000)}`;
    if (number < 1_000_000_000_000) return `${spell(Math.floor(number / 1_000_000_000))} Miliar ${spell(number % 1_000_000_000)}`;
    return `${spell(Math.floor(number / 1_000_000_000_000))} Triliun ${spell(number % 1_000_000_000_000)}`;
  };

  if (angka === 0) return 'Nol';
  const result = spell(angka).replace(/\s+/g, ' ').trim();
  return value < 0 ? `Minus ${result}` : result;
};

export const generateInvoiceNumber = (year: string, sequence: number): string =>
  `INV/${year}/${String(sequence).padStart(3, '0')}`;

export const generateIdPenghutang = (sequence: number): string =>
  `PHT/${String(sequence).padStart(4, '0')}`;

export const generateIdHutang = (sequence: number): string =>
  `HTG/${String(sequence).padStart(4, '0')}`;

export const generateIdCicilan = (sequence: number): string =>
  `CCL/${String(sequence).padStart(4, '0')}`;

export const generateIdMustahiq = (sequence: number): string =>
  `MTH/${String(sequence).padStart(4, '0')}`;

export const getCurrentYear = (): string => String(new Date().getFullYear());

export const toLocalDateString = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const getToday = (): string => toLocalDateString(new Date());

export const getNextDate = (dateString: string): string => {
  const date = parseDateValue(dateString);
  if (!date) return dateString;
  date.setDate(date.getDate() + 1);
  return toLocalDateString(date);
};

export const getNow = (): string => new Date().toISOString();

export const calculatePercentage = (value: number, total: number): number => {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
};

export const getDaysUntil = (dateString: string): number => {
  const target = parseDateValue(dateString);
  if (!target) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
};

export const isOverdue = (dateString: string): boolean => getDaysUntil(dateString) < 0;

export const isNearDue = (dateString: string, days: number = 7): boolean => {
  const daysLeft = getDaysUntil(dateString);
  return daysLeft >= 0 && daysLeft <= days;
};
