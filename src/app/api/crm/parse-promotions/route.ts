import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as XLSX from 'xlsx';
import zlib from 'zlib';
import type { CrmPromotion } from '@/lib/crm-promotions';

/**
 * Extrae texto limpio de un archivo Word (.docx) leyendo word/document.xml
 * directamente desde los encabezados ZIP sin depender de paquetes externos.
 */
function extractDocxText(buffer: Buffer): string {
  try {
    let offset = 0;
    const chunks: string[] = [];

    while (offset + 30 < buffer.length) {
      // Local file header signature: 0x04034b50
      if (buffer.readUInt32LE(offset) !== 0x04034b50) {
        offset += 1;
        continue;
      }
      const compressionMethod = buffer.readUInt16LE(offset + 8);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const fileNameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);
      const fileName = buffer.toString('utf8', offset + 30, offset + 30 + fileNameLen);
      const dataStart = offset + 30 + fileNameLen + extraLen;

      if (fileName === 'word/document.xml') {
        let xmlBuffer: Buffer | null = null;
        if (compressionMethod === 0 && compressedSize > 0) {
          xmlBuffer = buffer.subarray(dataStart, dataStart + compressedSize);
        } else if (compressionMethod === 8) {
          // Si compressedSize === 0 (data descriptor bit 3), localizar el siguiente header
          let endIdx = compressedSize > 0 ? dataStart + compressedSize : buffer.length;
          if (compressedSize === 0) {
            const nextSig = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), dataStart + 1);
            const centralSig = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), dataStart + 1);
            endIdx = Math.min(
              nextSig > 0 ? nextSig : buffer.length,
              centralSig > 0 ? centralSig : buffer.length
            );
          }
          try {
            xmlBuffer = zlib.inflateRawSync(buffer.subarray(dataStart, endIdx));
          } catch {
            // Intentar recortando 12-16 bytes de data descriptor si venían al final
            for (const trim of [16, 12, 8, 4]) {
              try {
                xmlBuffer = zlib.inflateRawSync(buffer.subarray(dataStart, Math.max(dataStart, endIdx - trim)));
                break;
              } catch {
                // continue
              }
            }
          }
        }

        if (xmlBuffer) {
          const xml = xmlBuffer.toString('utf8');
          const text = xml
            .replace(/<\/w:p>/g, '\n')
            .replace(/<\/w:tc>/g, ' | ')
            .replace(/<w:tab\/>/g, ' ')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
          chunks.push(text);
        }
        break;
      }

      if (compressedSize > 0) {
        offset = dataStart + compressedSize;
      } else {
        offset = dataStart + 1;
      }
    }

    return chunks.join('\n').trim();
  } catch (err) {
    console.warn('Error extrayendo texto de .docx:', err);
    return '';
  }
}

function extractExcelText(buffer: Buffer): string {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const parts: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
    const lines = rows
      .map(r => r.map(c => String(c ?? '').trim()).filter(Boolean).join(' | '))
      .filter(Boolean);
    if (lines.length > 0) {
      parts.push(`[Hoja: ${sheetName}]\n${lines.join('\n')}`);
    }
  }
  return parts.join('\n\n');
}

