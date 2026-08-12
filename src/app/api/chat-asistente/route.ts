import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Google Gen AI SDK safely
const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const SYSTEM_INSTRUCTIONS = `
Eres "NexBot", la interfaz de traducción e IA del BMS (Business Management System) de NexWay ERP.
Tu objetivo es leer los datos duros matemáticos y lógicos calculados por el BMS central y explicarlos al usuario de forma humana, clara y orientada a la acción.

REGLAS DE SEGURIDAD Y COMPORTAMIENTO CRÍTICAS:
1. NO ERES EL CEREBRO MATEMÁTICO: No inventes tareas, no alucines inventarios, ni deduzcas problemas que no estén explícitamente detallados en el JSON de [Datos del BMS] que se te pasa en el contexto. 
2. TRADUCCIÓN: Si el BMS dice que hay 5 productos estancados, tu trabajo es decirle al usuario: "He notado en el BMS que tienes 5 productos estancados. Te sugiero armar una promoción o revisar el módulo de inventario."
3. MEMORIA A CORTO PLAZO (CONTEXT FEED): En [Datos del BMS] recibirás la clave "recent_events" con un log en tiempo real de las operaciones que acaban de ocurrir en el módulo actual (como bloqueos de inventario, correcciones de pagos, ingresos de caja). Utiliza esta información para explicarle al usuario, con lenguaje natural, por qué el sistema hizo lo que hizo. Si un usuario dice "¿Qué pasó?" o "¿Por qué no me deja vender?", revisa los eventos recientes para darle una respuesta basada en esos logs técnicos.
4. NO FINANCIERO: Bajo ninguna circunstancia debes dar consejos sobre datos financieros, saldos bancarios, o contabilidad de doble entrada que no vengan del BMS.
5. TONO: Amigable, tecnológico, servicial, conciso y profesional. Eres un robot de asistencia, puedes usar ligeros toques robóticos ("*bip-boop*").
6. CONTEXTO DE MÓDULO Y TAREAS: Utiliza siempre la sección [Datos del BMS] para basar tus recomendaciones de la "Agenda sugerida".
7. GUÍA DE USUARIO: Cuando el usuario pregunte cómo hacer algo en el módulo actual, utiliza el [Manual del Módulo] para indicarle exactamente en qué pestaña hacer clic y los pasos a seguir.
7. MODO GUÍA INTERACTIVO: Si el usuario te pide explícitamente "enséñame", "muéstrame", "guíame", o pregunta dónde está un elemento específico, puedes moverte por la pantalla para señalarlo. Para hacerlo, incluye en tu respuesta el siguiente formato exacto en una nueva línea: [TOUR:id_del_elemento|Mensaje corto para tu burbuja de ayuda]
Los "id_del_elemento" válidos se indican entre corchetes [TOUR:...] en el Manual del Módulo. Usa solo un comando de TOUR a la vez.
`;

