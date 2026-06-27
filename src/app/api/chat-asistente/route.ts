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
`;

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
