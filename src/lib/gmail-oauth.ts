import { google } from 'googleapis';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export const GMAIL_COOKIE_NAME = 'nexway_gmail_tokens';
export const GMAIL_CONFIG_KEY = 'gmail_oauth_connection';

export interface StoredGmailTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
  email?: string | null;
  connected_at?: string;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function resolvePublicOrigin(req: Request): string {
  const fwdHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const fwdProto = req.headers.get('x-forwarded-proto') || 'https';
  if (fwdHost && !fwdHost.startsWith('0.0.0.0')) {
    const proto = fwdHost.includes('localhost') || fwdHost.startsWith('127.0.0.1') ? 'http' : fwdProto.split(',')[0].trim();
    return `${proto}://${fwdHost.split(',')[0].trim()}`;
  }
  if (process.env.GOOGLE_REDIRECT_URI) {
    try {
      return new URL(process.env.GOOGLE_REDIRECT_URI).origin;
    } catch {}
  }
  return new URL(req.url).origin;
}

export function resolveRedirectUri(reqOrUrl: Request | string): string {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  if (typeof reqOrUrl === 'string') {
    const url = new URL(reqOrUrl);
    return `${url.origin}/api/gmail/callback`;
  }
  return `${resolvePublicOrigin(reqOrUrl)}/api/gmail/callback`;
}

export function createGoogleOAuthClient(redirectUri?: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function saveGmailTokens(tokens: StoredGmailTokens) {
  const cookieStore = await cookies();
  cookieStore.set(GMAIL_COOKIE_NAME, JSON.stringify(tokens), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30 // 30 días
  });

  // Respaldo persistente en system_config para cuenta compartida de Compras/Admin
  try {
    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('system_config').upsert(
        {
          key: GMAIL_CONFIG_KEY,
          value: tokens},
        { onConflict: 'key' }
      );
    }
  } catch (err) {
    console.warn('No se pudo respaldar token Gmail en system_config:', err);
  }
}

export async function loadGmailTokens(): Promise<StoredGmailTokens | null> {
  try {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get(GMAIL_COOKIE_NAME)?.value;
    if (rawCookie) {
      const parsed = JSON.parse(rawCookie);
      if (parsed && (parsed.access_token || parsed.refresh_token)) {
        return parsed;
      }
    }
  } catch {}

  try {
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data } = await sb
        .from('system_config')
        .select('value')
        .eq('key', GMAIL_CONFIG_KEY)
        .maybeSingle();
      if (data?.value && (data.value.access_token || data.value.refresh_token)) {
        return data.value as StoredGmailTokens;
      }
    }
  } catch {}

  return null;
}

export async function clearGmailTokens() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(GMAIL_COOKIE_NAME);
  } catch {}

  try {
    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('system_config').delete().eq('key', GMAIL_CONFIG_KEY);
    }
  } catch {}
}

export async function getAuthenticatedGmail(req?: Request) {
  // 1. Soporte legacy por header Bearer
  const authHeader = req?.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    const oauth2Client = createGoogleOAuthClient();
    oauth2Client.setCredentials({ access_token: token });
    return {
      gmail: google.gmail({ version: 'v1', auth: oauth2Client }),
      email: null as string | null
    };
  }

  // 2. Sesión OAuth almacenada (con auto-refresh)
  const stored = await loadGmailTokens();
  if (!stored) return null;

  const oauth2Client = createGoogleOAuthClient();
  oauth2Client.setCredentials({
    access_token: stored.access_token || undefined,
    refresh_token: stored.refresh_token || undefined,
    expiry_date: stored.expiry_date || undefined
  });

  // Refrescar access_token si está por vencer y existe refresh_token
  const isExpiring = stored.expiry_date && Date.now() > stored.expiry_date - 60_000;
  if ((!stored.access_token || isExpiring) && stored.refresh_token && isGoogleOAuthConfigured()) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      const updated: StoredGmailTokens = {
        ...stored,
        access_token: credentials.access_token || stored.access_token,
        expiry_date: credentials.expiry_date || stored.expiry_date
      };
      await saveGmailTokens(updated);
      oauth2Client.setCredentials(credentials);
    } catch (err) {
      console.error('Error refrescando token de Gmail:', err);
    }
  }

  return {
    gmail: google.gmail({ version: 'v1', auth: oauth2Client }),
    email: stored.email || null
  };
}
