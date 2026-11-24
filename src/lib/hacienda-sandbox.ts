import { supabase } from '@/supabase/client';

export const DEFAULT_HACIENDA_SANDBOX_URL =
  'https://dte-hacienda-sv-generador-y-sandbox-de-facturaci.ai.studio';

export const HACIENDA_SANDBOX_CONFIG_KEY = 'hacienda_sandbox_config';
export const HACIENDA_TRANSMISSIONS_KEY = 'hacienda_dte_transmissions';

export interface HaciendaSandboxConfig {
  enabled: boolean;
  autoTransmit: boolean;
  ambiente: '00' | '01';
  baseUrl: string;
  codEstableMH: string;
  codPuntoVentaMH: string;
}

export const DEFAULT_HACIENDA_SANDBOX_CONFIG: HaciendaSandboxConfig = {
  enabled: true,
  autoTransmit: true,
  ambiente: '00',
  baseUrl: DEFAULT_HACIENDA_SANDBOX_URL,
  codEstableMH: 'M001',
  codPuntoVentaMH: 'P001',
};

export interface DteTransmissionRecord {
  id: string;
  saleId?: string | null;
  correlative: string;
  tipoDte: '01' | '03';
  docTypeLabel: string;
  numeroControl: string;
  codigoGeneracion: string;
  estado: 'PROCESADO' | 'RECHAZADO' | 'ERROR';
  selloRecibido: string | null;
  fhaRecibido: string | null;
  codigoMsg: string | null;
  descripcionMsg: string | null;
  observaciones: string[];
  customerName: string;
  total: number;
  ambiente: '00' | '01';
  signedJws?: string | null;
  dteJson: any;
  createdAt: string;
}

export interface BuildDteSaleInput {
  saleId?: string | null;
  correlative: string;
  docType: 'FACTURA' | 'CCF' | string;
  total: number;
  ivaRete1?: number;
  paymentMethod?: string;
  items: Array<{
    sku?: string;
    name: string;
    quantity: number;
    unitPrice: number; // PVP con IVA incluido (como en Caja)
  }>;
  customer?: {
    name?: string;
    nit?: string | null;
    nrc?: string | null;
    dui?: string | null;
    giro?: string | null;
    codActividad?: string | null;
    descActividad?: string | null;
    departamento?: string | null;
    municipio?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  company?: {
    company_name?: string;
    commercial_name?: string;
    nit?: string;
    nrc?: string;
    giro?: string;
    cod_actividad?: string;
    desc_actividad?: string;
    departamento?: string;
    municipio?: string;
    address?: string;
    phone?: string;
    email?: string;
  } | null;
  ambiente?: '00' | '01';
  codEstableMH?: string;
  codPuntoVentaMH?: string;
}

function r2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function cleanDigits(val?: string | null): string {
  return (val || '').replace(/[^0-9]/g, '');
}

export function generateUuidV4Upper(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().toUpperCase();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    .replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    })
    .toUpperCase();
}

export function buildNumeroControl(
  tipoDte: '01' | '03',
  correlative: string,
  codEstable = 'M001',
  codPuntoVenta = 'P001'
): string {
  const digits = cleanDigits(correlative);
  const seqNum = digits ? digits.slice(-15) : String(Date.now()).slice(-15);
  const padded = seqNum.padStart(15, '0');
  const estab = (codEstable || 'M001').toUpperCase().slice(0, 4).padEnd(4, '0');
  const pto = (codPuntoVenta || 'P001').toUpperCase().slice(0, 4).padEnd(4, '0');
  return `DTE-${tipoDte}-${estab}${pto}-${padded}`;
}

function getElSalvadorDateTime(): { fecEmi: string; horEmi: string } {
  const now = new Date();
  const svDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const svTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/El_Salvador',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);
  return { fecEmi: svDate, horEmi: svTime };
}

function mapPaymentMethodToMhCode(method?: string): string {
  const m = (method || '').toLowerCase();
  if (m.includes('tarjeta')) return '02';
  if (m.includes('transfer') || m.includes('deposito') || m.includes('banco')) return '05';
  if (m.includes('cheque')) return '04';
  if (m.includes('credito') || m.includes('crédito')) return '99';
  return '01'; // Billetes y monedas
}

function amountToSpanishWords(amount: number): string {
  const fixed = r2(amount);
  const entero = Math.floor(fixed);
  const centavos = Math.round((fixed - entero) * 100);
  const centStr = String(centavos).padStart(2, '0');
  return `${entero} ${centStr}/100 DOLARES`;
}

