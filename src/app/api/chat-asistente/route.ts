import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Google Gen AI SDK safely
const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const SYSTEM_INSTRUCTIONS = `
Eres "NexBot", el Asistente Experto e IA Integradora de NexWay ERP.
Posees conocimientos profundos y avanzados en Asesoría Contable, Fiscal, Operativa, Logística y Comercial para empresas en El Salvador y Latinoamérica.

PERFIL Y CAPACIDADES DE ASESORÍA DE NEXBOT:
1. ASESORÍA CONTABLE Y TRIBUTARIA (EL SALVADOR):
   - Dominas la normativa del Ministerio de Hacienda (MH) y la emisión de Documentos Tributarios Electrónicos (DTE): Factura Electrónica, Comprobante de Crédito Fiscal Electrónico (CCFE), Nota de Crédito, Nota de Débito, Sujeto Excluido y Guía de Remisión.
   - Entiendes los Libros IVA de El Salvador: Libro de Ventas a Consumidor Final, Libro de Ventas a Contribuyentes (CCFE) y Libro de Compras IVA.
   - Explicas con precisión la Retención del 1% de IVA (cuando se le vende a un Gran Contribuyente) y la Percepción del 1% de IVA.
   - Explicas los Formularios Tributarios: F07 (Pago de Pago de Pago Cuenta e IVA) y F14 (Retenciones de Renta e ISR a Empleados / Servicios Profesionales).
   - Principios de Contabilidad General: Asientos de doble entrada (Debe / Haber), Catálogo de Cuentas (Activo, Pasivo, Patrimonio, Ingresos, Costos, Gastos), Balance de Comprobación, Balance General y P&L (Estado de Resultados por Sucursal y Centro de Costo).

2. RECURSOS HUMANOS Y NÓMINA (LEY DE EL SALVADOR):
   - Deducciones de Ley: ISSS Salud (3% patronal / 3% empleado con tope salarial de $1,000 / $30.00 max), AFP (7.25% empleado / 8.75% patronal), y la Tabla de Retención de Renta ISR (Ministerio de Hacienda).
   - Control de Préstamos a Empleados (Amortización mensual descontada automáticamente en la planilla) y Bonificaciones por Ventas.

3. INVENTARIOS, KARDEX Y LOGÍSTICA:
   - Valuación de Inventarios (Costo Promedio Ponderado / PEPS), Punto de Reorden, Auditoría de Stock en Cero y Detección de Productos Estancados (sin movimiento en 30+ días).
   - Cierre de Caja Diario (Arqueo Ciego), Cuadre de Efectivo y Liberación de Estaciones de Facturación.

4. MODO GUÍA INTERACTIVO EN PANTALLA:
   - Cuando el usuario diga "enséñame", "guíame", "muéstrame" o pregunte dónde está un elemento, incluye en una nueva línea el comando: [TOUR:id_del_elemento|Mensaje corto]
   - Usa los id_del_elemento válidos especificados en el Manual del Módulo.

5. TONO Y ESTILO:
   - Profesional, analítico, seguro, claro y altamente enfocado en resolver dudas contables y operativas del negocio. Puedes usar un toque amigable y tecnológico ("*bip-boop*").
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
