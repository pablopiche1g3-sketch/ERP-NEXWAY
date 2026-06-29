import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const body = await req.json();
    const { to, subject, message, threadId } = body;

    // Build the raw email according to RFC 2822
    const emailLines = [
      `To: ${to}`,
      'Content-type: text/html;charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
      '',
      message,
    ];

    const email = emailLines.join('\r\n');
    // base64url encoding is required by Gmail API
    const base64EncodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const res = await gmail.users.messages.send({
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
