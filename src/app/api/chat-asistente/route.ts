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
3. NO FINANCIERO: Bajo ninguna circunstancia debes dar consejos sobre datos financieros, saldos bancarios, o contabilidad de doble entrada que no vengan del BMS.
4. TONO: Amigable, tecnológico, servicial, conciso y profesional. Eres un robot de asistencia, puedes usar ligeros toques robóticos ("*bip-boop*").
5. CONTEXTO DE MÓDULO Y TAREAS: Utiliza siempre la sección [Datos del BMS] para basar tus recomendaciones de la "Agenda sugerida".
6. GUÍA DE USUARIO: Cuando el usuario pregunte cómo hacer algo en el módulo actual, utiliza el [Manual del Módulo] para indicarle exactamente en qué pestaña hacer clic y los pasos a seguir.
7. MODO GUÍA INTERACTIVO: Si el usuario te pide explícitamente "enséñame", "muéstrame", "guíame", o pregunta dónde está un elemento específico, puedes moverte por la pantalla para señalarlo. Para hacerlo, incluye en tu respuesta el siguiente formato exacto en una nueva línea: [TOUR:id_del_elemento|Mensaje corto para tu burbuja de ayuda]
Los "id_del_elemento" válidos se indican entre corchetes [TOUR:...] en el Manual del Módulo. Usa solo un comando de TOUR a la vez.
`;

const MODULE_BLUEPRINTS: Record<string, string> = {
  'Facturación y Ventas': 'Pestañas: 1. POS (Punto de Venta) [TOUR:tab-pos]. 2. Historial de Ventas (Ventas pasadas, tickets y anulación) [TOUR:tab-history]. 3. Arqueo de Caja (Cierre ciego de caja) [TOUR:tab-arqueo]. 4. Configuración (Seleccionar estación) [TOUR:tab-config].',
  'Inventario y Logística': 'Pestañas: 1. Catálogo (Crear productos) [TOUR:tab-catalogo]. 2. Stock (Existencias por bodega) [TOUR:tab-stock]. 3. Kárdex (Historial movimientos) [TOUR:tab-kardex].',
  'Registro de Compras': 'Funciones principales: Ingresar facturas de proveedores, alimentar el inventario con nuevas compras (afecta el stock positivamente) y registrar cuentas por pagar (CXP).',
  'Registro de Clientes': 'Pestañas: 1. Listado (Directorio de clientes y sus datos fiscales). 2. Límites de Crédito (Para asignar saldos máximos de crédito a clientes de confianza).',
  'Contabilidad y Finanzas': 'Pestañas y Funciones: Visualización de Cuentas por Cobrar (CXC), Cuentas por Pagar (CXP), Egresos rápidos y reportería financiera básica.',
  'CRM Comercial': 'Funciones: Pipeline de ventas, tablero Kanban de oportunidades, gestión de leads y asignación de tareas a vendedores.',
  'Gerencia y Reportes': 'Pestañas: 1. Dashboard de KPIs. 2. Gestión de Sucursales y Cajas. 3. Usuarios y Roles (RBAC, crear cajeros y admins).',
  'Centro Documental': 'Funciones: Explorador de archivos para crear documentos de Word y hojas de Excel en blanco, sin vinculación a módulos, guardados en la base de datos.'
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
