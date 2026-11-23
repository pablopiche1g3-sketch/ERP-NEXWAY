import { NextResponse } from 'next/server';
import { getAuthenticatedGmail } from '@/lib/gmail-oauth';

export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedGmail(req);
    if (!auth) {
      return NextResponse.json({ error: 'Cuenta de Gmail no conectada' }, { status: 401 });
    }

    const body = await req.json();
    const { messageId, addLabelIds, removeLabelIds } = body;

    const res = await auth.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: addLabelIds || [],
        removeLabelIds: removeLabelIds || [],
      },
    });

    return NextResponse.json(res.data);
  } catch (error: any) {
    console.error('Gmail modify labels error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
