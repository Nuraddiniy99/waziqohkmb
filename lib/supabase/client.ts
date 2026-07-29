import { createBrowserClient } from '@supabase/ssr';
import type { TypedSupabaseClient } from './types';

export const createClient = (): TypedSupabaseClient => {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      global: {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
      },
    }
  ) as unknown as TypedSupabaseClient;
};

export const supabase = createClient();
