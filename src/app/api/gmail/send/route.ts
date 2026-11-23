import { NextResponse } from 'next/server';
import { getAuthenticatedGmail } from '@/lib/gmail-oauth';

export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedGmail(req);
    if (!auth) {
      return NextResponse.json({ error: 'Cuenta de Gmail no conectada' }, { status: 401 });
    }

    const body = await req.json();
    const { to, subject, message, threadId } = body;

    if (!to || !subject) {
      return NextResponse.json({ error: 'Destinatario y asunto son obligatorios' }, { status: 400 });
    }

    const emailLines = [
      `To: ${to}`,
      'Content-type: text/html;charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
      '',
      message || '',
    ];

    const email = emailLines.join('\r\n');
    const base64EncodedEmail = Buffer.from(email)
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

    return NextResponse.json(res.data);
  } catch (error: any) {
    console.error('Gmail send error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
