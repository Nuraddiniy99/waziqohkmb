import type { Currency } from '@/types';

/** Format nominal menggunakan locale Indonesia. */
export const formatNominal = (amount: number, currency: Currency | string = 'EGP'): string => {
  if (!Number.isFinite(amount) || amount <= 0) return '-';

  const normalized = currency.toUpperCase();
  if (normalized === 'IDR' || normalized === 'USD' || normalized === 'EGP') {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: normalized,
      minimumFractionDigits: 0,
      maximumFractionDigits: normalized === 'IDR' ? 0 : 2,
    }).format(amount);
  }

  return new Intl.NumberFormat('id-ID').format(amount);
};

export const parseLocalizedNumber = (value: string): number => {
  const compact = value.replace(/\s/g, '').replace(/[^\d.,-]/g, '');
  if (!compact) return 0;

  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');
  let normalized = compact;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    normalized = compact.split(thousandsSeparator).join('').replace(decimalSeparator, '.');
  } else if (lastComma >= 0) {
    const decimalDigits = compact.length - lastComma - 1;
    normalized = decimalDigits > 0 && decimalDigits <= 2
      ? compact.replace(/\./g, '').replace(',', '.')
      : compact.replace(/,/g, '');
  } else if (lastDot >= 0) {
    const parts = compact.split('.');
    const looksGrouped = parts.length > 2 || (parts.length === 2 && parts[1].length === 3);
    normalized = looksGrouped ? parts.join('') : compact;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Parse nominal dari string tanpa salah membaca pemisah ribuan Indonesia. */
export const parseNominal = (nominal: string): { amount: number; currency: Currency } => {
  if (!nominal?.trim()) return { amount: 0, currency: 'EGP' };

  const cleaned = nominal.toUpperCase().trim();
  const currency: Currency = cleaned.includes('USD') || cleaned.includes('$')
    ? 'USD'
    : cleaned.includes('IDR') || cleaned.includes('RP')
      ? 'IDR'
      : 'EGP';

  return { amount: parseLocalizedNumber(cleaned), currency };
};
