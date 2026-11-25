import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AccountingProposalLine {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
}

export interface AccountingJournalProposal {
  type: 'JOURNAL_ENTRY';
  description: string;
  amount: number;
  lines: AccountingProposalLine[];
  notes?: string;
}

interface AccountingContextPayload {
  activeTab?: string;
  filterMonth?: string;
  filterYear?: string;
  activeIncome?: number;
  activeExpenses?: number;
  grossProfit?: number;
  totalDebitFiscal?: number;
  totalCreditFiscal?: number;
  f07TaxBalance?: number;
  f14PagoCuenta?: number;
  f14Total?: number;
  trialTotalDebit?: number;
  trialTotalCredit?: number;
  trialBalanced?: boolean;
  journalCount?: number;
  pettyCashCount?: number;
  ivaRate?: number;
  pagoCuentaRate?: number;
  recentEntries?: Array<{ description: string; amount: number; type?: string; date?: string }>;
}

const CATALOG_REFERENCE = [
  { code: '1101', name: 'Efectivo y Equivalentes de Efectivo' },
  { code: '1102', name: 'Bancos e Instituciones Financieras' },
  { code: '1103', name: 'Cuentas por Cobrar Clientes' },
  { code: '1104', name: 'IVA Crédito Fiscal (13%)' },
  { code: '1105', name: 'Inventarios de Mercadería' },
  { code: '1201', name: 'Propiedad, Planta y Equipo' },
  { code: '2101', name: 'Proveedores Locales C/P' },
  { code: '2102', name: 'IVA Débito Fiscal (13%)' },
  { code: '2103', name: 'Retenciones de IVA por Pagar (1%)' },
  { code: '2104', name: 'Pago a Cuenta por Pagar' },
  { code: '2105', name: 'Retención Renta por Pagar' },
  { code: '3101', name: 'Capital Social Capitalizado' },
  { code: '4101', name: 'Ventas de Mercadería Gravadas' },
  { code: '4103', name: 'Otros Ingresos Operacionales' },
  { code: '5101', name: 'Costo de Ventas' },
  { code: '6101', name: 'Gastos de Administración' },
  { code: '6102', name: 'Gastos de Venta y Distribución' },
  { code: '6103', name: 'Sueldos y Prestaciones (Planilla)' },
  { code: '6104', name: 'Servicios Básicos' },
  { code: '6105', name: 'Arrendamientos y Alquileres' },
];

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function validateProposal(raw: any): AccountingJournalProposal | null {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.lines) || raw.lines.length < 2) {
    return null;
  }

  const lines: AccountingProposalLine[] = raw.lines
    .map((l: any) => ({
      account_code: String(l.account_code || '').trim(),
      account_name: String(l.account_name || '').trim() ||
        CATALOG_REFERENCE.find(c => c.code === String(l.account_code || '').trim())?.name ||
        'Cuenta Contable',
      debit: round2(Number(l.debit || 0)),
      credit: round2(Number(l.credit || 0)),
    }))
    .filter((l: AccountingProposalLine) => l.account_code && (l.debit > 0 || l.credit > 0));

  if (lines.length < 2) return null;

  const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));

  if (totalDebit <= 0 || Math.abs(totalDebit - totalCredit) > 0.02) {
    return null;
  }

  return {
    type: 'JOURNAL_ENTRY',
    description: String(raw.description || 'Partida contable sugerida por IA').trim(),
    amount: totalDebit,
    lines,
    notes: raw.notes ? String(raw.notes).trim() : undefined,
  };
}