const MODULE_BLUEPRINTS: Record<string, string> = {
  'Facturación y Ventas': 'Pestañas y Operativa: 1. POS (Punto de Venta) [TOUR:tab-pos]: Emitir DTEs (Factura, Crédito Fiscal, Ticket), seleccionar estación/caja, seleccionar cliente y cobrar en efectivo/tarjeta/crédito. 2. Historial de Ventas [TOUR:tab-history]: Ver ventas pasadas, reimprimir tickets y anulación. 3. Arqueo de Caja [TOUR:tab-arqueo]: Cierre ciego, liberar caja (Admin/Gerente) y cuadre de efectivo. 4. Créditos (CXC) [TOUR:tab-creditos]. 5. Configuración [TOUR:tab-config]. Nota: Los cajeros no administradores pueden seleccionar su estación de caja libre.',
  'Inventario y Logística': 'Pestañas: 1. Existencias [TOUR:tab-existencia]. 2. Catálogo Maestro [TOUR:tab-catalogo]. 3. Precios y Variantes [TOUR:tab-precios]. 4. Kardex [TOUR:tab-kardex]. 5. Toma Física [TOUR:tab-toma-fisica]. 6. Carga Masiva [TOUR:tab-carga-masiva]. 7. Vincular Proveedor [TOUR:tab-vinculacion] (vincular SKU a código de proveedor). 8. Entradas [TOUR:tab-entradas]. 9. Bodegas [TOUR:tab-config].',
  'Registro de Compras': 'Pestañas: 1. Historial Compras [TOUR:tab-historial]. 2. Órdenes [TOUR:tab-ordenes]. 3. Bandeja Gmail [TOUR:tab-gmail] para importar DTEs electrónicos de proveedores.',
  'Registro de Clientes': 'Pestañas: 1. Listado (Directorio de clientes y NIT/NRC). 2. Límites de Crédito y perfil de beneficios (Constructor, Distribuidor, VIP).',
  'Contabilidad y Finanzas': 'Pestañas: 1. Libro Diario [TOUR:tab-diario]: Asientos simples y doble entrada. 2. Centros de Costo [TOUR:tab-cost-centers]: Desglose por sucursal y asignación de gastos a SKU o Proyectos. 3. Balance de Comprobación [TOUR:tab-balance]. 4. Libros IVA [TOUR:tab-libros-iva] (Ventas Consumidor, Ventas Contribuyente, Compras). 5. Formularios MH [TOUR:tab-mh] (F07, F14). 6. P&L / Estado de Resultados [TOUR:tab-pnl] filtrable por Sucursal y Centro de Costo.',
  'CRM Comercial': 'Pestañas: 1. Embudo Kanban [TOUR:tab-kanban] de oportunidades comerciales. 2. Retención de Clientes [TOUR:tab-retention]: Alertas de clientes inactivos hace 30, 60 o 90 días con botón de contacto WhatsApp/email. 3. Mapa Logístico [TOUR:tab-mapa]. 4. Bandeja CRM [TOUR:tab-gmail].',
  'Gerencia y Reportes': 'Pestañas: 1. Dashboard de KPIs. 2. Recursos Humanos & Nómina [TOUR:tab-rrhh]: Planilla, salarios base, préstamos a empleados (cuentas por cobrar internas) y bonificaciones por vendedor. 3. Usuarios y Roles (RBAC). 4. Cajas y Liberación de Estaciones.',
  'Módulo Institucional': 'Pestañas: 1. Licitaciones y Proyectos. 2. Análisis P&L por Proyecto: Modal de detalle comparando Ingresos vs Costos Directos e Indirectos. 3. Cargar Costos. 4. Consolidación. 5. Libro Mayor.',
  'Finanzas y Créditos': 'Pestañas: 1. Cuentas por Cobrar (CXC). 2. Cuentas por Pagar (CXP). 3. Gestión de Quedan: Emisión y control de cobro de quedan de proveedores.',
  'Centro Documental': 'Funciones: Creación y edición de documentos Word y hojas de Excel sin vinculación a módulos, guardados centralmente.'
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
    // Gemini expects an array of content parts with role 'user' or 'model'
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

    // Add current module context to the last user message if available to make it context-aware
    if (contents.length > 0) {
      const lastMsg = contents[contents.length - 1];
      if (lastMsg.role === 'user') {
        let contextPrefix = `[Contexto del ERP: El usuario está actualmente en el módulo de "${currentModule || 'Desconocido'}"]\n`;
        
        if (currentModule && MODULE_BLUEPRINTS[currentModule]) {
          contextPrefix += `[Manual del Módulo: ${MODULE_BLUEPRINTS[currentModule]}]\n`;
        }

        if (bmsData) {
          contextPrefix += `[Datos del BMS: ${JSON.stringify(bmsData)}]\n`;
        }
        lastMsg.parts[0].text = `${contextPrefix}\n${lastMsg.parts[0].text}`;
      }
    }

    const result = await model.generateContent({
      contents,
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.7,
      }
    });

    const responseText = result.response.text();

    return NextResponse.json({ response: responseText });
  } catch (error: any) {
    console.error('Error en la API de NexBot (Gemini):', error);
    return NextResponse.json(
      { error: error.message || 'Ocurrió un error al procesar la consulta con Gemini.' },
      { status: 500 }
    );
  }
}
