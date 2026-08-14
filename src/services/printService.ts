export interface PrintBlock {
  id: string;
  type: 'header' | 'customer' | 'items_table' | 'totals' | 'qr_hacienda' | 'footer';
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
}

export interface PrintTemplateScheme {
  id?: string;
  nombre?: string;
  paper_size: '80mm' | '58mm' | 'A4'; // 'A4' representa la Hoja Carta / Letter Oficial DTE (8.5" x 11")
  blocks: PrintBlock[];
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
        if (isA4) {
          // Encabezado Corporativo Formal de 2 Columnas para Tamaño Carta
          blocksHtml += `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 12px;">
              <div style="width: 60%;">
                ${block.showLogo ? `<div style="font-weight:900; font-size:22px; color:#1e293b; letter-spacing:-0.5px; margin-bottom:2px;">NEXWAY ERP</div>` : ''}
                <h2 style="margin: 0; font-size: 14px; font-weight: 800; text-transform: uppercase;">${block.title || 'NEXWAY ERP S.A. DE C.V.'}</h2>
                <p style="margin: 2px 0; font-size: 10px; color:#475569;">Giro: Venta al por mayor de materiales y soluciones de software</p>
                ${block.showAddress ? `<p style="margin: 1px 0; font-size: 10px; color:#475569;">Dirección: San Salvador, El Salvador C.A.</p>` : ''}
                ${block.showPhone ? `<p style="margin: 1px 0; font-size: 10px; color:#475569;">Teléfono: (503) 2200-0000 | Email: contacto@nexway.sv</p>` : ''}
                <p style="margin: 1px 0; font-size: 10px; font-weight:bold;">NIT: 0614-010124-101-9 | NRC: 301290-4</p>
              </div>

              <div style="width: 38%; border: 1.5px solid #000; border-radius: 6px; padding: 8px; background: #f8fafc; text-align: center;">
                <p style="margin: 0; font-size: 11px; font-weight: 900; text-transform: uppercase; color:#1e3a8a;">DOCUMENTO TRIBUTARIO ELECTRÓNICO</p>
                <p style="margin: 2px 0; font-size: 12px; font-weight: 800;">REPRESENTACIÓN GRÁFICA (CARTA)</p>
                <hr style="margin: 4px 0; border: none; border-top: 1px solid #cbd5e1;"/>
                <p style="margin: 2px 0; font-size: 9px;"><strong>Código Generación:</strong></p>
                <p style="margin: 0; font-size: 9.5px; font-family: monospace; font-weight: bold; color: #2563eb;">${dte.codigo_generacion}</p>
                <p style="margin: 2px 0; font-size: 9px;"><strong>Sello Recepción MH:</strong></p>
                <p style="margin: 0; font-size: 8.5px; font-family: monospace;">${dte.sello_recepcion}</p>
                <p style="margin: 3px 0 0 0; font-size: 9.5px; font-weight: bold; background: #e2e8f0; padding: 2px; border-radius: 3px;">FECHA EMISIÓN: ${fecha}</p>
              </div>
            </div>
          `;
        } else {
          // Encabezado Térmico POS 80mm
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
        blocksHtml += `
          <div style="margin-bottom: 12px; font-size: ${block.fontSize === 'small' ? '10px' : block.fontSize === 'large' ? '13px' : '11px'}; background: ${isA4 ? '#f1f5f9' : 'transparent'}; padding: ${isA4 ? '10px 12px' : '0'}; border-radius: 6px; border: ${isA4 ? '1px solid #cbd5e1' : 'none'};">
            <div style="display: grid; grid-template-columns: ${isA4 ? '1fr 1fr' : '1fr'}; gap: 6px;">
              <div>
                <p style="margin: 2px 0;"><strong>RAZÓN SOCIAL CLIENTE:</strong> ${cliente.razon_social}</p>
                ${block.showNit ? `<p style="margin: 2px 0;"><strong>NIT / DUI:</strong> ${cliente.nit}</p>` : ''}
                ${block.showNrc ? `<p style="margin: 2px 0;"><strong>NRC:</strong> ${cliente.nrc}</p>` : ''}
              </div>
              <div>
                <p style="margin: 2px 0;"><strong>GIRO COMERCIAL:</strong> ${cliente.giro}</p>
                <p style="margin: 2px 0;"><strong>DIRECCIÓN:</strong> ${cliente.direccion}</p>
                <p style="margin: 2px 0;"><strong>CONDICIÓN DE PAGO:</strong> Contado / Crédito 30 días</p>
              </div>
            </div>
          </div>
        `;
        break;

      case 'items_table':
        const fontSizePx = block.fontSize === 'small' ? '10px' : block.fontSize === 'large' ? '13px' : '11px';
        let tableRows = '';
        items.forEach((it: any) => {
          tableRows += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              ${isA4 ? `<td style="padding:6px; font-family:monospace; font-size:10px;">${it.sku || 'N/A'}</td>` : ''}
              <td style="padding:6px; text-align:center;">${it.cantidad}</td>
              <td style="padding:6px; font-weight:500;">${it.descripcion}</td>
              <td style="padding:6px; text-align:right;">$${parseFloat(it.precio).toFixed(2)}</td>
              <td style="padding:6px; text-align:right; font-weight:bold;">$${parseFloat(it.total).toFixed(2)}</td>
            </tr>
          `;
        });

        blocksHtml += `
          <table style="width:100%; border-collapse:collapse; margin:10px 0; font-size:${fontSizePx};">
            <thead>
              <tr style="background:#e2e8f0; border-bottom:1.5px solid #000; text-align:left;">
                ${isA4 ? `<th style="padding:6px;">SKU</th>` : ''}
                <th style="padding:6px; text-align:center;">Cant.</th>
                <th style="padding:6px;">Descripción de Producto / Servicio</th>
                <th style="padding:6px; text-align:right;">P. Unit ($)</th>
                <th style="padding:6px; text-align:right;">Venta Total ($)</th>
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
