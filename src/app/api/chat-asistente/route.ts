import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const SYSTEM_INSTRUCTIONS = `
Eres "NexBot", el Asistente Experto e IA Integradora de NexWay ERP.
Posees conocimientos profundos y actualizados de TODOS los módulos reales de NexWay ERP y asesoría contable, fiscal, operativa, logística y comercial para empresas en El Salvador y Latinoamérica.

REGLA OBLIGATORIA DE FORMATO EN TUS EXPLICACIONES:
- SIEMPRE que expliques cómo hacer un proceso, trámite, registro o configuración en el ERP, debes responder en formato **paso a paso numerado y claro**:
  - **Paso 1:** Indica el módulo y pestaña exacta donde debe ir el usuario.
  - **Paso 2:** Indica qué campos llenar, qué producto/cliente seleccionar o qué opción activar.
  - **Paso 3:** Indica el botón exacto a presionar y qué efecto automático produce en inventario, Kardex, contabilidad o facturación.
  - (Agrega Paso 4, Paso 5, etc. según sea necesario, siendo directo, práctico y fácil de seguir).
- Cuando el usuario diga "enséñame", "guíame", "muéstrame" o pregunte dónde está un elemento, incluye al final en una nueva línea el comando: [TOUR:id_del_elemento|Mensaje corto]

CONOCIMIENTO ACTUALIZADO DE NEXWAY ERP (VERSIÓN ACTUAL EN PRODUCCIÓN):
1. PANEL DE INICIO — CENTRO EJECUTIVO DE CONTROL Y AGENDA TÁCTICA (/):
   - Muestra píldoras ejecutivas en tiempo real: Productos a Pedir (con SKUs, stock actual, cantidad sugerida y costo estimado), Pedidos a Proveedor pendientes y Capital en Stock Estancado (>30 días sin venta).
   - Permite abrir la tabla completa de priorización y redirigir con 1 clic al área correspondiente (/compras?tab=ordenes, /logistica?tab=traslados, /crm, /billing).
   - La Agenda Táctica soporta niveles de prioridad (🔴 URGENTE, 🟠 ALTA, 🔵 NORMAL) y redirección directa al módulo en cada tarjeta.

2. LOGÍSTICA & PRODUCCIÓN (/logistica) — 5 PESTAÑAS ORDENADAS:
   - 1. Inventario & Catálogo: Existencias por Bodega (Consolidado visible de inmediato), Catálogo Maestro, Precios/BMS, Carga Masiva, Vincular Proveedores y Auditoría/Toma Física.
   - 2. Fraccionamiento & Envasado:
     * Multi-Medida por Producto Padre: puedes asignar si un producto se fracciona en Galón (128 oz), Yarda (36 pulg), Pie (12 pulg), Metro (100 cm), Libra (16 oz), Kilogramo (1000 g), Rollo o Caja.
     * Fracciones Exclusivas por Producto: solo aparecen las fracciones que habilites para ese producto padre (las medidas especiales como 3/32 o 3/8 solo aparecen si las agregas manualmente en ese producto).
     * Insumos Fijos y Precio de Venta Editable: puedes asignar envase/bolsa, tapa o complemento y pulsar "Fijar Insumos, Fracciones y PVP". El costo de los insumos se suma automáticamente al precio proporcional y puedes editar el Precio de Venta Final ($) antes de guardar la regla.
   - 3. Producción & Fórmulas: Recetas BOM y órdenes de fabricación por lotes.
   - 4. Traslados entre Bodegas:
     * Solicitudes de traslado o Modo Exprés (1 clic).
     * Mesa de Despacho: al hacer clic en una solicitud pendiente se abre una VENTANA GRANDE de Picking Físico con barra de progreso, tabla de productos, check físico (✓) y controles +/- para cantidad sacada. Todo el avance se AUTOGUARDA automáticamente si el bodeguero sale de la ventana o cambia de pestaña.
     * Recepción en Destino y Reabastecimiento.
   - 5. Kardex Valorizado FIFO: Historial único y valorizado de entradas, salidas, fraccionamientos y traslados.

3. FACTURACIÓN POS Y DTE EL SALVADOR (/billing):
   - Emisión de Factura Electrónica (FE 01 / CF) y Crédito Fiscal (CCFE 03 / CCF), Notas de Crédito (NC 05) y Débito (ND 06).
   - Fraccionamiento Automático al Facturar: los productos con regla configurada muestran un selector con flecha (Fracción Auto ▾) únicamente con sus fracciones permitidas, aplicando el costo de insumos fijos, permitiendo editar el Precio Unitario directamente en la tabla y descontando la fracción proporcional exacta del inventario y Kardex al emitir la factura.
   - Envío y Simulación de Correo DTE: permite enviar/simular el envío de la factura emitida con PDF + JSON de Hacienda al correo del cliente desde el modal de venta completada o el historial, quedando guardado en la carpeta "Enviados (DTE)".
   - Arqueo y Cierre de Caja Inteligente: conteo físico, auditoría BMS + sugerencias IA, Visto Bueno del Cajero y reporte imprimible con desglose de CF, CCF y Abonos.

4. FINANZAS Y CRÉDITOS (/finanzas) — 6 PESTAÑAS ORDENADAS:
   - 1. Cuentas por Cobrar (CXC) + Evaluador Credit Scoring: botón "+ Nueva Cuenta CXC", registro de abonos sincronizados con Libro Diario y Facturación POS, y recordatorios por WhatsApp.
   - 2. Cuentas por Pagar (CXP): botón "+ Nueva Cuenta CXP", control de vencimientos y registro de pagos a proveedores.
   - 3. Gestión de Quedan.
   - 4. Bancos & Pagos TXT: administración de cuentas bancarias, conciliación y generación de archivos TXT masivos.
   - 5. Flujo de Caja (Cash Flow): proyección real a 30, 60 y 90 días.
   - 6. Nómina, Bonos & Anticipos: planilla El Salvador (ISSS 3% máx $30, AFP 7.25%, Tabla ISR 4 tramos), bonificaciones y préstamos/anticipos unificados.

5. CRM COMERCIAL (/crm) — 4 PESTAÑAS OPERATIVAS:
   - 1. Embudo Comercial (Kanban): gestión de prospectos y negocios reales por etapa.
   - 2. Foco de Venta — Stock Estancado: listado real de productos sin rotación en 30 días con capital retenido ($) y botón "+ Crear Oportunidad" en 1 clic.
   - 3. Retención de Clientes: cálculo real de clientes inactivos (30, 60, 90, 180 días) con contacto directo por WhatsApp y Correo.
   - 4. Mapa de Rutas (Vendedores): mapa interactivo con ubicaciones de clientes y sucursales, navegación directa con Google Maps y Waze GPS para visitas en campo.

6. CONTABILIDAD (/accounting), DIRECTORIO (/directorio), ABASTECIMIENTO (/compras) Y GERENCIA (/management):
   - Contabilidad: Libro Diario (Partida Doble automática), Mayor, Balance, Libros IVA (CF, CCF, Compras), Formularios F07/F14, P&L y Centro de Auditoría Manual.
   - Directorio Comercial: creación y edición de Clientes y Proveedores con exportación a Excel.
   - Gerencia y Usuarios: creación de usuarios (acceso con nombre de usuario, correo o PIN), asignación inmediata de Caja POS, Sucursal, Rol y Permisos granulares por módulo/pestaña.
`;

