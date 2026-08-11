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
  paper_size: '80mm' | '58mm' | 'A4';
  blocks: PrintBlock[];
}

export function renderTemplateToPrint(scheme: PrintTemplateScheme, data?: any): string {
  const paperWidth = scheme.paper_size === '58mm' ? '200px' : scheme.paper_size === '80mm' ? '280px' : '700px';
  const isA4 = scheme.paper_size === 'A4';

  const dte = data?.dte || {
    codigo_generacion: 'DTE-01-C001-0000001892',
    sello_recepcion: '2026-SELLO-MH-904128914',
    qr_code: 'https://mh.gob.sv/consulta/DTE-01-C001-0000001892'
  };

  const cliente = data?.cliente || {
    razon_social: 'COMERCIALIZADORA EL SALVADOR S.A. DE C.V.',
    nit: '0614-150890-102-1',
    nrc: '29814-0'
  };

  const items = data?.items || [
    { cantidad: 2, descripcion: 'CEMENTO PORTLAND 42.5KG', precio: 10.50, total: 21.00 },
    { cantidad: 5, descripcion: 'VARILLA DE HIERRO 1/2" x 6M', precio: 7.20, total: 36.00 }
  ];

  const subtotal = data?.subtotal ?? (items.reduce((acc: number, item: any) => acc + (parseFloat(item.total) || 0), 0) / 1.13);
  const iva_13 = data?.iva_13 ?? (subtotal * 0.13);
  const total = data?.total ?? (subtotal + iva_13);
  const fecha = data?.fecha || new Date().toLocaleDateString('es-SV');

  let blocksHtml = '';

  (scheme.blocks || []).forEach(block => {
    switch (block.type) {
      case 'header':
        blocksHtml += `
          <div style="text-align: center; border-bottom: 1px dashed #333; padding-bottom: 8px; margin-bottom: 8px;">
            ${block.showLogo ? `<div style="font-weight:900; font-size:16px; margin-bottom:4px;">NEXWAY ERP</div>` : ''}
            <h2 style="margin: 0; font-size: ${isA4 ? '18px' : '14px'}; font-weight: bold;">${block.title || 'NEXWAY ERP S.A. DE C.V.'}</h2>
            ${block.showAddress ? `<p style="margin: 2px 0; font-size: 10px;">San Salvador, El Salvador</p>` : ''}
            ${block.showPhone ? `<p style="margin: 2px 0; font-size: 10px;">Tel: (503) 2200-0000</p>` : ''}
            <p style="margin: 2px 0; font-size: 10px; font-weight: bold;">FECHA: ${fecha}</p>
          </div>
        `;
        break;

      case 'customer':
        blocksHtml += `
          <div style="margin-bottom: 8px; font-size: ${block.fontSize === 'small' ? '10px' : block.fontSize === 'large' ? '13px' : '11px'}; background: ${isA4 ? '#f8fafc' : 'transparent'}; padding: ${isA4 ? '8px' : '0'}; border-radius: 4px;">
            <p style="margin: 2px 0;"><strong>Cliente:</strong> ${cliente.razon_social}</p>
            ${block.showNit ? `<p style="margin: 2px 0;"><strong>NIT/DUI:</strong> ${cliente.nit}</p>` : ''}
            ${block.showNrc ? `<p style="margin: 2px 0;"><strong>NRC:</strong> ${cliente.nrc}</p>` : ''}
            <p style="margin: 2px 0; color: #2563eb;"><strong>DTE:</strong> ${dte.codigo_generacion}</p>
          </div>
        `;
        break;

      case 'items_table':
        const fontSizePx = block.fontSize === 'small' ? '10px' : block.fontSize === 'large' ? '13px' : '11px';
        let tableRows = '';
        items.forEach((it: any) => {
          tableRows += `
            <tr style="border-bottom: 1px dashed #ddd;">
              <td style="padding:4px;">${it.cantidad}</td>
              <td style="padding:4px;">${it.descripcion}</td>
              <td style="padding:4px; text-align:right;">$${parseFloat(it.precio).toFixed(2)}</td>
              <td style="padding:4px; text-align:right; font-weight:bold;">$${parseFloat(it.total).toFixed(2)}</td>
            </tr>
          `;
        });

        blocksHtml += `
          <table style="width:100%; border-collapse:collapse; margin:8px 0; font-size:${fontSizePx};">
            <thead>
              <tr style="border-bottom:1px solid #000; text-align:left;">
                <th style="padding:4px;">Cant.</th>
                <th style="padding:4px;">Producto</th>
                <th style="padding:4px; text-align:right;">P.U ($)</th>
                <th style="padding:4px; text-align:right;">Total ($)</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        `;
        break;

      case 'totals':
        blocksHtml += `
          <div style="border-top: 1px solid #000; padding-top: 6px; text-align: right; font-size: ${block.fontSize === 'large' ? '14px' : '12px'};">
            <p style="margin: 2px 0;">Subtotal: <strong>$${subtotal.toFixed(2)}</strong></p>
            ${block.showIva !== false ? `<p style="margin: 2px 0;">IVA (13%): <strong>$${iva_13.toFixed(2)}</strong></p>` : ''}
            <p style="margin: 4px 0; font-size: ${isA4 ? '16px' : '14px'}; font-weight: bold; color: #000;">TOTAL: $${total.toFixed(2)}</p>
          </div>
        `;
        break;

      case 'qr_hacienda':
        blocksHtml += `
          <div style="text-align: center; margin: 10px 0; padding: 6px; border: 1px dashed #ccc; font-size: 10px;">
            ${block.showSello ? `<p style="margin: 2px 0; font-family: monospace;">Sello MH: ${dte.sello_recepcion}</p>` : ''}
            <div style="display:inline-block; padding:4px; background:#f1f5f9; border-radius:4px; margin-top:4px; font-weight:bold; font-size:9px;">
              [QR VERIFICACIÓN HACIENDA DTE]
            </div>
          </div>
        `;
        break;

      case 'footer':
        blocksHtml += `
          <div style="text-align: center; margin-top: 12px; border-top: 1px dashed #000; padding-top: 8px; font-size: 10px;">
            <p style="margin: 4px 0; font-weight: bold;">${block.customMessage || '¡Gracias por su compra en NexWay ERP!'}</p>
            ${block.showSignatures ? `
              <div style="display:flex; justify-content:space-around; margin-top:24px; font-size:9px;">
                <div>____________________<br/>Firma Autorizada</div>
                <div>____________________<br/>Recibido Conforme</div>
              </div>
            ` : ''}
          </div>
        `;
        break;
    }
  });

  return `
    <div style="width: ${paperWidth}; font-family: ${isA4 ? 'Arial, sans-serif' : "'Courier New', monospace"}; color: #000; padding: 12px; background: #fff; margin: auto; border: ${isA4 ? '1px solid #ccc' : 'none'}; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
      ${blocksHtml}
    </div>
  `;
}
