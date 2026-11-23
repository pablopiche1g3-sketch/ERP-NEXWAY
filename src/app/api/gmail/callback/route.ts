import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createGoogleOAuthClient, resolveRedirectUri, saveGmailTokens } from '@/lib/gmail-oauth';

export async function GET(req: Request) {
  const reqUrl = new URL(req.url);
  const code = reqUrl.searchParams.get('code');
  const errorParam = reqUrl.searchParams.get('error');
  const stateReturn = reqUrl.searchParams.get('state') || '/compras?tab=gmail';
  const target = new URL(stateReturn, reqUrl.origin);

  if (errorParam || !code) {
    target.searchParams.set('gmail_error', errorParam || 'no_code');
    return NextResponse.redirect(target);
  }

  try {
    const redirectUri = resolveRedirectUri(req.url);
    const oauth2Client = createGoogleOAuthClient(redirectUri);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profileRes = await gmail.users.getProfile({ userId: 'me' });
    const email = profileRes.data.emailAddress || null;

    await saveGmailTokens({
      access_token: tokens.access_token || null,
      refresh_token: tokens.refresh_token || null,
      expiry_date: tokens.expiry_date || null,
      email,
      connected_at: new Date().toISOString()
    });

    target.searchParams.set('gmail_connected', '1');
    return NextResponse.redirect(target);
  } catch (err: any) {
    console.error('Error en Google OAuth callback:', err);
    target.searchParams.set('gmail_error', 'oauth_failed');
    return NextResponse.redirect(target);
  }
}