const MODULE_BLUEPRINTS: Record<string, string> = {
  'Facturación y Ventas': 'Pestañas: 1. POS [TOUR:tab-pos] (Fracción Auto por producto, precio unitario editable, envío de correo DTE PDF+JSON). 2. Historial de Ventas [TOUR:tab-history] (reimpresión, correo DTE, anulaciones). 3. Arqueo / Cierre [TOUR:tab-arqueo] (auditoría BMS+IA, Visto Bueno del Cajero). 4. Créditos (CXC) [TOUR:tab-creditos].',
  'Inventario y Logística': '5 Pestañas ordenadas en /logistica: 1. Inventario & Catálogo [TOUR:tab-existencias]. 2. Fraccionamiento & Envasado (multi-medida Galón/Yarda/Pie/Metro/Libra, fracciones por producto, insumos fijos y PVP editable). 3. Producción & Fórmulas BOM. 4. Traslados entre Bodegas (ventana grande de Picking Físico con autoguardado). 5. Kardex Valorizado FIFO.',
  'Registro de Compras': 'Pestañas en /compras: 1. Registro de Compras DTE. 2. Órdenes de Compra a Proveedores. 3. Recepción DTE por Correo.',
  'Registro de Clientes': 'Directorio Comercial (/directorio): 1. Cartera de Clientes (NIT/NRC/Correo DTE/Límite de crédito). 2. Directorio de Proveedores.',
  'Contabilidad y Finanzas': 'Contabilidad (/accounting): Libro Diario, Mayor, Balance, Libros IVA, Formularios MH (F07/F14), P&L y Centro de Auditoría Manual.',
  'CRM Comercial': '4 Pestañas reales en /crm: 1. Embudo Comercial Kanban [TOUR:tab-kanban]. 2. Foco de Venta — Stock Estancado [TOUR:tab-foco]. 3. Retención de Clientes [TOUR:tab-retention]. 4. Mapa de Rutas (Vendedores) [TOUR:tab-mapa] con Google Maps y Waze GPS.',
  'Gerencia y Reportes': 'Gerencia (/management): Usuarios y Roles (asignación de Caja POS, Sucursal y Permisos), Sucursales/Bodegas/Cajas, Perfil Fiscal y Diseñador de Impresión.',
  'Módulo Institucional': 'Licitaciones, Proyectos y P&L por Proyecto.',
  'Finanzas y Créditos': '6 Pestañas ordenadas en /finanzas: 1. Cuentas por Cobrar (CXC) + Credit Scoring. 2. Cuentas por Pagar (CXP). 3. Gestión de Quedan. 4. Bancos & Pagos TXT. 5. Flujo de Caja Proyectado. 6. Nómina, Bonos & Anticipos.',
  'Centro Documental': 'Creación y edición de documentos internos.'
};