function buildDeterministicFallback(
  message: string,
  ctx: AccountingContextPayload
): { reply: string; proposal: AccountingJournalProposal | null } {
  const lower = message.toLowerCase();
  const fmt = (n: number | undefined) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Detectar intención de Nivel 2: preparar / registrar partida o gasto con monto
  const amountMatch = message.match(/\$?\s*(\d+(?:[.,]\d{1,2})?)/);
  const wantsEntry = /(registra|prepara|crea|haz|genera|contabiliza|asiento|partida|recibo|gasto|pago|alquiler|planilla|combustible|gasolina|luz|agua|internet|tel[eé]fono|papeler[ií]a|iva)/i.test(lower);

  if (wantsEntry && amountMatch) {
    const rawAmount = parseFloat(amountMatch[1].replace(',', '.'));
    if (Number.isFinite(rawAmount) && rawAmount > 0) {
      const amount = round2(rawAmount);

      // Determinar cuenta de salida (Haber)
      let creditCode = '1101';
      let creditName = 'Efectivo y Equivalentes de Efectivo';
      if (/(transferencia|banco|cheque|cuenta bancaria|dep[oó]sito)/i.test(lower)) {
        creditCode = '1102';
        creditName = 'Bancos e Instituciones Financieras';
      } else if (/(cr[eé]dito|proveedor|por pagar|fiado)/i.test(lower)) {
        creditCode = '2101';
        creditName = 'Proveedores Locales C/P';
      }

      // Determinar cuenta de cargo (Debe)
      let debitCode = '6101';
      let debitName = 'Gastos de Administración';
      let label = 'Gasto operativo';
      let includeIva = /(ccf|cr[eé]dito fiscal|con iva|m[aá]s iva)/i.test(lower);

      if (/(luz|energ[ií]a|agua|internet|tel[eé]fono|anda|caess|delsur|claro|tigo)/i.test(lower)) {
        debitCode = '6104';
        debitName = 'Servicios Básicos';
        label = 'Pago de servicios básicos';
      } else if (/(alquiler|arrendamiento|renta de local|local)/i.test(lower)) {
        debitCode = '6105';
        debitName = 'Arrendamientos y Alquileres';
        label = 'Pago de alquiler de local';
      } else if (/(planilla|sueldo|salario|n[oó]mina|aguinaldo|isss|afp)/i.test(lower)) {
        debitCode = '6103';
        debitName = 'Sueldos y Prestaciones (Planilla)';
        label = 'Registro de planilla / sueldos';
        includeIva = false;
      } else if (/(gasolina|combustible|transporte|flete|env[ií]o|publicidad|comisi[oó]n)/i.test(lower)) {
        debitCode = '6102';
        debitName = 'Gastos de Venta y Distribución';
        label = 'Gasto de distribución / combustible';
      } else if (/(pago de iva|f-07|f07|hacienda iva)/i.test(lower)) {
        debitCode = '2102';
        debitName = 'IVA Débito Fiscal (13%)';
        label = 'Liquidación y pago de IVA (F-07)';
        includeIva = false;
      } else if (/(pago a cuenta|f-14|f14)/i.test(lower)) {
        debitCode = '2104';
        debitName = 'Pago a Cuenta por Pagar';
        label = 'Pago a Cuenta mensual (F-14)';
        includeIva = false;
      }

      const lines: AccountingProposalLine[] = includeIva
        ? (() => {
            const net = round2(amount / 1.13);
            const iva = round2(amount - net);
            return [
              { account_code: debitCode, account_name: debitName, debit: net, credit: 0 },
              { account_code: '1104', account_name: 'IVA Crédito Fiscal (13%)', debit: iva, credit: 0 },
              { account_code: creditCode, account_name: creditName, debit: 0, credit: amount },
            ];
          })()
        : [
            { account_code: debitCode, account_name: debitName, debit: amount, credit: 0 },
            { account_code: creditCode, account_name: creditName, debit: 0, credit: amount },
          ];

      const proposal: AccountingJournalProposal = {
        type: 'JOURNAL_ENTRY',
        description: `${label} (${message.trim().slice(0, 75)})`,
        amount,
        lines,
        notes: includeIva
          ? 'Incluye desglose de IVA Crédito Fiscal 13% (CCF). Verifica el documento físico antes de confirmar.'
          : 'Partida cuadrada lista para confirmar. Si cuentas con CCF y deseas separar el 13% de IVA, indícame "con CCF".',
      };

      return {
        reply: `Preparé el borrador de partida doble por **${fmt(amount)}** (${debitCode} vs ${creditCode}). Revísala abajo y haz clic en **Confirmar y Contabilizar** si está correcta.`,
        proposal,
      };
    }
  }

  // Nivel 1: Diagnóstico F-07 / F-14 / Hacienda
  if (/(f-07|f07|f-14|f14|iva|hacienda|impuesto|declaraci[oó]n|tributario)/i.test(lower)) {
    const ivaStatus = (ctx.f07TaxBalance || 0) >= 0
      ? `IVA a pagar estimado: **${fmt(ctx.f07TaxBalance)}**`
      : `Remanente de IVA a favor: **${fmt(Math.abs(ctx.f07TaxBalance || 0))}**`;
    return {
      reply: [
        `📊 **Resumen Fiscal del período ${ctx.filterMonth || ''}/${ctx.filterYear || ''}:**`,
        `- **IVA Débito Fiscal (Ventas):** ${fmt(ctx.totalDebitFiscal)}`,
        `- **IVA Crédito Fiscal (Compras):** ${fmt(ctx.totalCreditFiscal)}`,
        `- **Resultado F-07:** ${ivaStatus}`,
        `- **Pago a Cuenta F-14 (${ctx.pagoCuentaRate ?? 1.75}%):** ${fmt(ctx.f14PagoCuenta)} (Total F-14 con retenciones: **${fmt(ctx.f14Total)}**)`,
        ``,
        `👉 **Paso sugerido:** Ve a la pestaña **4. Hacienda e IVA (MH)**, exporta los 3 CSV en *Libros de IVA* y verifica *Declaración MH (F-07 / F-14)* antes de los primeros 10 días hábiles del siguiente mes.`,
      ].join('\n'),
      proposal: null,
    };
  }

  // Nivel 1: Balance de Comprobación
  if (/(balance|cuadr|debe|haber|cierre)/i.test(lower)) {
    const balancedText = ctx.trialBalanced
      ? '✅ **Tu Balance de Comprobación está cuadrado** (Debe = Haber).'
      : `⚠️ **Hay una diferencia** entre Debe (${fmt(ctx.trialTotalDebit)}) y Haber (${fmt(ctx.trialTotalCredit)}). Revisa las partidas recientes en **1. Libro Diario** o **3. Auditoría**.`;
    return {
      reply: [
        `⚖️ **Estado del Balance de Comprobación:**`,
        `- Total Debe: **${fmt(ctx.trialTotalDebit)}**`,
        `- Total Haber: **${fmt(ctx.trialTotalCredit)}**`,
        `- Partidas registradas: **${ctx.journalCount ?? 0}**`,
        balancedText,
      ].join('\n'),
      proposal: null,
    };
  }

  // Nivel 1: Rutina del auxiliar contable / qué hacer hoy
  return {
    reply: [
      `👋 **Guía rápida del Auxiliar Contable (período ${ctx.filterMonth || ''}/${ctx.filterYear || ''}):**`,
      `1. **Diario (1. Libro Diario y 2. Caja Chica)**: Verifica que las ventas y compras del día generaron partida (${ctx.journalCount ?? 0} partidas activas) y registra gastos menores.`,
      `2. **Semanal (3. Auditoría)**: Revisa movimientos manuales y respaldo documental.`,
      `3. **Mensual (4. Hacienda e IVA)**: Revisa IVA Débito (${fmt(ctx.totalDebitFiscal)}) vs Crédito (${fmt(ctx.totalCreditFiscal)}) y F-14 (${fmt(ctx.f14PagoCuenta)}).`,
      `4. **Cierre (5. Balance y 6. Resultados)**: Confirma que Debe = Haber y entrega el resumen a Gerencia (Margen actual: ${fmt(ctx.grossProfit)}).`,
      ``,
      `💡 *Nivel 2 disponible:* También puedes pedirme cosas como **"Prepara partida de recibo de luz $120 por transferencia"** y te mostraré el borrador cuadrado para que tú lo confirmes.`,
    ].join('\n'),
    proposal: null,
  };
}

