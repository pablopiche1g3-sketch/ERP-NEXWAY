import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_HACIENDA_SANDBOX_URL,
  buildNumeroControl,
  generateUuidV4Upper,
} from '@/lib/hacienda-sandbox';

export const runtime = 'nodejs';

function r2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function cleanDigits(val?: string | null): string {
  return (val || '').replace(/[^0-9]/g, '');
}

function getSvDateTime() {
  const now = new Date();
  const fecEmi = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const horEmi = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/El_Salvador',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);
  return { fecEmi, horEmi };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const baseUrl = (url.searchParams.get('baseUrl') || DEFAULT_HACIENDA_SANDBOX_URL)
      .trim()
      .replace(/\/+$/, '');

    const res = await fetch(`${baseUrl}/api/companies`, { cache: 'no-store' });
    const companies = await res.json().catch(() => []);
    return NextResponse.json({
      ok: Array.isArray(companies),
      companies: Array.isArray(companies) ? companies : [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, companies: [], error: err?.message || 'Error consultando proveedores' },
      { status: 200 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const baseUrl = (body?.baseUrl || DEFAULT_HACIENDA_SANDBOX_URL)
      .toString()
      .trim()
      .replace(/\/+$/, '');
    const ambiente: '00' | '01' = body?.ambiente === '01' ? '01' : '00';
    const orderCode = (body?.orderCode || `OC-${Date.now().toString().slice(-6)}`).toString();
    const rawItems: Array<{ sku: string; name: string; quantity: number; cost: number }> =
      Array.isArray(body?.items) ? body.items : [];

    if (rawItems.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Se requiere al menos 1 producto para reabastecer.' },
        { status: 400 }
      );
    }

    // 1. Obtener empresas proveedoras disponibles
    let remoteCompanies: any[] = [];
    try {
      const compRes = await fetch(`${baseUrl}/api/companies`, { cache: 'no-store' });
      const parsed = await compRes.json().catch(() => []);
      if (Array.isArray(parsed)) remoteCompanies = parsed;
    } catch {}

    const reqSupName = (body?.supplierName || '').toString().trim().toLowerCase();
    const reqSupNit = cleanDigits(body?.supplierNit);

    let chosenSupplier =
      remoteCompanies.find(
        (c) =>
          (reqSupNit && cleanDigits(c.nit) === reqSupNit) ||
          (reqSupName &&
            (c.nombre?.toLowerCase().includes(reqSupName) ||
              c.nombreComercial?.toLowerCase().includes(reqSupName) ||
              reqSupName.includes((c.nombreComercial || '').toLowerCase())))
      ) || remoteCompanies[0];

    if (!chosenSupplier) {
      chosenSupplier = {
        id: 'emp-01',
        nombre: body?.supplierName || 'DISTRIBUIDORA SALVADOREÑA COMERCIAL S.A. DE C.V.',
        nombreComercial: body?.supplierName || 'DISALCOM',
        nit: reqSupNit || '06141508981024',
        nrc: '1245893',
        codActividad: '46900',
        descActividad: 'Venta al por mayor no especializada',
        tipoEstablecimiento: '01',
        direccion: {
          departamento: '06',
          municipio: '14',
          complemento: 'Alameda Roosevelt #2411, San Salvador',
        },
        telefono: '22509000',
        correo: 'facturacion@disalcom.com.sv',
        codEstableMH: 'M001',
        codPuntoVentaMH: 'P001',
        granContribuyente: true,
      };
    }

    const buyer = body?.buyerCompany || {};
    const buyerEmail = (buyer.email || 'compras@nexway.sv').toString().trim();

    // 2. Enviar correo formal de pedido al buzón del proveedor (/api/email/inbound)
    const linesText = rawItems
      .map(
        (it, i) =>
          `${i + 1}. [${it.sku}] ${it.name} — Cant: ${it.quantity} — Costo Unit: $${Number(it.cost || 0).toFixed(2)}`
      )
      .join('\n');

    try {
      await fetch(`${baseUrl}/api/email/inbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: buyerEmail,
          to: chosenSupplier.correo || 'ventas@proveedor.sv',
          subject: `Solicitud de Reabastecimiento ${orderCode} - ${buyer.company_name || 'NEXWAY ERP'}`,
          text: `Estimados ${chosenSupplier.nombre}:\nSolicitamos facturación CCF (DTE-03) para la orden ${orderCode}:\n\n${linesText}`,
          cuerpo: `Orden ${orderCode}:\n${linesText}`,
        }),
      });
    } catch (mailErr) {
      console.warn('Advertencia al notificar /api/email/inbound:', mailErr);
    }

    // 3. Construir CCF oficial (DTE-03) emitido por el proveedor hacia nuestra empresa
    const { fecEmi, horEmi } = getSvDateTime();
    const codigoGeneracion = generateUuidV4Upper();
    const numeroControl = buildNumeroControl(
      '03',
      `${Date.now().toString().slice(-8)}`,
      chosenSupplier.codEstableMH || 'M001',
      chosenSupplier.codPuntoVentaMH || 'P001'
    );

    let totalGravada = 0;
    const cuerpoDocumento = rawItems.map((it, idx) => {
      const cantidad = Math.max(1, Number(it.quantity) || 1);
      const precioUni = r2(Math.max(0.01, Number(it.cost) || 1));
      const ventaGravada = r2(cantidad * precioUni);
      totalGravada = r2(totalGravada + ventaGravada);
      return {
        numItem: idx + 1,
        tipoItem: 1,
        numeroDocumento: null,
        cantidad,
        codigo: (it.sku || `ITEM-${idx + 1}`).toString().trim().toUpperCase(),
        codTributo: null,
        uniMedida: 59,
        descripcion: (it.name || 'Producto').toString().trim().slice(0, 1000),
        precioUni,
        montoDescu: 0,
        ventaNoSuj: 0,
        ventaExenta: 0,
        ventaGravada,
        tributos: ['20'],
        psv: 0,
        noGravado: 0,
      };
    });

    const iva13 = r2(totalGravada * 0.13);
    const montoTotalOperacion = r2(totalGravada + iva13);
    const entero = Math.floor(montoTotalOperacion);
    const centavos = String(Math.round((montoTotalOperacion - entero) * 100)).padStart(2, '0');

    const dte03 = {
      identificacion: {
        version: 3,
        ambiente,
        tipoDte: '03',
        numeroControl,
        codigoGeneracion,
        tipoModelo: 1,
        tipoOperacion: 1,
        tipoContingencia: null,
        motivoContin: null,
        fecEmi,
        horEmi,
        tipoMoneda: 'USD',
      },
      emisor: {
        nit: cleanDigits(chosenSupplier.nit) || '06141508981024',
        nrc: cleanDigits(chosenSupplier.nrc) || '1245893',
        nombre: chosenSupplier.nombre,
        codActividad: cleanDigits(chosenSupplier.codActividad) || '46900',
        descActividad: chosenSupplier.descActividad || 'Venta al por mayor',
        nombreComercial: chosenSupplier.nombreComercial || chosenSupplier.nombre,
        tipoEstablecimiento: chosenSupplier.tipoEstablecimiento || '01',
        direccion: chosenSupplier.direccion || {
          departamento: '06',
          municipio: '14',
          complemento: 'San Salvador',
        },
        telefono: cleanDigits(chosenSupplier.telefono) || '22509000',
        correo: chosenSupplier.correo || 'facturacion@proveedor.sv',
        codEstableMH: chosenSupplier.codEstableMH || 'M001',
        codEstable: chosenSupplier.codEstableMH || 'M001',
        codPuntoVentaMH: chosenSupplier.codPuntoVentaMH || 'P001',
        codPuntoVenta: chosenSupplier.codPuntoVentaMH || 'P001',
      },
      receptor: {
        nit: cleanDigits(buyer.nit) || '06141234560010',
        nrc: cleanDigits(buyer.nrc) || '1234567',
        nombre: (buyer.company_name || 'NEXWAY ERP S.A. DE C.V.').trim(),
        codActividad: cleanDigits(buyer.cod_actividad) || '46630',
        descActividad: (
          buyer.desc_actividad ||
          buyer.giro ||
          'Venta al por mayor de articulos de ferreteria y pinturerias'
        ).trim(),
        nombreComercial: (buyer.commercial_name || buyer.company_name || 'NEXWAY').trim(),
        direccion: {
          departamento: (buyer.departamento || '06').toString().padStart(2, '0').slice(0, 2),
          municipio: (buyer.municipio || '14').toString().padStart(2, '0').slice(0, 2),
          complemento: (buyer.address || 'San Salvador, El Salvador').trim(),
        },
        telefono: cleanDigits(buyer.phone) || '22000000',
        correo: buyerEmail,
      },
      cuerpoDocumento,
      resumen: {
        totalNoSuj: 0,
        totalExenta: 0,
        totalGravada,
        subTotalVentas: totalGravada,
        descuNoSuj: 0,
        descuExenta: 0,
        descuGravada: 0,
        porcentajeDescuento: 0,
        totalDescu: 0,
        tributos: [
          {
            codigo: '20',
            descripcion: 'Impuesto al Valor Agregado 13%',
            valor: iva13,
          },
        ],
        subTotal: totalGravada,
        ivaPerci1: 0,
        ivaRete1: 0,
        reteRenta: 0,
        montoTotalOperacion,
        totalNoGravado: 0,
        totalPagar: montoTotalOperacion,
        totalLetras: `${entero} ${centavos}/100 DOLARES`,
        saldoFavor: 0,
        condicionOperacion: 2,
        pagos: [
          {
            codigo: '99',
            montoPago: montoTotalOperacion,
            referencia: orderCode,
            plazo: '01',
            periodo: 30,
          },
        ],
        numPagoElectronico: null,
      },
    };

    // 4. Firmar y sellar el CCF del proveedor en el motor MH
    let signedJws: string | null = null;
    try {
      const sRes = await fetch(`${baseUrl}/api/dte/firmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dte: dte03 }),
      });
      const sJson = await sRes.json().catch(() => null);
      if (sJson?.body) signedJws = sJson.body;
    } catch {}

    let selloRecibido: string | null = null;
    let estadoMh = 'PROCESADO';
    try {
      const rRes = await fetch(`${baseUrl}/api/dte/recepcion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ambiente,
          idEnvio: 1,
          version: 3,
          tipoDte: '03',
          documento: dte03,
        }),
      });
      const rJson = await rRes.json().catch(() => null);
      if (rJson?.selloRecibido) selloRecibido = rJson.selloRecibido;
      if (rJson?.estado) estadoMh = rJson.estado;
    } catch {}

    const dteEntry = {
      id: `dte-reab-${Date.now()}`,
      documento_numero: numeroControl,
      codigo_generacion: codigoGeneracion,
      proveedor_nombre: chosenSupplier.nombre,
      proveedor_nit: chosenSupplier.nit,
      sello_recibido: selloRecibido,
      firma_jws: signedJws,
      orden_origen: orderCode,
      warehouse_destino: body?.destinationWarehouse || null,
      total: montoTotalOperacion,
      estado: 'PENDIENTE',
      mh_estado: estadoMh,
      created_at: new Date().toISOString(),
      payload_json: dte03,
    };

    return NextResponse.json({
      ok: true,
      supplier: {
        name: chosenSupplier.nombre,
        commercialName: chosenSupplier.nombreComercial,
        nit: chosenSupplier.nit,
        nrc: chosenSupplier.nrc,
        giro: chosenSupplier.descActividad,
        email: chosenSupplier.correo,
        phone: chosenSupplier.telefono,
        address: chosenSupplier.direccion?.complemento || 'San Salvador',
        applyRetention: Boolean(chosenSupplier.granContribuyente),
      },
      selloRecibido,
      numeroControl,
      codigoGeneracion,
      dteEntry,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'No se pudo procesar la solicitud de reabastecimiento.' },
      { status: 500 }
    );
  }
}
