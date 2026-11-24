import { NextResponse } from 'next/server';
import {
  createGoogleOAuthClient,
  isGoogleOAuthConfigured,
  resolvePublicOrigin,
  resolveRedirectUri
} from '@/lib/gmail-oauth';

export async function GET(req: Request) {
  const reqUrl = new URL(req.url);
  const publicOrigin = resolvePublicOrigin(req);
  const returnTo = reqUrl.searchParams.get('returnTo') || '/compras?tab=gmail';

  if (!isGoogleOAuthConfigured()) {
    const target = new URL(returnTo, publicOrigin);
    target.searchParams.set('gmail_error', 'missing_config');
    return NextResponse.redirect(target);
  }

  const redirectUri = resolveRedirectUri(req);
  const oauth2Client = createGoogleOAuthClient(redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    state: returnTo
  });

  return NextResponse.redirect(authUrl);
}
