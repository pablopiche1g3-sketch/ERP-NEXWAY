import { NextResponse } from 'next/server';
import { getAuthenticatedGmail } from '@/lib/gmail-oauth';

interface MailAttachment {
  filename: string;
  mimeType?: string;
  contentBase64: string;
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedGmail(req);
    if (!auth) {
      return NextResponse.json(
        { error: 'Cuenta de Gmail no conectada. Inicia sesión con Google desde Compras/Gerencia o haz clic en Conectar Gmail.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { to, cc, subject, message, threadId, attachments } = body as {
      to: string;
      cc?: string;
      subject: string;
      message?: string;
      threadId?: string;
      attachments?: MailAttachment[];
    };

    if (!to || !subject) {
      return NextResponse.json({ error: 'Destinatario y asunto son obligatorios' }, { status: 400 });
    }

    const encodedSubject = `=?utf-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

    let rawEmail = '';

    if (!hasAttachments) {
      const emailLines = [
        `To: ${to}`,
        ...(cc ? [`Cc: ${cc}`] : []),
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${encodedSubject}`,
        '',
        message || '',
      ];
      rawEmail = emailLines.join('\r\n');
    } else {
      const boundary = `nexway_dte_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const parts: string[] = [
        `To: ${to}`,
        ...(cc ? [`Cc: ${cc}`] : []),
        'MIME-Version: 1.0',
        `Subject: ${encodedSubject}`,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=utf-8',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(message || '', 'utf8').toString('base64'),
      ];

      for (const att of attachments!) {
        if (!att?.filename || !att?.contentBase64) continue;
        parts.push(
          `--${boundary}`,
          `Content-Type: ${att.mimeType || 'application/octet-stream'}; name="${att.filename}"`,
          `Content-Disposition: attachment; filename="${att.filename}"`,
          'Content-Transfer-Encoding: base64',
          '',
          att.contentBase64
        );
      }

      parts.push(`--${boundary}--`, '');
      rawEmail = parts.join('\r\n');
    }

    const base64EncodedEmail = Buffer.from(rawEmail, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await auth.gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: base64EncodedEmail,
        threadId: threadId || undefined,
      },
    });

    return NextResponse.json({
      success: true,
      id: res.data.id,
      threadId: res.data.threadId,
      from: auth.email || null,
    });
  } catch (error: any) {
    console.error('Gmail send error:', error);
    return NextResponse.json({ error: error.message || 'Error enviando correo vía Gmail' }, { status: 500 });
  }
}
