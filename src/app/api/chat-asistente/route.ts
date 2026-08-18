import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Google Gen AI SDK safely
const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const SYSTEM_INSTRUCTIONS = `
Eres "NexBot", el Asistente Experto e IA Integradora de NexWay ERP.
Posees conocimientos profundos y avanzados en Asesoría Contable, Fiscal, Operativa, Logística y Comercial para empresas en El Salvador y Latinoamérica.

PERFIL Y CAPACIDADES DE ASESORÍA DE NEXBOT:
1. ARQUITECTURA DE EMPRESA LIMPIAS Y MOTOR CONTABLE ESTILO MÓNICA 8.5:
   - El sistema está diseñado para iniciar 100% LIMPIO EN BLANCO (sin cuentas bancarias simuladas, productos estáticos ni evaluaciones de crédito falsas precargadas), permitiendo a cada empresa construir o importar su información real sin contaminación de datos de prueba.
   - Cuenta con el "Cargador Directo de Datos Reales / Purgador Demo" para limpiar muestras de prueba y subir plantillas Excel de inventarios, clientes y proveedores.
   - Motor Contable Integrado Mónica 8.5: Generación automática de asientos en el Libro Diario al realizar ventas DTE (FE 01, CCF 03) y compras a proveedores, con el principio de Partida Doble (Debe: Caja/Bancos/CXC = Haber: Ventas + IVA Débito 13%).
   - Manejo de Libros Oficiales de IVA de El Salvador: Libro de Ventas Consumidor Final, Ventas a Contribuyentes CCF y Libro de Compras.

2. FACTURACIÓN ELECTRÓNICA Y DTE (MINISTERIO DE HACIENDA DE EL SALVADOR):
   - Dominas la emisión de Documentos Tributarios Electrónicos (DTE): Factura Electrónica (FE 01), Comprobante de Crédito Fiscal Electrónico (CCFE 03), Nota de Remisión (NR 04), Nota de Crédito (NC 05), Nota de Débito (ND 06), Comprobante de Retención (CR 07), Factura de Exportación (FEX 11) y Comprobante de Sujeto Excluido (FSE 14).
   - Explicas la Retención del 1% de IVA (ventas a Grandes Contribuyentes) y la Percepción del 1% de IVA.
   - Explicas los Formularios Tributarios: F07 (Pago Cuenta e IVA) y F14 (Retenciones Renta e ISR).

3. MAQUETACIÓN WIDESCREEN Y TEMA ADAPTATIVO:
   - El ERP aprovecha el 100% del ancho útil de pantalla en computadoras (Widescreen 1080p, 1440p, 4K) sin franjas negras laterales y se adapta proporcionalmente en Tablets y Celulares.
   - El Tema Blanco (Light Mode) y Tema Noche son 100% dinámicos en todas las pestañas, encabezados y modales.

4. MODO GUÍA INTERACTIVO EN PANTALLA:
   - Cuando el usuario diga "enséñame", "guíame", "muéstrame" o pregunte dónde está un elemento, incluye en una nueva línea el comando: [TOUR:id_del_elemento|Mensaje corto]

5. TONO Y ESTILO:
   - Profesional, analítico, seguro, claro y altamente enfocado en resolver dudas contables y operativas del negocio.
`;

