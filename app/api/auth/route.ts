import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hashPassword, isModernPasswordHash, verifyPassword } from '@/lib/utils/password';

interface LoginPayload {
  username?: unknown;
  password?: unknown;
}

const attempts = new Map<string, { count: number; resetAt: number }>();
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

const getClientKey = (request: Request): string =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  || request.headers.get('x-real-ip')
  || 'unknown';

const isRateLimited = (key: string): boolean => {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 0, resetAt: now + ATTEMPT_WINDOW_MS });
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
};

const recordFailure = (key: string): void => {
  const now = Date.now();
  const entry = attempts.get(key);
  attempts.set(key, entry && entry.resetAt > now
    ? { ...entry, count: entry.count + 1 }
    : { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
};

export async function POST(request: Request) {
  const clientKey = getClientKey(request);
  if (isRateLimited(clientKey)) {
    return NextResponse.json(
      { success: false, message: 'Terlalu banyak percobaan login. Coba lagi beberapa saat.' },
      { status: 429 },
    );
  }

  try {
    const payload = (await request.json()) as LoginPayload;
    if (typeof payload.username !== 'string' || typeof payload.password !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Username dan password wajib diisi' },
        { status: 400 },
      );
    }

    const username = payload.username.trim();
    if (!username || !payload.password) {
      return NextResponse.json(
        { success: false, message: 'Username dan password wajib diisi' },
        { status: 400 },
      );
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('users')
      .select('id, username, password_hash, role, nama_lengkap, status_aktif, created_at')
      .eq('username', username)
      .eq('status_aktif', true)
      .maybeSingle();

    if (error) {
      console.error('Auth API database error:', error);
      return NextResponse.json(
        { success: false, message: 'Koneksi database gagal' },
        { status: 500 },
      );
    }

    if (!data || !(await verifyPassword(payload.password, data.password_hash))) {
      recordFailure(clientKey);
      return NextResponse.json(
        { success: false, message: 'Username atau password salah' },
        { status: 401 },
      );
    }

    attempts.delete(clientKey);

    if (!isModernPasswordHash(data.password_hash)) {
      const upgradedHash = await hashPassword(payload.password);
      const { error: migrationError } = await supabase
        .from('users')
        .update({ password_hash: upgradedHash })
        .eq('id', data.id);
      if (migrationError) console.warn('Migrasi hash password gagal:', migrationError);
    }

    const { password_hash: _passwordHash, ...safeUser } = data;
    return NextResponse.json({ success: true, user: safeUser });
  } catch (error) {
    console.error('Auth API error:', error);
    return NextResponse.json(
      { success: false, message: 'Permintaan tidak valid' },
      { status: 400 },
    );
  }
}
