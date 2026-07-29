// ============================================================
// VALIDATORS
// ============================================================

export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const validatePhone = (phone: string): boolean => {
  // Format internasional: +20 atau +62
  const re = /^\+?(20|62)[0-9]{9,12}$/;
  return re.test(phone.replace(/\s/g, ''));
};

export const validateWA = (wa: string): boolean => {
  // WhatsApp harus diawali +20 atau +62
  const re = /^\+?(20|62)[0-9]{9,12}$/;
  return re.test(wa.replace(/\s/g, ''));
};

export const validateMasaJabatan = (masa: string): boolean => {
  const re = /^\d{4}\/\d{4}$/;
  return re.test(masa);
};

export const validateRequired = (value: string | number | undefined): boolean => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return !isNaN(value);
  return true;
};

export const validateNominal = (value: number): boolean => {
  return !isNaN(value) && value > 0;
};

export const validatePassword = (password: string): { valid: boolean; message: string } => {
  if (password.length < 6) {
    return { valid: false, message: 'Password minimal 6 karakter' };
  }
  return { valid: true, message: '' };
};

export const validateUsername = (username: string): { valid: boolean; message: string } => {
  if (username.length < 3) {
    return { valid: false, message: 'Username minimal 3 karakter' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, message: 'Username hanya boleh huruf, angka, dan underscore' };
  }
  return { valid: true, message: '' };
};

export const getValidationErrors = (fields: Record<string, string | number | undefined>): string[] => {
  const errors: string[] = [];

  Object.entries(fields).forEach(([key, value]) => {
    if (!validateRequired(value)) {
      errors.push(`${key} wajib diisi`);
    }
  });

  return errors;
};