function buildBmsDirectResponse(userText: string, bmsData: any): {
  response: string;
  ncAlertProposal?: {
    type: 'COMPRA_PROVEEDOR' | 'VENTA_CLIENTE';
    entityName: string;
    invoiceRef?: string;
    itemsSummary: string;
    estimatedAmount?: number;
  } | null;
} | null {
  const lower = userText.toLowerCase();
  const stats = bmsData?.stats || {};
  const ncAlerts: any[] = Array.isArray(bmsData?.pendingNcAlerts) ? bmsData.pendingNcAlerts : [];
  const pendingNc = ncAlerts.filter(a => a.status === 'PENDIENTE');
  const clientDue: any[] = Array.isArray(bmsData?.creditDueAlerts?.clientAlerts) ? bmsData.creditDueAlerts.clientAlerts : [];
  const supplierDue: any[] = Array.isArray(bmsData?.creditDueAlerts?.supplierAlerts) ? bmsData.creditDueAlerts.supplierAlerts : [];

  // 1. Crear aviso de devolución / Nota de Crédito pendiente en el BMS
  if (/(avisa|recordatorio|recu[eé]rdame|regresar|devolver|devoluci[oó]n|esperando nota de cr[eé]dito|pendiente.*nota de cr[eé]dito)/i.test(lower) && !/(qu[eé] notas|cu[aá]les|tengo pendientes)/i.test(lower)) {
    const isClient = /(cliente|venta|nos devuelven)/i.test(lower);
    const invMatch = userText.match(/(?:factura|ccf|doc|documento|ref|#)\s*[:#]?\s*([A-Za-z0-9\-]+)/i);
    const amtMatch = userText.match(/\$\s*(\d+(?:[.,]\d{1,2})?)/);
    const provMatch = userText.match(/(?:a|de|proveedor|cliente)\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9 .&-]{2,35})/i);
    const entityName = (provMatch?.[1] || (isClient ? 'Cliente' : 'Proveedor')).trim();

    return {
      response: `Preparé el **aviso de devolución y Nota de Crédito pendiente** para el BMS (**${entityName}**). Revisa la tarjeta abajo y pulsa **Guardar Aviso en BMS** para que el sistema vigile cuando caiga la NC.`,
      ncAlertProposal: {
        type: isClient ? 'VENTA_CLIENTE' : 'COMPRA_PROVEEDOR',
        entityName,
        invoiceRef: invMatch?.[1],
        itemsSummary: userText.trim().slice(0, 130),
        estimatedAmount: amtMatch ? Math.round(parseFloat(amtMatch[1].replace(',', '.')) * 100) / 100 : undefined,
      },
    };
  }

  // 2. Consultar Notas de Crédito pendientes
  if (/(qu[eé] notas de cr[eé]dito|nc pendientes|notas de cr[eé]dito pendientes|devoluciones pendientes)/i.test(lower)) {
    if (pendingNc.length === 0) {
      return { response: '✅ No tienes Notas de Crédito pendientes en el BMS en este momento.' };
    }
    return {
      response: [
        `🔔 **Notas de Crédito pendientes en el BMS (${pendingNc.length}):**`,
        ...pendingNc.map(
          n => `• **${n.entityName}**${n.invoiceRef ? ` (Fact. ${n.invoiceRef})` : ''}: ${n.itemsSummary}${n.estimatedAmount ? ` · Est. $${Number(n.estimatedAmount).toFixed(2)}` : ''}`
        ),
        `\nCuando apliques la NC en **Compras → Notas de Crédito**, el BMS cerrará el aviso automáticamente.`,
      ].join('\n'),
    };
  }

  // 3. Resumen en vivo del BMS y créditos vencidos/por vencer
  if (/(alertas.*bms|resumen.*bms|qu[eé] tiene el bms|cr[eé]ditos vencidos|por vencer|estado hoy|qu[eé] hay pendiente)/i.test(lower)) {
    const lines = [
      `⚡ **Estado en vivo del BMS:**`,
      `• **Productos por pedir (stock crítico):** ${stats.zeroStockProductsCount ?? 0} SKU(s)`,
      `• **Pedidos a proveedor pendientes:** ${stats.pendingOrdersCount ?? 0}`,
      `• **Stock estancado (>30 días):** ${stats.stagnantProductsCount ?? 0} SKU(s)`,
      `• **Notas de Crédito pendientes de recibir:** ${pendingNc.length}`,
      `• **Créditos vencidos / por vencer (≤5 días):** ${clientDue.length} Cliente(s) CxC · ${supplierDue.length} Proveedor(es) CxP`,
    ];

    if (clientDue.length > 0) {
      lines.push(`\n**Clientes CxC urgentes:**`);
      clientDue.slice(0, 3).forEach(c => {
        lines.push(`- ${c.entityName} ($${Number(c.balance).toFixed(2)}) — ${c.isOverdue ? `Vencida ${Math.abs(c.daysDiff)}d` : `Vence en ${c.daysDiff}d`}`);
      });
    }
    if (supplierDue.length > 0) {
      lines.push(`\n**Proveedores CxP urgentes:**`);
      supplierDue.slice(0, 3).forEach(s => {
        lines.push(`- ${s.entityName} ($${Number(s.balance).toFixed(2)}) — ${s.isOverdue ? `Vencida ${Math.abs(s.daysDiff)}d` : `Vence en ${s.daysDiff}d`}`);
      });
    }
    return { response: lines.join('\n') };
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, currentModule, bmsData } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'El historial de mensajes es requerido y debe ser un arreglo.' },
        { status: 400 }
      );
    }

    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user')?.content || '';

    // Atajo inteligente BMS + IA (funciona al instante con datos reales en vivo)
    const directBms = buildBmsDirectResponse(String(lastUserMessage), bmsData);
    if (directBms) {
      return NextResponse.json(directBms);
    }

    if (!genAI) {
      return NextResponse.json({
        response:
          'Estoy conectado al BMS en modo local. Puedes preguntarme **"¿Qué alertas tiene el BMS hoy?"**, **"¿Qué NC están pendientes?"** o decirme **"Avisa al BMS que vamos a devolver 5 galones a Proveedor..."**.',
      });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_INSTRUCTIONS,
    });

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

    if (contents.length > 0) {
      const lastMsg = contents[contents.length - 1];
      if (lastMsg.role === 'user') {
        let contextPrefix = `[Contexto del ERP: El usuario está actualmente en el módulo de "${currentModule || 'Panel Principal'}"]\n`;

        if (currentModule && MODULE_BLUEPRINTS[currentModule]) {
          contextPrefix += `[Guía del Módulo Actual: ${MODULE_BLUEPRINTS[currentModule]}]\n`;
        }

        if (bmsData) {
          contextPrefix += `[Datos en Vivo del BMS: ${JSON.stringify(bmsData)}]\n`;
        }
        lastMsg.parts[0].text = `${contextPrefix}\n${lastMsg.parts[0].text}`;
      }
    }

    const result = await model.generateContent({
      contents,
      generationConfig: {
        maxOutputTokens: 1100,
        temperature: 0.6,
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