export function buildOfficialDteJson(input: BuildDteSaleInput) {
  const isCcf = (input.docType || '').toUpperCase().includes('CCF') || input.docType === '03';
  const tipoDte: '01' | '03' = isCcf ? '03' : '01';
  const version = isCcf ? 3 : 1;
  const ambiente: '00' | '01' = input.ambiente || '00';
  const { fecEmi, horEmi } = getElSalvadorDateTime();
  const codigoGeneracion = generateUuidV4Upper();
  const numeroControl = buildNumeroControl(
    tipoDte,
    input.correlative,
    input.codEstableMH || 'M001',
    input.codPuntoVentaMH || 'P001'
  );

  const comp = input.company || {};
  const emisorNit = cleanDigits(comp.nit) || '06141234560010';
  const emisorNrc = cleanDigits(comp.nrc) || '1234567';
  const emisorCodAct = cleanDigits(comp.cod_actividad) || '46630';
  const emisorDescAct =
    comp.desc_actividad || comp.giro || 'Venta al por mayor de articulos de ferreteria y pinturerias';
  const emisorDept = (comp.departamento || '06').toString().padStart(2, '0').slice(0, 2);
  const emisorMuni = (comp.municipio || '14').toString().padStart(2, '0').slice(0, 2);

  const emisor = {
    nit: emisorNit,
    nrc: emisorNrc,
    nombre: (comp.company_name || 'ERP NEXWAY S.A. DE C.V.').trim(),
    codActividad: emisorCodAct,
    descActividad: emisorDescAct.trim(),
    nombreComercial: (comp.commercial_name || comp.company_name || 'NEXWAY').trim(),
    tipoEstablecimiento: '01',
    direccion: {
      departamento: emisorDept,
      municipio: emisorMuni,
      complemento: (comp.address || 'San Salvador, El Salvador').trim(),
    },
    telefono: cleanDigits(comp.phone) || '22000000',
    correo: (comp.email || 'facturacion@nexway.sv').trim(),
    codEstableMH: input.codEstableMH || 'M001',
    codEstable: input.codEstableMH || 'M001',
    codPuntoVentaMH: input.codPuntoVentaMH || 'P001',
    codPuntoVenta: input.codPuntoVentaMH || 'P001',
  };

  const cust = input.customer || {};
  const custDept = (cust.departamento || '06').toString().padStart(2, '0').slice(0, 2);
  const custMuni = (cust.municipio || '14').toString().padStart(2, '0').slice(0, 2);

  const receptor = isCcf
    ? {
        nit: cleanDigits(cust.nit) || '',
        nrc: cleanDigits(cust.nrc) || '',
        nombre: (cust.name || 'Cliente Contribuyente').trim(),
        codActividad: cleanDigits(cust.codActividad) || '46900',
        descActividad: (cust.descActividad || cust.giro || 'Actividades comerciales').trim(),
        nombreComercial: (cust.name || 'Cliente Contribuyente').trim(),
        direccion: {
          departamento: custDept,
          municipio: custMuni,
          complemento: (cust.address || 'San Salvador').trim(),
        },
        telefono: cleanDigits(cust.phone) || '22000000',
        correo: (cust.email || 'cliente@correo.sv').trim(),
      }
    : {
        tipoDocumento: cleanDigits(cust.dui) ? '13' : cleanDigits(cust.nit) ? '36' : '13',
        numDocumento: cleanDigits(cust.dui) || cleanDigits(cust.nit) || '000000000',
        nrc: null,
        nombre: (cust.name || 'Consumidor Final').trim(),
        codActividad: null,
        descActividad: null,
        direccion: {
          departamento: custDept,
          municipio: custMuni,
          complemento: (cust.address || 'San Salvador').trim(),
        },
        telefono: cleanDigits(cust.phone) || null,
        correo: (cust.email || 'cliente@correo.sv').trim(),
      };

  const safeItems =
    input.items && input.items.length > 0
      ? input.items
      : [{ sku: 'ITEM-01', name: 'Venta General', quantity: 1, unitPrice: input.total || 1 }];

  let totalGravada = 0;
  let totalIva = 0;

  const cuerpoDocumento = safeItems.map((it, idx) => {
    const qty = Number(it.quantity) || 1;
    const pvpConIva = r2(Number(it.unitPrice) || 0);

    if (isCcf) {
      // En CCF (03) los precios unitarios y ventaGravada son SIN IVA, el IVA va en resumen.tributos
      const precioSinIva = r2(pvpConIva / 1.13);
      const ventaGravada = r2(precioSinIva * qty);
      totalGravada = r2(totalGravada + ventaGravada);
      return {
        numItem: idx + 1,
        tipoItem: 1,
        numeroDocumento: null,
        cantidad: qty,
        codigo: (it.sku || `SKU-${idx + 1}`).trim(),
        codTributo: null,
        uniMedida: 59,
        descripcion: (it.name || 'Producto').trim().slice(0, 1000),
        precioUni: precioSinIva,
        montoDescu: 0,
        ventaNoSuj: 0,
        ventaExenta: 0,
        ventaGravada,
        tributos: ['20'],
        psv: 0,
        noGravado: 0,
      };
    } else {
      // En Factura (01) los precios unitarios y ventaGravada INCLUYEN IVA, y cada ítem reporta ivaItem
      const ventaGravada = r2(pvpConIva * qty);
      const ivaItem = r2(ventaGravada - ventaGravada / 1.13);
      totalGravada = r2(totalGravada + ventaGravada);
      totalIva = r2(totalIva + ivaItem);
      return {
        numItem: idx + 1,
        tipoItem: 1,
        numeroDocumento: null,
        cantidad: qty,
        codigo: (it.sku || `SKU-${idx + 1}`).trim(),
        codTributo: null,
        uniMedida: 59,
        descripcion: (it.name || 'Producto').trim().slice(0, 1000),
        precioUni: pvpConIva,
        montoDescu: 0,
        ventaNoSuj: 0,
        ventaExenta: 0,
        ventaGravada,
        tributos: null,
        psv: 0,
        noGravado: 0,
        ivaItem,
      };
    }
  });

  const ivaRete1 = r2(input.ivaRete1 || 0);
  const isCredit = (input.paymentMethod || '').toLowerCase().includes('credito') ||
    (input.paymentMethod || '').toLowerCase().includes('crédito');
  const condicionOperacion = isCredit ? 2 : 1;
  const paymentCode = mapPaymentMethodToMhCode(input.paymentMethod);

  const resumen = isCcf
    ? (() => {
        const iva13 = r2(totalGravada * 0.13);
        const montoTotalOperacion = r2(totalGravada + iva13);
        const totalPagar = r2(montoTotalOperacion - ivaRete1);
        return {
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
          ivaRete1,
          reteRenta: 0,
          montoTotalOperacion,
          totalNoGravado: 0,
          totalPagar,
          totalLetras: amountToSpanishWords(totalPagar),
          saldoFavor: 0,
          condicionOperacion,
          pagos: [{ codigo: paymentCode, montoPago: totalPagar, referencia: null, plazo: null, periodo: null }],
          numPagoElectronico: null,
        };
      })()
    : (() => {
        const montoTotalOperacion = totalGravada;
        const totalPagar = r2(montoTotalOperacion - ivaRete1);
        return {
          totalNoSuj: 0,
          totalExenta: 0,
          totalGravada,
          subTotalVentas: totalGravada,
          descuNoSuj: 0,
          descuExenta: 0,
          descuGravada: 0,
          porcentajeDescuento: 0,
          totalDescu: 0,
          tributos: null,
          subTotal: totalGravada,
          ivaRete1,
          reteRenta: 0,
          montoTotalOperacion,
          totalNoGravado: 0,
          totalPagar,
          totalLetras: amountToSpanishWords(totalPagar),
          totalIva,
          saldoFavor: 0,
          condicionOperacion,
          pagos: [{ codigo: paymentCode, montoPago: totalPagar, referencia: null, plazo: null, periodo: null }],
          numPagoElectronico: null,
        };
      })();

  return {
    identificacion: {
      version,
      ambiente,
      tipoDte,
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
    emisor,
    receptor,
    cuerpoDocumento,
    resumen,
  };
}

export async function loadHaciendaSandboxConfig(): Promise<HaciendaSandboxConfig> {
  try {
    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', HACIENDA_SANDBOX_CONFIG_KEY)
      .maybeSingle();

    if (data?.value && typeof data.value === 'object') {
      return {
        ...DEFAULT_HACIENDA_SANDBOX_CONFIG,
        ...data.value,
        baseUrl: (data.value.baseUrl || DEFAULT_HACIENDA_SANDBOX_URL).replace(/\/+$/, ''),
      };
    }
  } catch (e) {
    console.warn('No se pudo cargar hacienda_sandbox_config:', e);
  }
  return { ...DEFAULT_HACIENDA_SANDBOX_CONFIG };
}

export async function saveHaciendaSandboxConfig(cfg: HaciendaSandboxConfig): Promise<void> {
  const normalized: HaciendaSandboxConfig = {
    ...DEFAULT_HACIENDA_SANDBOX_CONFIG,
    ...cfg,
    baseUrl: (cfg.baseUrl || DEFAULT_HACIENDA_SANDBOX_URL).trim().replace(/\/+$/, ''),
  };
  const { error } = await supabase.from('system_config').upsert(
    {
      key: HACIENDA_SANDBOX_CONFIG_KEY,
      value: normalized
    },
    { onConflict: 'key' }
  );
  if (error) throw error;
}

export async function loadDteTransmissions(): Promise<DteTransmissionRecord[]> {
  try {
    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', HACIENDA_TRANSMISSIONS_KEY)
      .maybeSingle();
    if (Array.isArray(data?.value)) {
      return data.value as DteTransmissionRecord[];
    }
  } catch (e) {
    console.warn('No se pudo cargar hacienda_dte_transmissions:', e);
  }
  return [];
}

export async function appendDteTransmission(record: DteTransmissionRecord): Promise<DteTransmissionRecord[]> {
  const existing = await loadDteTransmissions();
  const filtered = existing.filter((r) => r.id !== record.id);
  const updated = [record, ...filtered].slice(0, 100);
  await supabase.from('system_config').upsert(
    {
      key: HACIENDA_TRANSMISSIONS_KEY,
      value: updated
    },
    { onConflict: 'key' }
  );
  return updated;
}

export async function transmitDteViaSandbox(params: {
  dteJson: any;
  baseUrl?: string;
  ambiente?: '00' | '01';
}) {
  const res = await fetch('/api/hacienda/transmit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return res.json();
}
