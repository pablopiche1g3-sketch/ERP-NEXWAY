
'use server';
/**
 * @fileOverview Flujo para envío de correos electrónicos con Documentos Tributarios Electrónicos (DTE).
 *
 * - sendDteEmail - Función principal para notificar al cliente sobre su factura.
 * - SendDteEmailInput - Esquema de entrada (Datos de la venta y destinatario).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SendDteEmailInputSchema = z.object({
  recipientEmail: z.string().email().describe('Correo electrónico del receptor del DTE.'),
  customerName: z.string().describe('Nombre del cliente.'),
  docType: z.string().describe('Tipo de documento (Factura, CCF, etc).'),
  docNumber: z.string().optional().describe('Número de documento o código de generación.'),
  total: z.number().describe('Monto total de la transacción.'),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    price: z.number()
  })).describe('Lista de productos facturados.')
});

export type SendDteEmailInput = z.infer<typeof SendDteEmailInputSchema>;

const SendDteEmailOutputSchema = z.object({
  success: z.boolean().describe('Indica si el envío fue exitoso.'),
  message: z.string().describe('Mensaje de estado del proceso.'),
  transmissionId: z.string().optional().describe('ID de transmisión del servidor de correo.')
});

export type SendDteEmailOutput = z.infer<typeof SendDteEmailOutputSchema>;

export async function sendDteEmail(input: SendDteEmailInput): Promise<SendDteEmailOutput> {
  return sendDteEmailFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateDteEmailPrompt',
  input: {schema: SendDteEmailInputSchema},
  prompt: `Genera un cuerpo de correo electrónico profesional y formal para el envío de un Documento Tributario Electrónico (DTE) en El Salvador.
  
  Detalles:
  Cliente: {{{customerName}}}
  Tipo de Documento: {{{docType}}}
  Número/Código: {{{docNumber}}}
  Total: $ {{{total}}}
  
  Estructura sugerida:
  1. Saludo cordial.
  2. Notificación de emisión de documento electrónico.
  3. Resumen de compra (monto y tipo).
  4. Instrucciones para descarga (en este prototipo, mencionar que el archivo está adjunto).
  5. Despedida institucional.
  
  El tono debe ser corporativo pero amable.`,
});

const sendDteEmailFlow = ai.defineFlow(
  {
    name: 'sendDteEmailFlow',
    inputSchema: SendDteEmailInputSchema,
    outputSchema: SendDteEmailOutputSchema,
  },
  async input => {
    // 1. Generar el contenido del correo usando IA para que sea dinámico y profesional
    const {text} = await prompt(input);

    // 2. Simulación de envío de correo
    // En una implementación real, aquí se usaría un plugin de Nodemailer, SendGrid, etc.
    console.log(`[MAILER] Enviando DTE a: ${input.recipientEmail}`);
    console.log(`[MAILER] Contenido generado:\n${text}`);

    // Simulamos un retraso de red
    await new Promise(resolve => setTimeout(resolve, 1500));

    return {
      success: true,
      message: `El DTE ha sido enviado exitosamente a ${input.recipientEmail}`,
      transmissionId: `MSG-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    };
  }
);
