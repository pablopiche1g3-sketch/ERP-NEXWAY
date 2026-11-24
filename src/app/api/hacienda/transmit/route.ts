import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_HACIENDA_SANDBOX_URL,
  buildOfficialDteJson,
} from '@/lib/hacienda-sandbox';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawBaseUrl = (body?.baseUrl || DEFAULT_HACIENDA_SANDBOX_URL).toString().trim();
    const baseUrl = rawBaseUrl.replace(/\/+$/, '');
    const ambiente: '00' | '01' = body?.ambiente === '01' ? '01' : '00';

    let dteJson = body?.dteJson;
    if (body?.testConnection && !dteJson) {
      dteJson = buildOfficialDteJson({
        correlative: `TEST-${Date.now().toString().slice(-6)}`,
        docType: 'FACTURA',
        total: 11.3,
        paymentMethod: 'Efectivo',
        items: [
          {
            sku: 'TEST-MH',
            name: 'Prueba de Conectividad Sandbox MH',
            quantity: 1,
            unitPrice: 11.3,
          },
        ],
        customer: {
          name: 'Consumidor Final Prueba',
          dui: '000000000',
          email: 'prueba@nexway.sv',
        },
        company: body?.company || null,
        ambiente,
      });
    }

    if (!dteJson || typeof dteJson !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'Se requiere el objeto dteJson para transmitir.' },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      // Paso 1: Firmar electrónicamente (JWS simulado en DTE Studio)
      let signedJws: string | null = null;
      try {
        const signRes = await fetch(`${baseUrl}/api/dte/firmar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dte: dteJson }),
          signal: controller.signal,
        });
        const signData = await signRes.json().catch(() => null);
        if (signRes.ok && signData?.body) {
          signedJws = signData.body;
        }
      } catch (signErr) {
        console.warn('Advertencia al firmar en sandbox MH:', signErr);
      }

      // Paso 2: Transmitir a Recepción Oficial de DTEs (Simulador MH)
      const version = Number(dteJson?.identificacion?.version) || (dteJson?.identificacion?.tipoDte === '03' ? 3 : 1);
      const tipoDte = dteJson?.identificacion?.tipoDte || '01';

      const recRes = await fetch(`${baseUrl}/api/dte/recepcion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ambiente,
          idEnvio: 1,
          version,
          tipoDte,
          documento: dteJson,
        }),
        signal: controller.signal,
      });

      const recData = await recRes.json().catch(() => null);
      if (!recData) {
        return NextResponse.json(
          {
            ok: false,
            estado: 'ERROR',
            selloRecibido: null,
            codigoGeneracion: dteJson?.identificacion?.codigoGeneracion || null,
            numeroControl: dteJson?.identificacion?.numeroControl || null,
            fhaRecibido: null,
            codigoMsg: String(recRes.status),
            descripcionMsg: `Respuesta inválida del servidor Sandbox (HTTP ${recRes.status})`,
            observaciones: ['El endpoint no devolvió un JSON válido.'],
            signedJws,
            dteJson,
          },
          { status: 200 }
        );
      }

      const estado = recData.estado === 'PROCESADO' ? 'PROCESADO' : 'RECHAZADO';
      return NextResponse.json({
        ok: estado === 'PROCESADO',
        httpStatus: recRes.status,
        estado,
        selloRecibido: recData.selloRecibido || null,
        codigoGeneracion: recData.codigoGeneracion || dteJson?.identificacion?.codigoGeneracion || null,
        numeroControl: dteJson?.identificacion?.numeroControl || null,
        fhaRecibido: recData.fhaRecibido || recData.fhProcesamiento || null,
        codigoMsg: recData.codigoMsg || null,
        descripcionMsg: recData.descripcionMsg || null,
        observaciones: Array.isArray(recData.observaciones) ? recData.observaciones : [],
        signedJws,
        dteJson,
        rawResponse: recData,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError';
    return NextResponse.json(
      {
        ok: false,
        estado: 'ERROR',
        selloRecibido: null,
        observaciones: [
          isAbort
            ? 'Tiempo de espera agotado al conectar con el Sandbox MH (15s).'
            : err?.message || 'Error de conexión con el Sandbox MH.',
        ],
        descripcionMsg: isAbort ? 'Timeout de conexión' : err?.message || 'Error de red',
      },
      { status: 200 }
    );
  }
}
