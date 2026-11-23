import { NextResponse } from 'next/server';
import { getAuthenticatedGmail } from '@/lib/gmail-oauth';

export async function GET(req: Request) {
  try {
    const auth = await getAuthenticatedGmail(req);
    if (!auth) {
      return NextResponse.json({ error: 'NOT_CONNECTED' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get('messageId');
    const attachmentId = searchParams.get('attachmentId');
    const filename = searchParams.get('filename') || 'adjunto';
    const parseDte = searchParams.get('parseDte') === '1';

    if (!messageId || !attachmentId) {
      return NextResponse.json({ error: 'Faltan parámetros messageId o attachmentId' }, { status: 400 });
    }

    const attRes = await auth.gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId
    });

    const rawData = attRes.data.data || '';
    const normalized = rawData.replace(/-/g, '+').replace(/_/g, '/');
    const buffer = Buffer.from(normalized, 'base64');

    if (parseDte) {
      const text = buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
      const json = JSON.parse(text);

      const ident = json.identificacion || {};
      const emisor = json.emisor || {};
      const resumen = json.resumen || {};
      const cuerpo = Array.isArray(json.cuerpoDocumento) ? json.cuerpoDocumento : [];

      const total =
        Number(resumen.montoTotalOperacion) ||
        Number(resumen.totalPagar) ||
        Number(resumen.subTotalVentas) ||
        cuerpo.reduce((acc: number, it: any) => acc + (Number(it.ventaGravada) || (Number(it.cantidad) || 0) * (Number(it.precioUni) || 0)), 0);

      return NextResponse.json({
        parsed: true,
        dte: {
          id: `gmail-dte-${ident.codigoGeneracion || messageId}`,
          gmail_message_id: messageId,
          filename,
          documento_numero: ident.numeroControl || filename.replace(/\.json$/i, ''),
          codigo_generacion: ident.codigoGeneracion || '',
          tipo_dte: ident.tipoDte || '03',
          fecha_emision: ident.fecEmi || new Date().toISOString().split('T')[0],
          proveedor_nombre: emisor.nombre || emisor.nombreComercial || 'Proveedor DTE',
          proveedor_nit: emisor.nit || '',
          total: Number(total.toFixed(2)),
          items_count: cuerpo.length,
          estado: 'PENDIENTE_PROCESAR',
          payload_json: json,
          created_at: new Date().toISOString()
        }
      });
    }

    const mimeType = filename.toLowerCase().endsWith('.pdf')
      ? 'application/pdf'
      : filename.toLowerCase().endsWith('.json')
      ? 'application/json'
      : 'application/octet-stream';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`
      }
    });
  } catch (error: any) {
    console.error('Gmail attachment error:', error);
    return NextResponse.json({ error: error.message || 'No se pudo procesar el adjunto' }, { status: 500 });
  }
}
