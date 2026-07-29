const HASH_PREFIX = 'pbkdf2_sha256';
const DEFAULT_ITERATIONS = 210_000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const deriveKey = async (
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> => {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const saltBytes = new Uint8Array(salt.byteLength);
  saltBytes.set(salt);

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBytes,
      iterations,
    },
    material,
    KEY_LENGTH * 8,
  );
  return new Uint8Array(bits);
};

const constantTimeEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
};

const encodeLegacyPassword = (value: string): string =>
  bytesToBase64(new TextEncoder().encode(value));

export const isModernPasswordHash = (value: string): boolean =>
  value.startsWith(`${HASH_PREFIX}$`);

export const hashPassword = async (
  password: string,
  iterations = DEFAULT_ITERATIONS,
): Promise<string> => {
  if (!password) throw new Error('Password tidak boleh kosong');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await deriveKey(password, salt, iterations);
  return `${HASH_PREFIX}$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(key)}`;
};

export const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  if (!storedHash) return false;

  if (!isModernPasswordHash(storedHash)) {
    // Kompatibilitas satu arah untuk data lama. Hash akan dimigrasikan setelah login berhasil.
    return constantTimeEqual(
      new TextEncoder().encode(encodeLegacyPassword(password)),
      new TextEncoder().encode(storedHash),
    );
  }

  const [prefix, iterationsText, saltText, hashText] = storedHash.split('$');
  const iterations = Number(iterationsText);
  if (prefix !== HASH_PREFIX || !Number.isInteger(iterations) || iterations < 100_000 || !saltText || !hashText) {
    return false;
  }

  try {
    const salt = base64ToBytes(saltText);
    const expected = base64ToBytes(hashText);
    const actual = await deriveKey(password, salt, iterations);
    return constantTimeEqual(actual, expected);
  } catch {
    return false;
  }
};