export async function POST(req: NextRequest) {
  let message = '';
  let context: AccountingContextPayload = {};
  try {
    const body = await req.json();
    message = String(body?.message || '').trim();
    const history = Array.isArray(body?.history) ? body.history.slice(-6) : [];
    context = body?.context || {};

    if (!message) {
      return NextResponse.json({ error: 'Mensaje vacío.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

    if (!apiKey) {
      const fallback = buildDeterministicFallback(message, context);
      return NextResponse.json({ ...fallback, source: 'fallback' });
    }

    const systemPrompt = `Eres el Asistente Contable IA (Nivel 1 + Nivel 2) de ERP NEXWAY en El Salvador.
Trabajas EXCLUSIVAMENTE en el módulo de Contabilidad ayudando al Auxiliar Contable y al Contador.

REGLAS ESTRICTAS:
1. Nivel 1 (Consulta y Guía): Responde con claridad y brevedad usando los datos reales del período proporcionados en el contexto (IVA 13%, F-07, F-14 Pago a Cuenta 1.75%, Balance de Comprobación, Caja Chica, Libro Diario).
2. Nivel 2 (Propuesta de Partida Doble): Si el usuario te pide registrar, preparar, contabilizar o crear un gasto, recibo, pago o asiento contable con un monto, genera un objeto "proposal" con partida doble CUADRADA (suma de debit === suma de credit) usando EXCLUSIVAMENTE códigos del catálogo salvadoreño proporcionado.
3. NUNCA asumas que ya se guardó: dile siempre al usuario que revise el borrador y presione "Confirmar y Contabilizar".
4. Responde SIEMPRE en JSON válido con esta estructura exacta (sin markdown alrededor):
{
  "reply": "Texto breve en español (puedes usar **negritas** y listas cortas).",
  "proposal": null | {
    "type": "JOURNAL_ENTRY",
    "description": "Descripción clara del asiento",
    "amount": 120.00,
    "lines": [
      { "account_code": "6104", "account_name": "Servicios Básicos", "debit": 120.00, "credit": 0 },
      { "account_code": "1102", "account_name": "Bancos e Instituciones Financieras", "debit": 0, "credit": 120.00 }
    ],
    "notes": "Nota breve opcional de verificación"
  }
}

CATÁLOGO DE CUENTAS DISPONIBLE:
${CATALOG_REFERENCE.map(c => `${c.code} - ${c.name}`).join('\n')}

CONTEXTO CONTABLE EN VIVO DEL PERÍODO (${context.filterMonth || ''}/${context.filterYear || ''}):
- Pestaña actual: ${context.activeTab || 'diario'}
- Ingresos Totales: $${Number(context.activeIncome || 0).toFixed(2)}
- Costos/Gastos Totales: $${Number(context.activeExpenses || 0).toFixed(2)}
- Margen Neto Global: $${Number(context.grossProfit || 0).toFixed(2)}
- IVA Débito Fiscal (Ventas): $${Number(context.totalDebitFiscal || 0).toFixed(2)}
- IVA Crédito Fiscal (Compras): $${Number(context.totalCreditFiscal || 0).toFixed(2)}
- Saldo F-07 (Débito - Crédito): $${Number(context.f07TaxBalance || 0).toFixed(2)}
- Pago a Cuenta F-14: $${Number(context.f14PagoCuenta || 0).toFixed(2)} (Total F-14: $${Number(context.f14Total || 0).toFixed(2)})
- Balance Comprobación: Debe $${Number(context.trialTotalDebit || 0).toFixed(2)} | Haber $${Number(context.trialTotalCredit || 0).toFixed(2)} | Cuadrado: ${context.trialBalanced ? 'SÍ' : 'NO'}
- Partidas en Diario: ${context.journalCount ?? 0} | Movimientos Caja Chica: ${context.pettyCashCount ?? 0}
${Array.isArray(context.recentEntries) && context.recentEntries.length > 0 ? `- Últimas partidas:\n${context.recentEntries.slice(0, 5).map(e => `  * ${e.description} ($${Number(e.amount || 0).toFixed(2)})`).join('\n')}` : ''}`;

    const conversationLines = history
      .map((h: any) => `${h.role === 'user' ? 'Auxiliar' : 'Asistente'}: ${String(h.text || '').slice(0, 400)}`)
      .join('\n');

    const prompt = `${systemPrompt}\n\n${conversationLines ? `HISTORIAL RECIENTE:\n${conversationLines}\n\n` : ''}MENSAJE ACTUAL DEL AUXILIAR:\n${message}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    let rawText = '';

    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      });
      const result = await model.generateContent(prompt);
      rawText = result.response.text();
    } catch {
      const modelFallback = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      });
      const result = await modelFallback.generateContent(prompt);
      rawText = result.response.text();
    }

    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    const validatedProposal = validateProposal(parsed?.proposal);

    return NextResponse.json({
      reply: String(parsed?.reply || 'Listo. ¿En qué más te ayudo con la contabilidad?'),
      proposal: validatedProposal,
      source: 'gemini',
    });
  } catch (err: any) {
    console.warn('Accounting AI Assistant fallback triggered:', err?.message || err);
    if (message) {
      const fallback = buildDeterministicFallback(message, context);
      return NextResponse.json({ ...fallback, source: 'fallback' });
    }
    return NextResponse.json(
      {
        reply: 'No pude procesar la consulta en este momento. Intenta reformularla o registra la partida manualmente en Libro Diario.',
        proposal: null,
        source: 'error-fallback',
      },
      { status: 200 }
    );
  }
}