function buildDeterministicPromotions(rawText: string, fileName?: string): CrmPromotion[] {
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length >= 8 && !/^\[Hoja:/i.test(l) && !/^(producto|promo|descripcion|titulo)\s*\|/i.test(l));

  const promos: CrmPromotion[] = [];

  lines.slice(0, 20).forEach((line, idx) => {
    const pctMatch = line.match(/(\d+(?:\.\d+)?)\s*%/);
    const usdMatch = line.match(/\$\s*(\d+(?:[.,]\d{1,2})?)/);
    const qtyMatch = line.match(/(?:compra de|lleva|mínimo|minimo|desde|por)\s+(\d+)/i);
    const hasGift = /(gratis|regalo|bonificaci[oó]n|obsequio|2x1|3x2)/i.test(line);

    let benefitType: CrmPromotion['benefitType'] = 'PERCENT_DISCOUNT';
    let discountPercent: number | undefined;
    let discountAmount: number | undefined;
    let giftDescription: string | undefined;

    if (pctMatch) {
      benefitType = 'PERCENT_DISCOUNT';
      discountPercent = parseFloat(pctMatch[1]);
    } else if (hasGift) {
      benefitType = 'FREE_GIFT_NOTE';
      giftDescription = line.slice(0, 80);
    } else if (usdMatch) {
      benefitType = 'FIXED_DISCOUNT';
      discountAmount = parseFloat(usdMatch[1].replace(',', '.'));
    } else {
      benefitType = 'FREE_GIFT_NOTE';
      giftDescription = line.slice(0, 80);
    }

    const segments = line.split('|').map(s => s.trim()).filter(Boolean);
    const title = (segments[0] || `Promoción ${idx + 1}`).slice(0, 65);
    const keywordCandidate = segments.length > 1 ? segments[1] : '';

    promos.push({
      id: `PROMO-${Date.now().toString().slice(-5)}-${idx + 1}`,
      title,
      description: line.slice(0, 180),
      active: true,
      sourceFileName: fileName,
      keywordOrSku: keywordCandidate.slice(0, 60),
      minQty: qtyMatch ? parseInt(qtyMatch[1], 10) : undefined,
      minAmount: /a partir de \$|compra m[ií]nima.*\$/i.test(line) && usdMatch
        ? parseFloat(usdMatch[1].replace(',', '.'))
        : undefined,
      benefitType,
      discountPercent,
      discountAmount,
      giftDescription,
      createdAt: new Date().toISOString(),
    });
  });

  return promos;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const rawTextInput = String(formData.get('text') || '').trim();

    let extractedText = rawTextInput;
    let fileName = file?.name || 'Texto manual';

    if (file) {
      const arrBuf = await file.arrayBuffer();
      const buffer = Buffer.from(arrBuf);
      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
        extractedText = extractExcelText(buffer);
      } else if (lowerName.endsWith('.docx')) {
        extractedText = extractDocxText(buffer);
      } else {
        extractedText = buffer.toString('utf8');
      }
    }

    if (!extractedText || extractedText.trim().length < 5) {
      return NextResponse.json(
        { error: 'No se pudo extraer texto legible del documento. Usa un archivo .xlsx, .csv, .docx o pega el texto de las promociones.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
    if (!apiKey) {
      const fallbackPromos = buildDeterministicPromotions(extractedText, fileName);
      return NextResponse.json({
        promotions: fallbackPromos,
        extractedPreview: extractedText.slice(0, 500),
        source: 'fallback',
      });
    }

    const prompt = `Eres un analista comercial de ERP NEXWAY.
Te entregarán el contenido extraído de un archivo Excel o Word con promociones comerciales.
Interpreta CADA promoción descrita y devuélvela en JSON válido (sin bloques markdown) con este formato exacto:
{
  "promotions": [
    {
      "title": "Nombre corto y claro de la promoción",
      "description": "Explicación breve para el cajero en POS",
      "keywordOrSku": "Palabra clave de producto o SKU (ej. PINTURA, ACEITE, BROCHA). Deja vacío '' si aplica a cualquier compra.",
      "minQty": 2,
      "minAmount": 0,
      "validFrom": "YYYY-MM-DD o ''",
      "validUntil": "YYYY-MM-DD o ''",
      "benefitType": "PERCENT_DISCOUNT" | "FIXED_DISCOUNT" | "FREE_GIFT_NOTE",
      "discountPercent": 10,
      "discountAmount": 0,
      "giftDescription": "Ej. 1 Brocha 2 pulgadas gratis (si benefitType es FREE_GIFT_NOTE)"
    }
  ]
}

DOCUMENTO (${fileName}):
${extractedText.slice(0, 12000)}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    let rawJson = '';
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { responseMimeType: 'application/json', temperature: 0.15 },
      });
      const result = await model.generateContent(prompt);
      rawJson = result.response.text();
    } catch {
      const modelFb = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: 'application/json', temperature: 0.15 },
      });
      const result = await modelFb.generateContent(prompt);
      rawJson = result.response.text();
    }

    const cleaned = rawJson.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    const items = Array.isArray(parsed?.promotions) ? parsed.promotions : [];

    const normalized: CrmPromotion[] = items
      .filter((p: any) => p && (p.title || p.description))
      .map((p: any, idx: number) => ({
        id: `PROMO-${Date.now().toString().slice(-5)}-${idx + 1}`,
        title: String(p.title || `Promoción ${idx + 1}`).trim(),
        description: String(p.description || p.title || '').trim(),
        active: true,
        sourceFileName: fileName,
        keywordOrSku: String(p.keywordOrSku || '').trim(),
        minQty: Number(p.minQty) > 0 ? Number(p.minQty) : undefined,
        minAmount: Number(p.minAmount) > 0 ? Number(p.minAmount) : undefined,
        validFrom: p.validFrom ? String(p.validFrom).trim() : undefined,
        validUntil: p.validUntil ? String(p.validUntil).trim() : undefined,
        benefitType: ['PERCENT_DISCOUNT', 'FIXED_DISCOUNT', 'FREE_GIFT_NOTE'].includes(p.benefitType)
          ? p.benefitType
          : 'FREE_GIFT_NOTE',
        discountPercent: Number(p.discountPercent) > 0 ? Number(p.discountPercent) : undefined,
        discountAmount: Number(p.discountAmount) > 0 ? Number(p.discountAmount) : undefined,
        giftDescription: p.giftDescription ? String(p.giftDescription).trim() : undefined,
        createdAt: new Date().toISOString(),
      }));

    return NextResponse.json({
      promotions: normalized.length > 0 ? normalized : buildDeterministicPromotions(extractedText, fileName),
      extractedPreview: extractedText.slice(0, 500),
      source: 'gemini',
    });
  } catch (err: any) {
    console.warn('Promotions AI parse error:', err?.message || err);
    return NextResponse.json(
      { error: err?.message || 'Error al interpretar el documento de promociones.' },
      { status: 500 }
    );
  }
}
