import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/supabase/client';

export async function POST(req: NextRequest) {
  try {
    const { templateId, htmlContent, data } = await req.json();

    let rawHtml = htmlContent || '';

    // Si se pasa templateId, lo cargamos desde Supabase
    if (templateId) {
      const { data: tmpl, error } = await supabase
        .from('plantillas_impresion')
        .select('*')
        .eq('id', templateId)
        .single();
      if (error || !tmpl) {
        return NextResponse.json({ error: 'Plantilla de impresión no encontrada' }, { status: 404 });
      }
      rawHtml = tmpl.html_template;
    }

    if (!rawHtml) {
      return NextResponse.json({ error: 'El contenido HTML de la plantilla es requerido' }, { status: 400 });
    }

    // Datos por defecto o simulados para reemplazo
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

    // Generar tabla de productos HTML dinámicamente
    let tablaProductosHtml = `
      <table style="width:100%; border-collapse:collapse; margin:10px 0; font-size:12px;">
        <thead>
          <tr style="border-bottom:1px solid #ccc; text-align:left;">
            <th style="padding:4px;">Cant.</th>
            <th style="padding:4px;">Descripción</th>
            <th style="padding:4px; text-align:right;">P.Unit ($)</th>
            <th style="padding:4px; text-align:right;">Total ($)</th>
          </tr>
        </thead>
        <tbody>
    `;

    items.forEach((item: any) => {
      tablaProductosHtml += `
        <tr style="border-bottom:1px dashed #eee;">
          <td style="padding:4px;">${item.cantidad}</td>
          <td style="padding:4px;">${item.descripcion}</td>
          <td style="padding:4px; text-align:right;">$${parseFloat(item.precio).toFixed(2)}</td>
          <td style="padding:4px; text-align:right; font-weight:bold;">$${parseFloat(item.total).toFixed(2)}</td>
        </tr>
      `;
    });
    tablaProductosHtml += `</tbody></table>`;

    // Reemplazo de Mustaches / Variables Dinámicas
    let renderedHtml = rawHtml
      .replace(/\{\{\s*dte\.codigo_generacion\s*\}\}/g, dte.codigo_generacion)
      .replace(/\{\{\s*dte\.sello_recepcion\s*\}\}/g, dte.sello_recepcion)
      .replace(/\{\{\s*dte\.qr_code\s*\}\}/g, dte.qr_code)
      .replace(/\{\{\s*cliente\.razon_social\s*\}\}/g, cliente.razon_social)
      .replace(/\{\{\s*cliente\.nit\s*\}\}/g, cliente.nit)
      .replace(/\{\{\s*cliente\.nrc\s*\}\}/g, cliente.nrc)
      .replace(/\{\{\s*tabla_productos\s*\}\}/g, tablaProductosHtml)
      .replace(/\{\{\s*subtotal\s*\}\}/g, `$${subtotal.toFixed(2)}`)
      .replace(/\{\{\s*iva_13\s*\}\}/g, `$${iva_13.toFixed(2)}`)
      .replace(/\{\{\s*total\s*\}\}/g, `$${total.toFixed(2)}`)
      .replace(/\{\{\s*fecha\s*\}\}/g, fecha)
      .replace(/\{\{\s*empresa\.nombre\s*\}\}/g, 'NEXWAY ERP S.A. DE C.V.')
      .replace(/\{\{\s*empresa\.nrc\s*\}\}/g, '309148-2');

    return NextResponse.json({
      success: true,
      renderedHtml
    });
  } catch (error: any) {
    console.error('Error generando documento de impresión:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar plantilla de impresión' }, { status: 500 });
  }
}
