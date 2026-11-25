export type VisualDocArea = 'billing' | 'quotations' | 'purchases' | 'quedan';

export type VisualPaperSize = 'letter' | 'a4' | '80mm' | '58mm';

export type VisualBlockType =
  | 'logo'
  | 'title_banner'
  | 'company_info'
  | 'doc_meta'
  | 'items_table'
  | 'notes'
  | 'totals'
  | 'qr'
  | 'signature'
  | 'text'
  | 'divider';

export type VisibilityRule = 'always' | 'credit_only' | 'ccf_only';

export interface VisualBlock {
  id: string;
  type: VisualBlockType;
  label: string;
  x: number; // mm
  y: number; // mm
  w: number; // mm
  h: number; // mm
  visible?: boolean;
  visibilityRule?: VisibilityRule;
  content?: string;
  subContent?: string;
  imageUrl?: string;
  align?: 'left' | 'center' | 'right';
  color?: string;
  bgColor?: string;
  fontSize?: number; // px
  fontFamily?: 'Inter' | 'Montserrat' | 'Roboto' | 'Courier New';
  bold?: boolean;
  locked?: boolean;
}

export interface VisualTemplateConfig {
  enabled: boolean;
  name: string;
  paperSize: VisualPaperSize;
  accentColor: string;
  anchorTotalsBelowTable?: boolean;
  blocks: VisualBlock[];
}

