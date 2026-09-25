export interface PrintBlock {
  id: string;
  type: 'header' | 'customer' | 'items_table' | 'totals' | 'qr_hacienda' | 'footer' | 'custom_text' | 'divider';
  title?: string;
  showLogo?: boolean;
  showAddress?: boolean;
  showPhone?: boolean;
  showNit?: boolean;
  showNrc?: boolean;
  fontSize?: 'small' | 'normal' | 'large';
  showSku?: boolean;
  showIva?: boolean;
  showRetencion?: boolean;
  showSello?: boolean;
  customMessage?: string;
  showSignatures?: boolean;
  content?: string;
  text?: string;
  align?: 'left' | 'center' | 'right';
}

export interface PrintTemplateScheme {
  id?: string;
  nombre?: string;
  paper_size: '80mm' | '58mm' | 'A4';
  blocks: PrintBlock[];
}

export const PYTHON_PDF_SERVICE_URL = process.env.NEXT_PUBLIC_PDF_SERVICE_URL || 'http://localhost:8000';

export async function checkPythonPdfServiceHealth(): Promise<{ online: boolean; message: string; version?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${PYTHON_PDF_SERVICE_URL}/api/v1/health`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      return { online: true, message: 'Microservicio Python Conectado', version: data.version };
    }
    return { online: false, message: 'Microservicio no responde' };
  } catch (err: any) {
    return { online: false, message: 'Modo Local / Microservicio Offline' };
  }
}

export async function compileTemplateWithPython(scheme: PrintTemplateScheme, sampleData?: any): Promise<Blob> {
  const payload = {
    template_name: scheme.nombre || 'Ticket Térmico POS',
    paper_size: scheme.paper_size || '80mm',
    blocks: scheme.blocks || [],
    emisor: sampleData?.emisor || {
      nombre: 'NEXWAY ERP S.A. DE C.V.',
      nit: '0614-150890-102-1',
      nrc: '283940-1',
      direccion: 'San Salvador, El Salvador',
      telefono: '+503 2200-0000'
    },
    receptor: sampleData?.receptor || sampleData?.cliente || {
      nombre: sampleData?.cliente?.razon_social || 'CLIENTE GENERAL / CONSUMIDOR FINAL',
      numDocumento: sampleData?.cliente?.nit || '0614-010190-001-0',
      nrc: sampleData?.cliente?.nrc || 'N/A',
      direccion: sampleData?.cliente?.direccion || 'San Salvador'
    },
    identificacion: sampleData?.identificacion || {
      fecEmi: new Date().toISOString().slice(0, 10),
      horEmi: new Date().toLocaleTimeString('es-SV'),
      tipoDteNombre: scheme.paper_size === 'A4' ? 'COMPROBANTE DE CRÉDITO FISCAL (DTE-03)' : 'FACTURA DE CONSUMIDOR FINAL (DTE-01)',
      codigoGeneracion: sampleData?.dte?.codigo_generacion || 'DTE-01-C001-0000001892',
      numeroControl: sampleData?.dte?.numero_control || 'DTE-01-00000000-000000000001892',
      ambiente: '00'
    },
    items: sampleData?.items || [
      { cantidad: 2, descripcion: 'Cemento Portland 42.5kg Max', precioUni: 10.50, ventaGravada: 21.00, sku: 'CEM-01' },
      { cantidad: 1, descripcion: 'Pintura Acrílica Blanco 1 Gal', precioUni: 18.00, ventaGravada: 18.00, sku: 'PIN-02' }
    ],
    resumen: sampleData?.resumen || {
      subTotal: 34.51,
      totalIva: 4.49,
      totalPagar: 39.00,
      totalLetras: 'TREINTA Y NUEVE 00/100 USD'
    },
    selloRecepcion: sampleData?.dte?.sello_recepcion || '2026-SELLO-MH-904128914-OFFICIAL'
  };

  const response = await fetch(`${PYTHON_PDF_SERVICE_URL}/api/v1/reports/custom-template-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error en microservicio Python (${response.status}): ${errorText}`);
  }

  return await response.blob();
}

export function renderTemplateToPrint(scheme: PrintTemplateScheme, data?: any): string {
  const isA4 = scheme.paper_size === 'A4';
  const paperWidth = scheme.paper_size === '58mm' ? '200px' : scheme.paper_size === '80mm' ? '280px' : '750px';

  const dte = data?.dte || {
    codigo_generacion: 'DTE-01-C001-0000001892',
    numero_control: 'DTE-01-00000000-000000000001892',
    sello_recepcion: '2026-SELLO-MH-904128914-OFFICIAL',
    modelo_facturacion: 'Previo (Transmisión Normal)',
    qr_code: 'https://mh.gob.sv/consulta/DTE-01-C001-0000001892'
  };

  const cliente = data?.cliente || {
    razon_social: 'COMERCIALIZADORA EL SALVADOR S.A. DE C.V.',
    nit: '0614-150890-102-1',
    nrc: '29814-0',
    giro: 'Venta de Materiales de Construcción y Ferretería',
    direccion: 'San Salvador, El Salvador'
  };

  const items = data?.items || [
    { sku: 'CEM-01', cantidad: 2, descripcion: 'CEMENTO PORTLAND 42.5KG MAX', precio: 10.50, total: 21.00 },
    { sku: 'VAR-12', cantidad: 5, descripcion: 'VARILLA DE HIERRO 1/2" x 6M G60', precio: 7.20, total: 36.00 }
  ];

  const subtotal = data?.subtotal ?? (items.reduce((acc: number, item: any) => acc + (parseFloat(item.total) || 0), 0) / 1.13);
  const iva_13 = data?.iva_13 ?? (subtotal * 0.13);
  const total = data?.total ?? (subtotal + iva_13);
  const fecha = data?.fecha || new Date().toLocaleDateString('es-SV');

  let blocksHtml = '';

  (scheme.blocks || []).forEach(block => {
    switch (block.type) {
      case 'header':
        const dteTipoNombre = dte.tipo_doc_nombre || 'FACTURA ELECTRÓNICA (FE - TIPO 01)';
        const dteTipoCodigo = dte.tipo_doc_codigo || '01';

        if (isA4) {
          blocksHtml += `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 12px;">
              <div style="width: 58%;">
                ${block.showLogo ? `<div style="font-weight:900; font-size:22px; color:#1e293b; letter-spacing:-0.5px; margin-bottom:2px;">NEXWAY ERP</div>` : ''}
                <h2 style="margin: 0; font-size: 14px; font-weight: 800; text-transform: uppercase;">${block.title || 'NEXWAY ERP S.A. DE C.V.'}</h2>
                <p style="margin: 2px 0; font-size: 10px; color:#475569;">Giro: Venta al por mayor de materiales y soluciones informáticas</p>
                ${block.showAddress ? `<p style="margin: 1px 0; font-size: 10px; color:#475569;">Dirección: San Salvador, El Salvador C.A.</p>` : ''}
                ${block.showPhone ? `<p style="margin: 1px 0; font-size: 10px; color:#475569;">Teléfono: (503) 2200-0000 | Email: facturacion@nexway.sv</p>` : ''}
                <p style="margin: 1px 0; font-size: 10px; font-weight:bold;">NIT: 0614-010124-101-9 | NRC: 301290-4</p>
              </div>

              <div style="width: 40%; border: 1.5px solid #000; border-radius: 6px; padding: 8px; background: #f8fafc; text-align: center;">
                <p style="margin: 0; font-size: 10px; font-weight: 900; text-transform: uppercase; color:#1e3a8a;">MINISTERIO DE HACIENDA DE EL SALVADOR</p>
                <p style="margin: 2px 0; font-size: 11px; font-weight: 900; text-transform: uppercase; color:#0f172a; background:#e2e8f0; padding:3px; border-radius:4px;">${dteTipoNombre}</p>
                <hr style="margin: 4px 0; border: none; border-top: 1px solid #cbd5e1;"/>
                <p style="margin: 2px 0; font-size: 9px;"><strong>Código Generación:</strong></p>
                <p style="margin: 0; font-size: 9px; font-family: monospace; font-weight: bold; color: #2563eb;">${dte.codigo_generacion}</p>
                <p style="margin: 2px 0; font-size: 9px;"><strong>Número de Control:</strong></p>
                <p style="margin: 0; font-size: 9px; font-family: monospace;">${dte.numero_control || 'DTE-' + dteTipoCodigo + '-00000000-000000000001'}</p>
                <p style="margin: 2px 0; font-size: 9px;"><strong>Sello Recepción MH:</strong></p>
                <p style="margin: 0; font-size: 8.5px; font-family: monospace; color:#16a34a;">${dte.sello_recepcion}</p>
                <p style="margin: 3px 0 0 0; font-size: 9.5px; font-weight: bold;">FECHA EMISIÓN: ${fecha}</p>
              </div>
            </div>
          `;
        } else {
          blocksHtml += `
            <div style="text-align: center; border-bottom: 1px dashed #333; padding-bottom: 8px; margin-bottom: 8px;">
              ${block.showLogo ? `<div style="font-weight:900; font-size:16px; margin-bottom:4px;">NEXWAY ERP</div>` : ''}
              <h2 style="margin: 0; font-size: 14px; font-weight: bold;">${block.title || 'NEXWAY ERP S.A. DE C.V.'}</h2>
              ${block.showAddress ? `<p style="margin: 2px 0; font-size: 10px;">San Salvador, El Salvador</p>` : ''}
              ${block.showPhone ? `<p style="margin: 2px 0; font-size: 10px;">Tel: (503) 2200-0000</p>` : ''}
              <p style="margin: 2px 0; font-size: 10px; font-weight: bold;">FECHA: ${fecha}</p>
            </div>
          `;
        }
        break;

      case 'customer':
        if (isA4) {
          blocksHtml += `
            <div style="border: 1px solid #000; border-radius: 4px; padding: 8px; margin-bottom: 12px; font-size: 11px; background: #fff;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 50%; padding: 2px 0;"><strong>Receptor / Cliente:</strong> ${cliente.razon_social}</td>
                  <td style="width: 50%; padding: 2px 0;"><strong>NIT / Doc:</strong> ${block.showNit !== false ? cliente.nit : 'Consumidor Final'}</td>
                </tr>
                <tr>
                  <td style="padding: 2px 0;"><strong>Giro / Actividad:</strong> ${cliente.giro}</td>
                  <td style="padding: 2px 0;"><strong>NRC:</strong> ${block.showNrc !== false ? cliente.nrc : 'N/A'}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 2px 0;"><strong>Dirección:</strong> ${cliente.direccion}</td>
                </tr>
              </table>
            </div>
          `;
        } else {
          blocksHtml += `
            <div style="font-size: ${block.fontSize === 'small' ? '9px' : block.fontSize === 'large' ? '12px' : '10px'}; border-bottom: 1px dashed #333; padding-bottom: 6px; margin-bottom: 6px;">
              <p style="margin: 2px 0;"><strong>Cliente:</strong> ${cliente.razon_social}</p>
              ${block.showNit ? `<p style="margin: 2px 0;"><strong>NIT/DUI:</strong> ${cliente.nit}</p>` : ''}
              ${block.showNrc ? `<p style="margin: 2px 0;"><strong>NRC:</strong> ${cliente.nrc}</p>` : ''}
              <p style="margin: 2px 0; font-family: monospace;"><strong>DTE:</strong> ${dte.codigo_generacion.slice(0, 18)}...</p>
            </div>
          `;
        }
        break;

      case 'items_table':
        let tableRows = '';
        items.forEach((item: any) => {
          tableRows += `
            <tr>
              <td style="text-align: left; padding: 4px 0;">${item.cantidad}x</td>
              <td style="text-align: left; padding: 4px 0;">
                <div>${item.descripcion}</div>
                ${block.showSku ? `<div style="font-size:8px; color:#64748b;">SKU: ${item.sku}</div>` : ''}
              </td>
              <td style="text-align: right; padding: 4px 0;">$${parseFloat(item.precio).toFixed(2)}</td>
              <td style="text-align: right; padding: 4px 0; font-weight: bold;">$${parseFloat(item.total).toFixed(2)}</td>
            </tr>
          `;
        });

        blocksHtml += `
          <table style="width: 100%; border-collapse: collapse; font-size: ${isA4 ? '11px' : block.fontSize === 'small' ? '9px' : '10px'}; margin-bottom: 8px;">
            <thead>
              <tr style="border-bottom: 1.5px solid #000; text-transform: uppercase;">
                <th style="text-align: left; padding-bottom: 4px; width: 12%;">Cant</th>
                <th style="text-align: left; padding-bottom: 4px; width: 55%;">Descripción</th>
                <th style="text-align: right; padding-bottom: 4px; width: 15%;">P.U.</th>
                <th style="text-align: right; padding-bottom: 4px; width: 18%;">Total</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        `;
        break;

      case 'totals':
        blocksHtml += `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; border-top: 1.5px solid #000; padding-top: 8px; margin-top:10px;">
            ${isA4 ? `
              <div style="width: 55%; font-size: 10px; background: #f8fafc; padding: 8px; border-radius: 4px; border: 1px solid #e2e8f0;">
                <p style="margin: 0; font-weight: bold; text-transform: uppercase; color: #475569;">Valor en Letras:</p>
                <p style="margin: 2px 0 0 0; font-weight: bold; font-size: 11px;">CUARENTA Y UN DÓLARES CON 81/100 USD</p>
              </div>
            ` : '<div></div>'}

            <div style="width: ${isA4 ? '40%' : '100%'}; text-align: right; font-size: ${block.fontSize === 'large' ? '13px' : '11px'};">
              <p style="margin: 2px 0;">Subtotal Ventas Gravadas: <strong>$${subtotal.toFixed(2)}</strong></p>
              ${block.showIva !== false ? `<p style="margin: 2px 0;">IVA (13%): <strong>$${iva_13.toFixed(2)}</strong></p>` : ''}
              ${block.showRetencion ? `<p style="margin: 2px 0; color:#dc2626;">(-) Retención 1% IVA: <strong>$0.00</strong></p>` : ''}
              <p style="margin: 6px 0 0 0; font-size: ${isA4 ? '18px' : '14px'}; font-weight: 900; color: #000; background: #f1f5f9; padding: 4px; border-radius: 4px;">TOTAL A PAGAR: $${total.toFixed(2)}</p>
            </div>
          </div>
        `;
        break;

      case 'qr_hacienda':
        blocksHtml += `
          <div style="margin: 12px 0; padding: 8px; border: 1px dashed #94a3b8; border-radius: 6px; font-size: 10px; background: #fafafa; display: flex; align-items: center; justify-content: space-between;">
            <div style="width: 70%;">
              <p style="margin: 0; font-weight: bold; color: #1e293b;">Consulta Pública DTE Ministerio de Hacienda</p>
              <p style="margin: 2px 0; font-family: monospace; font-size: 9px;">Sello MH: ${dte.sello_recepcion}</p>
              <p style="margin: 2px 0; font-size: 8.5px; color: #64748b;">Escanee el código QR para validar la autenticidad de la representación gráfica digital.</p>
            </div>
            <div style="width: 25%; text-align: center; background: #ffffff; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-weight: bold; font-size: 9px;">
              [QR VERIFICACIÓN HACIENDA DTE]
            </div>
          </div>
        `;
        break;

      case 'footer':
        blocksHtml += `
          <div style="margin-top: 16px; border-top: 1px solid #cbd5e1; padding-top: 10px; font-size: 10px;">
            <p style="margin: 4px 0; font-weight: bold; text-align: center;">${block.customMessage || '¡Gracias por su preferencia comercial en NexWay ERP!'}</p>
            ${block.showSignatures ? `
              <div style="display:flex; justify-content:space-around; margin-top:35px; font-size:10px; text-align:center;">
                <div>
                  <p style="margin:0;">_________________________________</p>
                  <p style="margin:2px 0; font-weight:bold;">Entregado Por (Firma / Sello)</p>
                </div>
                <div>
                  <p style="margin:0;">_________________________________</p>
                  <p style="margin:2px 0; font-weight:bold;">Recibido Conforme (Nombre / Firma)</p>
                </div>
              </div>
            ` : ''}
          </div>
        `;
        break;

      case 'custom_text':
        blocksHtml += `
          <div style="margin: 6px 0; font-size: 10px; text-align: ${block.align || 'left'}; color: #334155;">
            <p>${block.content || block.text || ''}</p>
          </div>
        `;
        break;

      case 'divider':
        blocksHtml += `<div style="border-top: 1.5px solid #000; margin: 8px 0;"></div>`;
        break;
    }
  });

  return `
    <html>
      <head>
        <title>Representación Gráfica DTE - NexWay ERP</title>
        <style>
          @page {
            size: ${isA4 ? 'letter' : '80mm auto'};
            margin: ${isA4 ? '10mm' : '2mm'};
          }
          body {
            margin: 0;
            padding: 0;
            background: #e2e8f0;
          }
        </style>
      </head>
      <body>
        <div style="width: ${paperWidth}; font-family: 'DM Sans', Arial, sans-serif; color: #000; padding: ${isA4 ? '24px' : '12px'}; background: #fff; margin: auto; border: ${isA4 ? '1px solid #cbd5e1' : 'none'}; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); min-height: ${isA4 ? '950px' : 'auto'}; box-sizing: border-box;">
          ${blocksHtml}
        </div>
      </body>
    </html>
  `;
}
