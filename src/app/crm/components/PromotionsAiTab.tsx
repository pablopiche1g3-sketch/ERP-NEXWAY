'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Tag,
  Upload,
  Sparkles,
  CheckCircle2,
  Trash2,
  Loader2,
  FileSpreadsheet,
  FileText,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  loadCrmPromotions,
  saveCrmPromotions,
  type CrmPromotion,
  type PromotionBenefitType,
} from '@/lib/crm-promotions';

export default function PromotionsAiTab() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [promotions, setPromotions] = useState<CrmPromotion[]>([]);
  const [draftPromotions, setDraftPromotions] = useState<CrmPromotion[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');

  // Alta manual rápida
  const [mTitle, setMTitle] = useState('');
  const [mKeyword, setMKeyword] = useState('');
  const [mMinQty, setMMinQty] = useState('');
  const [mMinAmt, setMMinAmt] = useState('');
  const [mBenefitType, setMBenefitType] = useState<PromotionBenefitType>('PERCENT_DISCOUNT');
  const [mValue, setMValue] = useState('');
  const [mGift, setMGift] = useState('');

  useEffect(() => {
    loadCrmPromotions()
      .then(setPromotions)
      .finally(() => setLoading(false));
  }, []);

  const handleParseDocument = async (file?: File | null) => {
    if (!file && !pasteText.trim()) {
      toast({
        variant: 'destructive',
        title: 'Sube un archivo o pega texto',
        description: 'Carga un archivo Word (.docx), Excel (.xlsx/.csv) o escribe las promociones.',
      });
      return;
    }

    setParsing(true);
    try {
      const fd = new FormData();
      if (file) {
        fd.append('file', file);
        setSelectedFileName(file.name);
      } else {
        fd.append('text', pasteText.trim());
        setSelectedFileName('Texto manual');
      }

      const res = await fetch('/api/crm/parse-promotions', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'No se pudo leer el documento.');
      }

      const detected: CrmPromotion[] = data.promotions || [];
      if (detected.length === 0) {
        toast({ variant: 'destructive', title: 'Sin promociones detectadas', description: 'Revisa el contenido del documento.' });
        return;
      }

      setDraftPromotions(detected);
      toast({
        title: `✨ IA detectó ${detected.length} promoción(es)`,
        description: 'Revísalas abajo y pulsa "Activar en Facturación" para que el POS las sugiera.',
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al interpretar', description: err?.message });
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmDrafts = async () => {
    if (draftPromotions.length === 0) return;
    setSaving(true);
    try {
      const next = [...draftPromotions, ...promotions];
      const ok = await saveCrmPromotions(next);
      if (!ok) throw new Error('No se pudo guardar en system_config');
      setPromotions(next);
      setDraftPromotions([]);
      setPasteText('');
      setSelectedFileName('');
      if (fileRef.current) fileRef.current.value = '';
      toast({
        title: '🏷️ Promociones Activadas ✓',
        description: 'Facturación POS sugerirá automáticamente estas promociones cuando la venta califique.',
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleAddManualPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mTitle.trim()) return;
    const item: CrmPromotion = {
      id: `PROMO-${Date.now().toString().slice(-6)}`,
      title: mTitle.trim(),
      description:
        mBenefitType === 'PERCENT_DISCOUNT'
          ? `${mValue || 10}% de descuento${mKeyword ? ` en ${mKeyword}` : ''}`
          : mBenefitType === 'FIXED_DISCOUNT'
          ? `$${mValue || 5} de descuento${mKeyword ? ` en ${mKeyword}` : ''}`
          : mGift.trim() || mTitle.trim(),
      active: true,
      keywordOrSku: mKeyword.trim(),
      minQty: parseInt(mMinQty, 10) > 0 ? parseInt(mMinQty, 10) : undefined,
      minAmount: parseFloat(mMinAmt) > 0 ? parseFloat(mMinAmt) : undefined,
      benefitType: mBenefitType,
      discountPercent: mBenefitType === 'PERCENT_DISCOUNT' ? parseFloat(mValue) || 10 : undefined,
      discountAmount: mBenefitType === 'FIXED_DISCOUNT' ? parseFloat(mValue) || 5 : undefined,
      giftDescription: mBenefitType === 'FREE_GIFT_NOTE' ? mGift.trim() || mTitle.trim() : undefined,
      createdAt: new Date().toISOString(),
    };
    const next = [item, ...promotions];
    setPromotions(next);
    await saveCrmPromotions(next);
    setMTitle('');
    setMKeyword('');
    setMMinQty('');
    setMMinAmt('');
    setMValue('');
    setMGift('');
    toast({ title: 'Promoción creada y activa ✓' });
  };

  const handleToggleActive = async (id: string) => {
    const next = promotions.map(p => (p.id === id ? { ...p, active: !p.active } : p));
    setPromotions(next);
    await saveCrmPromotions(next);
  };

  const handleDelete = async (id: string) => {
    const next = promotions.filter(p => p.id !== id);
    setPromotions(next);
    await saveCrmPromotions(next);
  };

  const renderBenefitBadge = (p: CrmPromotion) => {
    if (p.benefitType === 'PERCENT_DISCOUNT') {
      return <Badge className="bg-emerald-600 text-white border-0 text-[10px] font-black">{p.discountPercent || 0}% DESC.</Badge>;
    }
    if (p.benefitType === 'FIXED_DISCOUNT') {
      return <Badge className="bg-blue-600 text-white border-0 text-[10px] font-black">-${Number(p.discountAmount || 0).toFixed(2)}</Badge>;
    }
    return <Badge className="bg-amber-600 text-white border-0 text-[10px] font-black">🎁 REGALO / BONIF.</Badge>;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Izquierda: Lector IA de Word / Excel + Alta Manual */}
      <div className="lg:col-span-6 space-y-5">
        <Card className="bg-card border-border rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="p-5 border-b border-border bg-indigo-500/5">
            <CardTitle className="text-sm font-black flex items-center gap-2 text-foreground">
              <Sparkles size={16} className="text-indigo-500" />
              Cargar Promociones desde Word / Excel (IA)
            </CardTitle>
            <CardDescription className="text-xs">
              Sube tu archivo Word (`.docx`) o Excel (`.xlsx`/`.csv`) con las promociones del mes. La IA interpreta las reglas y Facturación POS las sugiere automáticamente al cajero.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept=".docx,.xlsx,.xls,.csv,.txt"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleParseDocument(f);
              }}
            />

            <button
              type="button"
              disabled={parsing}
              onClick={() => fileRef.current?.click()}
              className="w-full p-5 rounded-2xl border-2 border-dashed border-indigo-500/40 bg-indigo-500/5 hover:bg-indigo-500/10 transition-all flex flex-col items-center justify-center gap-2 text-center"
            >
              {parsing ? (
                <Loader2 size={24} className="animate-spin text-indigo-500" />
              ) : (
                <div className="flex items-center gap-2 text-indigo-500">
                  <FileText size={22} />
                  <Upload size={18} />
                  <FileSpreadsheet size={22} />
                </div>
              )}
              <div className="text-xs font-black text-foreground">
                {parsing
                  ? 'Interpretando documento con IA...'
                  : selectedFileName
                  ? `Archivo: ${selectedFileName} (clic para cambiar)`
                  : 'Haz clic para subir Word (.docx) o Excel (.xlsx / .csv)'}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Ej: "Por compra de 2 galones de Pintura Látex lleva 10% de descuento o 1 brocha gratis"
              </p>
            </button>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                O pega el texto de tus promociones aquí
              </Label>
              <Textarea
                rows={3}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="Ej. Compra de 2 galones de pintura blanca -> 10% de descuento&#10;Compras mayores a $100 -> $10 de descuento directo"
                className="text-xs rounded-xl"
              />
              <Button
                type="button"
                disabled={parsing || !pasteText.trim()}
                onClick={() => handleParseDocument(null)}
                className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1.5"
              >
                {parsing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Interpretar Promociones con IA
              </Button>
            </div>

            {/* Borradores interpretados por la IA pendientes de confirmación */}
            {draftPromotions.length > 0 && (
              <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                    ✨ {draftPromotions.length} Promoción(es) Detectadas por IA
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setDraftPromotions([])}
                    className="h-6 text-[10px]"
                  >
                    Limpiar
                  </Button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {draftPromotions.map((dp, idx) => (
                    <div key={dp.id} className="p-2.5 rounded-lg bg-card border border-border text-xs space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Input
                          value={dp.title}
                          onChange={e =>
                            setDraftPromotions(prev =>
                              prev.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x))
                            )
                          }
                          className="h-7 text-xs font-bold"
                        />
                        {renderBenefitBadge(dp)}
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <Input
                          value={dp.keywordOrSku || ''}
                          onChange={e =>
                            setDraftPromotions(prev =>
                              prev.map((x, i) => (i === idx ? { ...x, keywordOrSku: e.target.value } : x))
                            )
                          }
                          placeholder="Palabra / SKU"
                          className="h-7 text-[11px]"
                        />
                        <Input
                          type="number"
                          value={dp.minQty ?? ''}
                          onChange={e =>
                            setDraftPromotions(prev =>
                              prev.map((x, i) => (i === idx ? { ...x, minQty: parseInt(e.target.value, 10) || undefined } : x))
                            )
                          }
                          placeholder="Mín. uds"
                          className="h-7 text-[11px]"
                        />
                        <Input
                          type="number"
                          value={dp.minAmount ?? ''}
                          onChange={e =>
                            setDraftPromotions(prev =>
                              prev.map((x, i) => (i === idx ? { ...x, minAmount: parseFloat(e.target.value) || undefined } : x))
                            )
                          }
                          placeholder="Mín. $"
                          className="h-7 text-[11px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  disabled={saving}
                  onClick={handleConfirmDrafts}
                  className="w-full h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black gap-1.5"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Confirmar y Activar en Facturación POS
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alta Manual Rápida */}
        <Card className="bg-card border-border rounded-2xl shadow-sm">
          <CardHeader className="p-4 border-b border-border">
            <CardTitle className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
              <Plus size={14} className="text-indigo-500" /> Crear Promoción Manual Rápida
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <form onSubmit={handleAddManualPromo} className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input value={mTitle} onChange={e => setMTitle(e.target.value)} placeholder="Nombre promo (ej. 10% en Aceites)" className="h-8 text-xs" />
                <Input value={mKeyword} onChange={e => setMKeyword(e.target.value)} placeholder="Palabra clave o SKU (opc.)" className="h-8 text-xs" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Select value={mBenefitType} onValueChange={v => setMBenefitType(v as PromotionBenefitType)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT_DISCOUNT" className="text-xs">% Descuento</SelectItem>
                    <SelectItem value="FIXED_DISCOUNT" className="text-xs">$ Descuento Fijo</SelectItem>
                    <SelectItem value="FREE_GIFT_NOTE" className="text-xs">Regalo / Bonificación</SelectItem>
                  </SelectContent>
                </Select>
                {mBenefitType === 'FREE_GIFT_NOTE' ? (
                  <Input value={mGift} onChange={e => setMGift(e.target.value)} placeholder="Ej. 1 Brocha gratis" className="col-span-2 h-8 text-xs" />
                ) : (
                  <Input
                    type="number"
                    step="0.01"
                    value={mValue}
                    onChange={e => setMValue(e.target.value)}
                    placeholder={mBenefitType === 'PERCENT_DISCOUNT' ? '% (ej. 10)' : '$ (ej. 5.00)'}
                    className="h-8 text-xs font-mono"
                  />
                )}
                {mBenefitType !== 'FREE_GIFT_NOTE' && (
                  <Input type="number" value={mMinQty} onChange={e => setMMinQty(e.target.value)} placeholder="Mín. uds" className="h-8 text-xs font-mono" />
                )}
              </div>
              <Button type="submit" size="sm" disabled={!mTitle.trim()} className="w-full h-8 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 text-white text-xs font-bold">
                Guardar Promoción
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Derecha: Promociones Activas en el Sistema */}
      <Card className="lg:col-span-6 bg-card border-border rounded-2xl shadow-sm overflow-hidden">
        <CardHeader className="p-5 border-b border-border">
          <CardTitle className="text-sm font-black flex items-center gap-2">
            <Tag size={16} className="text-emerald-500" />
            Promociones Activas ({promotions.filter(p => p.active).length} / {promotions.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Cuando una venta en Facturación POS cumple la condición, el botón <strong>Promoción</strong> avisa al cajero para aplicarla.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-2.5 max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">Cargando promociones...</div>
          ) : promotions.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground italic">
              Aún no hay promociones cargadas. Sube un Word o Excel a la izquierda para que la IA las interprete.
            </div>
          ) : (
            promotions.map(p => (
              <div
                key={p.id}
                className={`p-3.5 rounded-xl border space-y-1.5 transition-all ${
                  p.active ? 'bg-background border-border' : 'bg-muted/30 border-border/50 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {renderBenefitBadge(p)}
                      <span className="text-xs font-black text-foreground">{p.title}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">{p.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={p.active} onCheckedChange={() => handleToggleActive(p.id)} />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(p.id)}
                      className="h-7 w-7 text-rose-600"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-muted-foreground">
                  {p.keywordOrSku && <Badge variant="outline" className="text-[9px] font-mono">Aplica a: {p.keywordOrSku}</Badge>}
                  {p.minQty && <Badge variant="outline" className="text-[9px]">Mín. {p.minQty} uds</Badge>}
                  {p.minAmount && <Badge variant="outline" className="text-[9px]">Mín. ${p.minAmount.toFixed(2)}</Badge>}
                  {p.sourceFileName && <span className="italic ml-auto">Fuente: {p.sourceFileName}</span>}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
