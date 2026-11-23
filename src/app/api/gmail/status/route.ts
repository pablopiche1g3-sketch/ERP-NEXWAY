import { NextResponse } from 'next/server';
import { clearGmailTokens, isGoogleOAuthConfigured, loadGmailTokens } from '@/lib/gmail-oauth';

export async function GET() {
  const configured = isGoogleOAuthConfigured();
  const tokens = await loadGmailTokens();
  return NextResponse.json({
    configured,
    connected: Boolean(tokens && (tokens.access_token || tokens.refresh_token)),
    email: tokens?.email || null,
    connected_at: tokens?.connected_at || null
  });
}

export async function DELETE() {
  await clearGmailTokens();
  return NextResponse.json({ ok: true });
}