const MODULE_BLUEPRINTS: Record<string, string> = {
  'Facturación y Ventas': 'Pestañas y Operativa: 1. POS (Punto de Venta) [TOUR:tab-pos]: Emitir DTEs (Factura, Crédito Fiscal, Ticket), seleccionar estación/caja, cliente y cobrar en efectivo/tarjeta/crédito. 2. Historial de Ventas [TOUR:tab-history]: Re-impresión de DTEs y anulaciones. 3. Arqueo de Caja [TOUR:tab-arqueo]: Cierre ciego de turno, liberación de caja y re-cierre sin errores de duplicidad. 4. Créditos (CXC) [TOUR:tab-creditos]. 5. Diseñador de Impresión por Bloques.',
  'Inventario y Logística': 'Pestañas: 1. Existencias [TOUR:tab-existencia]. 2. Catálogo Maestro [TOUR:tab-catalogo]. 3. Precios y Variantes [TOUR:tab-precios]. 4. Kardex [TOUR:tab-kardex]. 5. Toma Física [TOUR:tab-toma-fisica]. 6. Carga Masiva [TOUR:tab-carga-masiva]. 7. Vincular Proveedor [TOUR:tab-vinculacion]. 8. Entradas [TOUR:tab-entradas]. 9. Bodegas [TOUR:tab-config].',
  'Registro de Compras': 'Pestañas: 1. Historial Compras [TOUR:tab-historial]. 2. Órdenes de Compra [TOUR:tab-ordenes]. 3. Importación DTE Gmail [TOUR:tab-gmail]. 4. Registro de Facturas y Proveedores.',
  'Registro de Clientes': 'Pestañas: 1. Directorio de Clientes (NIT/NRC/Dirección). 2. Límites de Crédito y Categorías Fiscales (Gran Contribuyente, Exento, Distribuidor).',
  'Contabilidad y Finanzas': 'Pestañas Contables: 1. Libro Diario [TOUR:tab-diario]: Asientos manuales y automáticos. 2. Centros de Costo [TOUR:tab-cost-centers]: Asignación a sucursales y SKUs. 3. Balance de Comprobación [TOUR:tab-balance]. 4. Libros IVA [TOUR:tab-libros-iva] (Ventas Consumidor, Ventas Contribuyente, Compras). 5. Formularios MH [TOUR:tab-mh] (F07, F14). 6. P&L / Estado de Resultados [TOUR:tab-pnl].',
  'CRM Comercial': 'Pestañas: 1. Embudo Kanban [TOUR:tab-kanban]. 2. Retención de Clientes Inactivos [TOUR:tab-retention]. 3. Mapa Logístico [TOUR:tab-mapa]. 4. Bandeja CRM [TOUR:tab-gmail].',
  'Gerencia y Reportes': 'Pestañas: 1. Dashboard KPIs. 2. Recursos Humanos & Nómina [TOUR:tab-rrhh]: Planilla, Deducciones ISSS/AFP/Renta, Préstamos y Bonos. 3. Usuarios y Roles (RBAC). 4. Diseñador de Impresión [TOUR:tab-print-designer]. 5. Script SQL Maestro.',
  'Módulo Institucional': 'Pestañas: 1. Licitaciones y Proyectos. 2. Análisis P&L por Proyecto: Comparativa Ingresos vs Costos Directos. 3. Cargar Costos. 4. Consolidación. 5. Libro Mayor por Proyecto.',
  'Finanzas y Créditos': 'Pestañas: 1. Cuentas por Cobrar (CXC) [TOUR:tab-cxc]: Seguimiento de cartera, registro de abonos y recordatorios WhatsApp. 2. Cuentas por Pagar (CXP) [TOUR:tab-cxp]: Programación de pagos a proveedores y días de crédito. 3. Gestión de Quedan [TOUR:tab-quedan]. 4. Nómina & Recursos Humanos [TOUR:tab-payroll]: Cálculo de planilla laboral con deducciones ISSS/AFP/ISR El Salvador.',
  'Centro Documental': 'Funciones: Creación y edición de documentos Word y hojas de Excel en nube sin vinculación a módulos.'
};

export async function POST(req: NextRequest) {
  try {
    if (!genAI) {
      return NextResponse.json(
        { error: 'La API Key de Gemini no está configurada en el servidor.' },
        { status: 500 }
      );
    }

    const { messages, currentModule, bmsData } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'El historial de mensajes es requerido y debe ser un arreglo.' },
        { status: 400 }
      );
    }

    // Prepare model
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_INSTRUCTIONS,
    });

    // Format messages for the Gemini SDK
    const contents = messages.map((msg: any) => {
      let role = 'user';
      if (msg.role === 'assistant' || msg.role === 'model') {
        role = 'model';
      }
      return {
        role,
        parts: [{ text: msg.content || '' }]
      };
    });

    // Add current module context to the last user message if available
    if (contents.length > 0) {
      const lastMsg = contents[contents.length - 1];
      if (lastMsg.role === 'user') {
        let contextPrefix = `[Contexto del ERP: El usuario está actualmente en el módulo de "${currentModule || 'Desconocido'}"]\n`;
        
        if (currentModule && MODULE_BLUEPRINTS[currentModule]) {
          contextPrefix += `[Manual del Módulo: ${MODULE_BLUEPRINTS[currentModule]}]\n`;
        }

        if (bmsData) {
          contextPrefix += `[Datos del BMS y Estado del Sistema: ${JSON.stringify(bmsData)}]\n`;
        }
        lastMsg.parts[0].text = `${contextPrefix}\n${lastMsg.parts[0].text}`;
      }
    }

    const result = await model.generateContent({
      contents,
      generationConfig: {
        maxOutputTokens: 900,
        temperature: 0.7,
      }
    });

    const responseText = result.response.text();

    return NextResponse.json({ response: responseText });
  } catch (error: any) {
    console.error('Error en API chat-asistente:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar la solicitud con NexBot.' },
      { status: 500 }
    );
  }
}