export interface VisualRenderData {
  docTitle: string;
  docNumber: string;
  dateStr: string;
  customerName: string;
  customerNit?: string;
  customerNrc?: string;
  customerAddress?: string;
  paymentMethod?: string;
  isCredit?: boolean;
  isCcf?: boolean;
  creditDueDate?: string;
  creditAuthLabel?: string;
  observations?: string;
  items: Array<{
    qty: number;
    description: string;
    sku?: string;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  iva: number;
  retention?: number;
  total: number;
  qrData?: string;
  selloMh?: string;
  codGeneracion?: string;
}

export interface VisualBrandingInput {
  companyName: string;
  razonSocial?: string;
  slogan?: string;
  nit?: string;
  nrc?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  accentColor?: string;
  termsConditions?: string;
}

export const PAPER_DIMENSIONS_MM: Record<VisualPaperSize, { width: number; height: number; label: string }> = {
  letter: { width: 215.9, height: 279.4, label: 'Carta (216 × 279 mm)' },
  a4: { width: 210, height: 297, label: 'A4 (210 × 297 mm)' },
  '80mm': { width: 80, height: 210, label: 'Ticket 80 mm' },
  '58mm': { width: 58, height: 200, label: 'Ticket 58 mm' },
};

export const AREA_LABELS: Record<VisualDocArea, string> = {
  billing: 'Factura / DTE',
  quotations: 'Cotización',
  purchases: 'Orden de Compra',
  quedan: 'Quedan / Recibo',
};

function esc(val: any): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getDefaultVisualTemplate(
  area: VisualDocArea,
  branding?: Partial<VisualBrandingInput>
): VisualTemplateConfig {
  const accent = branding?.accentColor || (area === 'quotations' ? '#1e3a8a' : area === 'purchases' ? '#0f766e' : '#172554');
  const docTitle =
    area === 'billing'
      ? 'FACTURA'
      : area === 'quotations'
      ? 'COTIZACIÓN'
      : area === 'purchases'
      ? 'ORDEN DE COMPRA'
      : 'QUEDAN';

  return {
    enabled: false,
    name: `${AREA_LABELS[area]} Clásica`,
    paperSize: 'letter',
    accentColor: accent,
    anchorTotalsBelowTable: true,
    blocks: [
      {
        id: 'blk_logo',
        type: 'logo',
        label: 'Logo y Empresa',
        x: 12,
        y: 12,
        w: 96,
        h: 30,
        visible: true,
        visibilityRule: 'always',
        content: '{{empresa}}',
        subContent: '{{slogan}}',
        imageUrl: branding?.logoUrl || '',
        align: 'left',
        color: accent,
        fontSize: 18,
        fontFamily: 'Montserrat',
        bold: true,
      },
      {
        id: 'blk_banner',
        type: 'title_banner',
        label: 'Título del Documento',
        x: 118,
        y: 10,
        w: 86,
        h: 30,
        visible: true,
        visibilityRule: 'always',
        content: docTitle,
        subContent: 'No. {{numero}}',
        align: 'center',
        color: '#ffffff',
        bgColor: accent,
        fontSize: 24,
        fontFamily: 'Montserrat',
        bold: true,
      },
      {
        id: 'blk_company',
        type: 'company_info',
        label: 'Datos de la Empresa',
        x: 12,
        y: 46,
        w: 96,
        h: 24,
        visible: true,
        visibilityRule: 'always',
        content: 'Dirección: {{direccion}}\nTeléfono: {{telefono}}\nCorreo: {{correo}} | NIT: {{nit}}',
        align: 'left',
        color: '#1e293b',
        fontSize: 10,
        fontFamily: 'Inter',
      },
      {
        id: 'blk_meta',
        type: 'doc_meta',
        label: 'Fecha y Cliente',
        x: 118,
        y: 46,
        w: 86,
        h: 26,
        visible: true,
        visibilityRule: 'always',
        content: 'Fecha: {{fecha}}\nCliente: {{cliente}}\nPago: {{forma_pago}}',
        align: 'left',
        color: '#0f172a',
        bgColor: '#f8fafc',
        fontSize: 10,
        fontFamily: 'Inter',
      },
      {
        id: 'blk_table',
        type: 'items_table',
        label: 'Tabla de Productos',
        x: 12,
        y: 78,
        w: 192,
        h: 82,
        visible: true,
        visibilityRule: 'always',
        color: '#0f172a',
        bgColor: accent,
        fontSize: 10,
        fontFamily: 'Inter',
      },
      {
        id: 'blk_notes',
        type: 'notes',
        label: 'Observaciones',
        x: 12,
        y: 168,
        w: 102,
        h: 28,
        visible: true,
        visibilityRule: 'always',
        content: 'Observaciones:\n{{observaciones}}',
        align: 'left',
        color: '#334155',
        bgColor: '#f8fafc',
        fontSize: 10,
        fontFamily: 'Inter',
      },
      {
        id: 'blk_totals',
        type: 'totals',
        label: 'Totalizador',
        x: 122,
        y: 168,
        w: 82,
        h: 30,
        visible: true,
        visibilityRule: 'always',
        color: '#0f172a',
        bgColor: accent,
        fontSize: 11,
        fontFamily: 'Inter',
        bold: true,
      },
      {
        id: 'blk_qr',
        type: 'qr',
        label: 'Código QR DTE',
        x: 14,
        y: 204,
        w: 34,
        h: 34,
        visible: area === 'billing',
        visibilityRule: 'always',
        content: '{{sello_mh}}',
        color: '#0f172a',
        fontSize: 8,
        fontFamily: 'Inter',
      },
      {
        id: 'blk_thanks',
        type: 'text',
        label: 'Mensaje de Agradecimiento',
        x: 54,
        y: 214,
        w: 64,
        h: 14,
        visible: true,
        visibilityRule: 'always',
        content: 'Gracias por su compra',
        align: 'center',
        color: accent,
        fontSize: 14,
        fontFamily: 'Montserrat',
        bold: true,
      },
      {
        id: 'blk_sig',
        type: 'signature',
        label: 'Firma Autorizada',
        x: 128,
        y: 214,
        w: 76,
        h: 20,
        visible: true,
        visibilityRule: 'always',
        content: 'Firma Autorizada / Recibido',
        align: 'center',
        color: '#1e293b',
        fontSize: 10,
        fontFamily: 'Inter',
      },
    ],
  };
}

export function getSampleRenderData(area: VisualDocArea): VisualRenderData {
  return {
    docTitle: AREA_LABELS[area].toUpperCase(),
    docNumber: area === 'billing' ? '0001-0000142' : area === 'quotations' ? 'COT-2026-089' : area === 'purchases' ? 'OC-2026-045' : 'QDN-2026-019',
    dateStr: new Date().toLocaleDateString('es-SV'),
    customerName: area === 'purchases' ? 'Distribuidora Química Industrial S.A.' : 'Constructora El Progreso S.A. de C.V.',
    customerNit: '0614-220518-104-2',
    customerNrc: '248910-5',
    customerAddress: 'Col. Escalón, San Salvador',
    paymentMethod: 'Contado / Transferencia',
    isCredit: false,
    isCcf: true,
    observations: 'Entrega inmediata en bodega central. Precios expresados en USD.',
    items: [
      { qty: 2, description: 'Pintura Látex Premium Blanco Galón', sku: 'PINT-BL-1G', unitPrice: 24.5, total: 49.0 },
      { qty: 4, description: 'Brocha Profesional 3 pulgadas', sku: 'BRO-3P', unitPrice: 3.75, total: 15.0 },
      { qty: 1, description: 'Sellador Acrílico Cubeta 5 Galones', sku: 'SEL-5G', unitPrice: 68.0, total: 68.0 },
    ],
    subtotal: 116.81,
    iva: 15.19,
    total: 132.0,
    qrData: 'https://admin.factura.gob.sv/consultaPublica?ambiente=00&codGen=DEMO-NEXWAY-2026',
    selloMh: '2026ABCD9876EFGH5432IJKL',
    codGeneracion: 'A1B2C3D4-E5F6-7890-ABCD-1234567890EF',
  };
}

function resolvePlaceholders(
  raw: string | undefined,
  data: VisualRenderData,
  branding: VisualBrandingInput
): string {
  if (!raw) return '';
  const map: Record<string, string> = {
    '{{empresa}}': branding.companyName || 'ERP NEXWAY',
    '{{razon_social}}': branding.razonSocial || branding.companyName || 'ERP NEXWAY',
    '{{slogan}}': branding.slogan || '',
    '{{direccion}}': branding.address || 'San Salvador, El Salvador',
    '{{telefono}}': branding.phone || '',
    '{{correo}}': branding.email || '',
    '{{nit}}': branding.nit || '',
    '{{nrc}}': branding.nrc || '',
    '{{documento}}': data.docTitle || '',
    '{{numero}}': data.docNumber || '',
    '{{fecha}}': data.dateStr || '',
    '{{cliente}}': data.customerName || 'Consumidor Final',
    '{{cliente_nit}}': data.customerNit || '',
    '{{cliente_nrc}}': data.customerNrc || '',
    '{{forma_pago}}': data.paymentMethod || 'Contado',
    '{{observaciones}}': data.observations || branding.termsConditions || '',
    '{{subtotal}}': `$${Number(data.subtotal || 0).toFixed(2)}`,
    '{{iva}}': `$${Number(data.iva || 0).toFixed(2)}`,
    '{{total}}': `$${Number(data.total || 0).toFixed(2)}`,
    '{{sello_mh}}': data.selloMh || '',
    '{{codigo_generacion}}': data.codGeneracion || '',
  };

  let out = raw;
  for (const [key, val] of Object.entries(map)) {
    out = out.split(key).join(val);
  }
  return out;
}

function shouldRenderBlock(block: VisualBlock, data: VisualRenderData): boolean {
  if (block.visible === false) return false;
  if (block.visibilityRule === 'credit_only' && !data.isCredit) return false;
  if (block.visibilityRule === 'ccf_only' && !data.isCcf) return false;
  return true;
}

function renderBlockInnerHtml(
  block: VisualBlock,
  data: VisualRenderData,
  branding: VisualBrandingInput,
  accent: string,
  isThermal: boolean
): string {
  const align = block.align || 'left';
  const color = block.color || '#0f172a';
  const fontSize = block.fontSize || (isThermal ? 9 : 11);
  const fontFamily = block.fontFamily || 'Inter';
  const fontWeight = block.bold ? '700' : '400';

  switch (block.type) {
    case 'logo': {
      const logoSrc = block.imageUrl || branding.logoUrl || '';
      const title = esc(resolvePlaceholders(block.content || '{{empresa}}', data, branding));
      const sub = esc(resolvePlaceholders(block.subContent || '{{slogan}}', data, branding));
      return `
        <div style="display:flex;align-items:center;gap:10px;justify-content:${align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'};font-family:'${fontFamily}',sans-serif;height:100%;">
          ${logoSrc ? `<img src="${esc(logoSrc)}" alt="Logo" style="max-height:${isThermal ? '34px' : '58px'};max-width:${isThermal ? '48px' : '90px'};object-fit:contain;" />` : ''}
          <div style="text-align:${align};">
            <div style="font-size:${fontSize}px;font-weight:800;color:${color};line-height:1.15;">${title}</div>
            ${sub ? `<div style="font-size:${Math.max(8, fontSize - 6)}px;color:#475569;margin-top:2px;">${sub}</div>` : ''}
          </div>
        </div>
      `;
    }

    case 'title_banner': {
      const title = esc(resolvePlaceholders(block.content || data.docTitle, data, branding));
      const sub = esc(resolvePlaceholders(block.subContent || 'No. {{numero}}', data, branding));
      return `
        <div style="background:${block.bgColor || accent};color:${color};padding:${isThermal ? '6px 8px' : '10px 14px'};border-radius:6px;text-align:${align};font-family:'${fontFamily}',sans-serif;height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;">
          <div style="font-size:${fontSize}px;font-weight:900;letter-spacing:0.04em;line-height:1.1;">${title}</div>
          ${sub ? `<div style="font-size:${Math.max(9, fontSize - 11)}px;opacity:0.92;margin-top:3px;font-weight:600;">${sub}</div>` : ''}
        </div>
      `;
    }

    case 'company_info':
    case 'doc_meta':
    case 'notes': {
      const text = esc(resolvePlaceholders(block.content, data, branding)).replace(/\n/g, '<br/>');
      const bg = block.bgColor ? `background:${block.bgColor};border:1px solid #e2e8f0;border-radius:6px;padding:6px 8px;` : '';
      const creditBanner =
        block.type === 'doc_meta' && data.isCredit
          ? `<div style="margin-top:4px;padding:3px 6px;background:#fef3c7;border:1px solid #f59e0b;color:#92400e;font-weight:800;font-size:9px;border-radius:4px;">VENTA AL CRÉDITO${data.creditDueDate ? ` · Vence: ${esc(data.creditDueDate)}` : ''}</div>`
          : '';
      const authBanner =
        block.type === 'notes' && data.creditAuthLabel
          ? `<div style="margin-top:4px;font-size:9px;font-weight:700;color:#1d4ed8;">${esc(data.creditAuthLabel)}</div>`
          : '';
      return `
        <div style="${bg}text-align:${align};color:${color};font-size:${fontSize}px;font-family:'${fontFamily}',sans-serif;font-weight:${fontWeight};line-height:1.45;box-sizing:border-box;">
          ${text}${creditBanner}${authBanner}
        </div>
      `;
    }

    case 'items_table': {
      const headerBg = block.bgColor || accent;
      const rows = (data.items || [])
        .map(
          it => `
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:${isThermal ? '3px 2px' : '5px 8px'};text-align:center;">${Number(it.qty || 0)}</td>
            <td style="padding:${isThermal ? '3px 2px' : '5px 8px'};">${esc(it.description)}</td>
            ${!isThermal ? `<td style="padding:5px 8px;text-align:right;font-family:monospace;">$${Number(it.unitPrice || 0).toFixed(2)}</td>` : ''}
            <td style="padding:${isThermal ? '3px 2px' : '5px 8px'};text-align:right;font-family:monospace;font-weight:600;">$${Number(it.total || 0).toFixed(2)}</td>
          </tr>`
        )
        .join('');
      return `
        <table style="width:100%;border-collapse:collapse;font-size:${fontSize}px;font-family:'${fontFamily}',sans-serif;color:${color};">
          <thead>
            <tr style="background:${headerBg};color:#ffffff;">
              <th style="padding:${isThermal ? '4px 2px' : '6px 8px'};text-align:center;width:${isThermal ? '16%' : '11%'};">Cant.</th>
              <th style="padding:${isThermal ? '4px 2px' : '6px 8px'};text-align:left;">Descripción</th>
              ${!isThermal ? '<th style="padding:6px 8px;text-align:right;width:18%;">Precio Unit.</th>' : ''}
              <th style="padding:${isThermal ? '4px 2px' : '6px 8px'};text-align:right;width:${isThermal ? '24%' : '18%'};">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="4" style="padding:10px;text-align:center;color:#94a3b8;">Sin ítems</td></tr>'}
          </tbody>
        </table>
      `;
    }

    case 'totals': {
      const barBg = block.bgColor || accent;
      return `
        <div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;font-family:'${fontFamily}',sans-serif;font-size:${fontSize}px;color:${color};">
          <div style="display:flex;justify-content:space-between;padding:5px 10px;border-bottom:1px solid #f1f5f9;">
            <span>Subtotal:</span>
            <strong style="font-family:monospace;">$${Number(data.subtotal || 0).toFixed(2)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:5px 10px;border-bottom:1px solid #f1f5f9;">
            <span>IVA (13%):</span>
            <strong style="font-family:monospace;">$${Number(data.iva || 0).toFixed(2)}</strong>
          </div>
          ${
            data.retention && data.retention > 0
              ? `<div style="display:flex;justify-content:space-between;padding:5px 10px;border-bottom:1px solid #f1f5f9;"><span>Retención 1%:</span><strong style="font-family:monospace;">-$${Number(data.retention).toFixed(2)}</strong></div>`
              : ''
          }
          <div style="display:flex;justify-content:space-between;padding:7px 10px;background:${barBg};color:#ffffff;font-weight:900;font-size:${fontSize + 2}px;">
            <span>TOTAL:</span>
            <span style="font-family:monospace;">$${Number(data.total || 0).toFixed(2)}</span>
          </div>
        </div>
      `;
    }

    case 'qr': {
      const qrPayload = encodeURIComponent(data.qrData || `NEXWAY|${data.docNumber}|${data.total.toFixed(2)}`);
      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=2&data=${qrPayload}`;
      const sello = esc(resolvePlaceholders(block.content || '{{sello_mh}}', data, branding));
      return `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-family:'${fontFamily}',sans-serif;">
          <img src="${qrSrc}" alt="QR DTE" style="width:${isThermal ? '76px' : '96px'};height:${isThermal ? '76px' : '96px'};border:1px solid #e2e8f0;border-radius:4px;" />
          ${sello ? `<div style="font-size:7px;color:#475569;margin-top:3px;word-break:break-all;">Sello: ${sello}</div>` : ''}
        </div>
      `;
    }

    case 'signature': {
      const label = esc(resolvePlaceholders(block.content || 'Firma Autorizada', data, branding));
      return `
        <div style="display:flex;flex-direction:column;justify-content:flex-end;height:100%;text-align:${align};font-family:'${fontFamily}',sans-serif;">
          <div style="border-top:1px solid #334155;padding-top:4px;font-size:${fontSize}px;color:${color};font-weight:600;">${label}</div>
        </div>
      `;
    }

    case 'divider': {
      return `<div style="width:100%;height:0;border-top:2px solid ${color || '#cbd5e1'};margin-top:4px;"></div>`;
    }

    case 'text':
    default: {
      const text = esc(resolvePlaceholders(block.content || 'Texto', data, branding)).replace(/\n/g, '<br/>');
      return `
        <div style="text-align:${align};color:${color};font-size:${fontSize}px;font-family:'${fontFamily}',sans-serif;font-weight:${fontWeight};line-height:1.35;">
          ${text}
        </div>
      `;
    }
  }
}

export function renderVisualTemplateHtml(
  template: VisualTemplateConfig,
  data: VisualRenderData,
  branding: VisualBrandingInput
): string {
  const paper = PAPER_DIMENSIONS_MM[template.paperSize] || PAPER_DIMENSIONS_MM.letter;
  const isThermal = template.paperSize === '80mm' || template.paperSize === '58mm';
  const accent = template.accentColor || branding.accentColor || '#172554';

  const visibleBlocks = (template.blocks || []).filter(b => shouldRenderBlock(b, data));

  // En modo térmico (80mm/58mm), los bloques fluyen verticalmente ordenados por Y para que nunca se corten
  if (isThermal) {
    const ordered = [...visibleBlocks].sort((a, b) => a.y - b.y);
    const bodyHtml = ordered
      .map(
        b =>
          `<div style="margin-bottom:6px;width:100%;">${renderBlockInnerHtml(b, data, branding, accent, true)}</div>`
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${esc(data.docTitle)} ${esc(data.docNumber)}</title>
  <style>
    @page { size: ${paper.width}mm auto; margin: 3mm; }
    body { margin: 0; padding: 3mm; width: ${paper.width - 6}mm; background: #fff; color: #0f172a; font-family: Inter, Arial, sans-serif; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
  }

  // En Carta / A4: cálculo inteligente por si la tabla tiene muchos ítems y anchorTotalsBelowTable está activo
  const tableBlock = visibleBlocks.find(b => b.type === 'items_table');
  let extraYOffsetMm = 0;
  if (template.anchorTotalsBelowTable && tableBlock) {
    const estimatedTableHeightMm = 12 + (data.items?.length || 1) * 7.5;
    if (estimatedTableHeightMm > tableBlock.h) {
      extraYOffsetMm = Math.ceil(estimatedTableHeightMm - tableBlock.h + 4);
    }
  }

  const tableBottomY = tableBlock ? tableBlock.y + tableBlock.h : 9999;

  const blocksHtml = visibleBlocks
    .map(b => {
      const shiftedY = b.type !== 'items_table' && b.y >= tableBottomY - 2 ? b.y + extraYOffsetMm : b.y;
      const heightRule = b.type === 'items_table' ? `min-height:${b.h}mm;` : `height:${b.h}mm;`;
      return `
        <div style="position:absolute;left:${b.x}mm;top:${shiftedY}mm;width:${b.w}mm;${heightRule}box-sizing:border-box;">
          ${renderBlockInnerHtml(b, data, branding, accent, false)}
        </div>
      `;
    })
    .join('');

  const finalPageHeight = Math.max(paper.height, paper.height + extraYOffsetMm);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${esc(data.docTitle)} ${esc(data.docNumber)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Montserrat:wght@600;700;800;900&family=Roboto:wght@400;500;700&display=swap" />
  <style>
    @page { size: ${template.paperSize === 'a4' ? 'A4' : 'letter'}; margin: 0; }
    html, body { margin: 0; padding: 0; background: #ffffff; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { position: relative; width: ${paper.width}mm; min-height: ${finalPageHeight}mm; background: #ffffff; overflow: hidden; }
  </style>
</head>
<body>
  <div class="sheet">
    ${blocksHtml}
  </div>
</body>
</html>`;
}
