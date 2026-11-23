import { NextResponse } from 'next/server';
import { getAuthenticatedGmail } from '@/lib/gmail-oauth';

interface ParsedAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  isDteJson: boolean;
}

function decodeBase64Url(data?: string | null): string {
  if (!data) return '';
  try {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(normalized, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

function extractBodyAndAttachments(payload: any): { bodyText: string; attachments: ParsedAttachment[] } {
  let plainText = '';
  let htmlText = '';
  const attachments: ParsedAttachment[] = [];

  const walk = (part: any) => {
    if (!part) return;
    if (part.filename && part.body?.attachmentId) {
      const fn = String(part.filename);
      const mime = String(part.mimeType || 'application/octet-stream');
      attachments.push({
        attachmentId: part.body.attachmentId,
        filename: fn,
        mimeType: mime,
        size: Number(part.body.size || 0),
        isDteJson: fn.toLowerCase().endsWith('.json') || mime.includes('json')
      });
    } else if (part.mimeType === 'text/plain' && part.body?.data && !plainText) {
      plainText = decodeBase64Url(part.body.data);
    } else if (part.mimeType === 'text/html' && part.body?.data && !htmlText) {
      htmlText = decodeBase64Url(part.body.data);
    }

    if (Array.isArray(part.parts)) {
      part.parts.forEach(walk);
    }
  };

  walk(payload);

  const bodyText =
    plainText ||
    (htmlText
      ? htmlText
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<[^>]+>/g, ' ')
          .replace(/[ \t]+/g, ' ')
          .trim()
      : '');

  return { bodyText, attachments };
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthenticatedGmail(req);
    if (!auth) {
      return NextResponse.json({ error: 'NOT_CONNECTED', messages: [] }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const folder = searchParams.get('folder') || 'recibidos';
    const search = (searchParams.get('q') || '').trim();
    const maxResults = Math.min(Number(searchParams.get('maxResults') || 20), 40);

    let gmailQuery = '';
    let labelIds: string[] | undefined = undefined;

    if (folder === 'enviados') {
      labelIds = ['SENT'];
    } else if (folder === 'destacados') {
      labelIds = ['STARRED'];
    } else if (folder === 'dte') {
      gmailQuery = 'has:attachment (filename:json OR filename:pdf OR DTE OR CCF OR factura)';
    } else {
      labelIds = ['INBOX'];
    }

    if (search) {
      gmailQuery = gmailQuery ? `(${gmailQuery}) ${search}` : search;
    }

    const listRes = await auth.gmail.users.messages.list({
      userId: 'me',
      labelIds,
      q: gmailQuery || undefined,
      maxResults
    });

    const rawMessages = listRes.data.messages || [];
    if (rawMessages.length === 0) {
      return NextResponse.json({ email: auth.email, messages: [] });
    }

    const details = await Promise.all(
      rawMessages.map(async (m) => {
        try {
          const msgRes = await auth.gmail.users.messages.get({
            userId: 'me',
            id: m.id!,
            format: 'full'
          });
          const data = msgRes.data;
          const headers = data.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

          const { bodyText, attachments } = extractBodyAndAttachments(data.payload);
          const labels = data.labelIds || [];

          return {
            id: data.id || m.id!,
            threadId: data.threadId || m.threadId || data.id!,
            sender: getHeader('From') || 'Remitente desconocido',
            to: getHeader('To') || '',
            subject: getHeader('Subject') || '(Sin asunto)',
            date: getHeader('Date') || '',
            internalDate: Number(data.internalDate || 0),
            snippet: data.snippet || '',
            body: bodyText || data.snippet || '',
            isRead: !labels.includes('UNREAD'),
            isStarred: labels.includes('STARRED'),
            labelIds: labels,
            attachments,
            hasDteJson: attachments.some((a) => a.isDteJson)
          };
        } catch {
          return null;
        }
      })
    );

    const cleanMessages = details.filter(Boolean);
    return NextResponse.json({ email: auth.email, messages: cleanMessages });
  } catch (error: any) {
    console.error('Gmail messages error:', error);
    const status = error?.code === 401 ? 401 : 500;
    return NextResponse.json({ error: error.message || 'Error leyendo correos de Gmail' }, { status });
  }
}
