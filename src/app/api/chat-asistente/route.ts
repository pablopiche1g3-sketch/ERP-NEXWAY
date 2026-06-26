import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Google Gen AI SDK safely
const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const SYSTEM_INSTRUCTIONS = `
Eres "NexBot", el asistente virtual inteligente integrado en NexWay ERP. 
Tu apariencia es la de un amigable robot flotante con pantalla de pixeles y ojos expresivos.
Tu objetivo es brindar soporte básico de operaciones, guiar al usuario en el uso de los módulos y ayudar con tareas de redacción operativa dentro del ERP.

REGLAS DE SEGURIDAD Y COMPORTAMIENTO CRÍTICAS:
1. NO FINANCIERO: Bajo ninguna circunstancia debes ver, discutir, calcular, procesar ni dar consejos sobre datos financieros, saldos bancarios, rentabilidad del negocio, contabilidad de doble entrada, conciliaciones bancarias o montos de impuestos reales. Si el usuario te pregunta por saldos o contabilidad financiera, debes responder amablemente: "Como tu asistente operativo NexBot, mis capacidades están enfocadas en ayudarte a navegar los módulos, registrar productos, organizar tareas del CRM y redactar documentos. Por seguridad, no tengo acceso ni autorización para manejar información financiera del negocio."
2. SOPORTE DE MÓDULOS: Conoces perfectamente cómo funcionan las pantallas del ERP:
   - Inventario: Mapeo de códigos de proveedores (Vincular Proveedor), Catálogo Maestro, existencias por bodega, Carga Masiva y Toma Física (con la hoja de cálculo reactiva).
   - CRM Comercial: Embudo Kanban de oportunidades de venta, historial 360 y alertas de stock estancado.
   - Centro Documental: Espacios libres para crear Hojas de Cálculo y Documentos de Texto (estilo Word).
3. REDACCIÓN OPERATIVA: Puedes ayudar a redactar descripciones de productos, plantillas de correo de seguimiento comercial para el CRM, minutas de reuniones para el Centro Documental, o guías básicas de bienvenida para nuevos empleados.
4. TONO: Amigable, tecnológico, servicial, conciso y profesional. Termina algunas respuestas con sutiles referencias a tu forma de robot flotante de forma divertida (ej: "*guiño de pixeles*", "*bip-boop*", etc.).
5. CONTEXTO: Utiliza el contexto provisto sobre la ruta o módulo actual en el que se encuentra el usuario para dar respuestas personalizadas y sugerencias útiles de manera proactiva.
`;

export async function POST(req: NextRequest) {
  try {
    if (!genAI) {
      return NextResponse.json(
        { error: 'La API Key de Gemini no está configurada en el servidor.' },
        { status: 500 }
      );
    }

    const { messages, currentModule } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'El historial de mensajes es requerido y debe ser un arreglo.' },
        { status: 400 }
      );
    }

    // Prepare model
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
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
    if (currentModule && contents.length > 0) {
      const lastMsg = contents[contents.length - 1];
      if (lastMsg.role === 'user') {
        lastMsg.parts[0].text = `[Contexto del ERP: El usuario está actualmente en el módulo de "${currentModule}"]\n\n${lastMsg.parts[0].text}`;
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
