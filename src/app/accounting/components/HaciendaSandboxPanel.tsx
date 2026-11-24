'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  FileJson,
  Loader2,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/supabase/client';
import {
  DEFAULT_HACIENDA_SANDBOX_CONFIG,
  DEFAULT_HACIENDA_SANDBOX_URL,
  DteTransmissionRecord,
  HaciendaSandboxConfig,
  appendDteTransmission,
  loadDteTransmissions,
  loadHaciendaSandboxConfig,
  saveHaciendaSandboxConfig,
  transmitDteViaSandbox,
} from '@/lib/hacienda-sandbox';

export default function HaciendaSandboxPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const [cfg, setCfg] = useState<HaciendaSandboxConfig>(DEFAULT_HACIENDA_SANDBOX_CONFIG);
  const [transmissions, setTransmissions] = useState<DteTransmissionRecord[]>([]);
  const [selectedTx, setSelectedTx] = useState<DteTransmissionRecord | null>(null);
  const [lastTestResult, setLastTestResult] = useState<{
    ok: boolean;
    estado: string;
    selloRecibido?: string | null;
    codigoGeneracion?: string | null;
    descripcionMsg?: string | null;
    observaciones?: string[];
  } | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [loadedCfg, loadedTxs] = await Promise.all([
        loadHaciendaSandboxConfig(),
        loadDteTransmissions(),
      ]);
      setCfg(loadedCfg);
      setTransmissions(loadedTxs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const kpis = useMemo(() => {
    const total = transmissions.length;
    const processed = transmissions.filter((t) => t.estado === 'PROCESADO').length;
    const rejected = transmissions.filter((t) => t.estado !== 'PROCESADO').length;
    return { total, processed, rejected };
  }, [transmissions]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveHaciendaSandboxConfig(cfg);
      toast({
        title: 'Configuración Sandbox MH guardada',
        description: `Ambiente ${cfg.ambiente === '00' ? 'Pruebas (00)' : 'Producción (01)'} conectado a ${cfg.baseUrl}.`,
      });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: e?.message || 'No se pudo guardar la configuración.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setLastTestResult(null);
    try {
      const { data: compRes } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'company_profile')
        .maybeSingle();

      const res = await fetch('/api/hacienda/transmit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testConnection: true,
          baseUrl: cfg.baseUrl || DEFAULT_HACIENDA_SANDBOX_URL,
          ambiente: cfg.ambiente,
          company: compRes?.value || null,
        }),
      });
      const data = await res.json();
      setLastTestResult(data);

      if (data?.dteJson) {
        const estado: 'PROCESADO' | 'RECHAZADO' | 'ERROR' =
          data.estado === 'PROCESADO'
            ? 'PROCESADO'
            : data.estado === 'RECHAZADO'
            ? 'RECHAZADO'
            : 'ERROR';
        const updated = await appendDteTransmission({
          id: `tx-test-${Date.now()}`,
          saleId: null,
          correlative: data.numeroControl || 'TEST-MH',
          tipoDte: '01',
          docTypeLabel: 'Prueba DTE-01',
          numeroControl: data.numeroControl || data.dteJson?.identificacion?.numeroControl || 'TEST',
          codigoGeneracion: data.codigoGeneracion || data.dteJson?.identificacion?.codigoGeneracion || 'N/A',
          estado,
          selloRecibido: data.selloRecibido || null,
          fhaRecibido: data.fhaRecibido || null,
          codigoMsg: data.codigoMsg || null,
          descripcionMsg: data.descripcionMsg || null,
          observaciones: Array.isArray(data.observaciones) ? data.observaciones : [],
          customerName: 'Consumidor Final Prueba',
          total: 11.3,
          ambiente: cfg.ambiente,
          signedJws: data.signedJws || null,
          dteJson: data.dteJson,
          createdAt: new Date().toISOString(),
        });
        setTransmissions(updated);
      }

      if (data?.ok) {
        toast({
          title: 'Conexión Exitosa con Sandbox MH ✅',
          description: `Sello recibido: ${data.selloRecibido}`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: `Sandbox respondió: ${data?.estado || 'ERROR'}`,
          description:
            (data?.observaciones && data.observaciones[0]) ||
            data?.descripcionMsg ||
            'Revisa el detalle.',
        });
      }
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Error de conexión',
        description: e?.message || 'No se pudo conectar al Sandbox MH.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleRetry = async (tx: DteTransmissionRecord) => {
    setRetryingId(tx.id);
    try {
      const data = await transmitDteViaSandbox({
        dteJson: tx.dteJson,
        baseUrl: cfg.baseUrl,
        ambiente: cfg.ambiente,
      });

      const estado: 'PROCESADO' | 'RECHAZADO' | 'ERROR' =
        data?.estado === 'PROCESADO'
          ? 'PROCESADO'
          : data?.estado === 'RECHAZADO'
          ? 'RECHAZADO'
          : 'ERROR';

      const updated = await appendDteTransmission({
        ...tx,
        estado,
        selloRecibido: data?.selloRecibido || tx.selloRecibido,
        fhaRecibido: data?.fhaRecibido || tx.fhaRecibido,
        codigoMsg: data?.codigoMsg || null,
        descripcionMsg: data?.descripcionMsg || null,
        observaciones: Array.isArray(data?.observaciones) ? data.observaciones : [],
        signedJws: data?.signedJws || tx.signedJws || null,
        createdAt: new Date().toISOString(),
      });
      setTransmissions(updated);

      if (estado === 'PROCESADO') {
        toast({
          title: 'DTE Procesado en Reintento ✅',
          description: `Sello: ${data.selloRecibido}`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Sigue rechazado por MH Sandbox',
          description:
            (data?.observaciones && data.observaciones[0]) ||
            data?.descripcionMsg ||
            'Revisa las observaciones.',
        });
      }
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Error al reintentar',
        description: e?.message || 'No se pudo reenviar el DTE.',
      });
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/70 bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Ambiente Activo</p>
              <p className="text-lg font-black mt-1 text-indigo-600 dark:text-indigo-400">
                {cfg.ambiente === '00' ? 'Pruebas (00)' : 'Producción (01)'}
              </p>
            </div>
            <ShieldCheck className="h-8 w-8 text-indigo-500/70" />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase text-muted-foreground">DTEs Transmitidos</p>
              <p className="text-2xl font-black mt-1">{kpis.total}</p>
            </div>
            <Send className="h-7 w-7 text-slate-400" />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Procesados (Con Sello)</p>
              <p className="text-2xl font-black mt-1 text-emerald-600 dark:text-emerald-400">
                {kpis.processed}
              </p>
            </div>
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Rechazados / Error</p>
              <p className="text-2xl font-black mt-1 text-amber-600 dark:text-amber-400">
                {kpis.rejected}
              </p>
            </div>
            <AlertTriangle className="h-7 w-7 text-amber-500" />
          </CardContent>
        </Card>
      </div>

      {/* Configuración Sandbox */}
      <Card className="border-border/70 bg-card shadow-sm">
        <CardHeader className="pb-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-black flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-500" />
              Conexión API Sandbox MH (DTE Studio)
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Firma (`/api/dte/firmar`) y transmite (`/api/dte/recepcion`) tus facturas DTE-01 y CCF DTE-03 en ambiente de pruebas.
            </CardDescription>
          </div>
          <a
            href={cfg.baseUrl || DEFAULT_HACIENDA_SANDBOX_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Abrir DTE Studio <ExternalLink size={13} />
          </a>
        </CardHeader>

        <CardContent className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/20">
              <div>
                <p className="text-xs font-bold">Integración Sandbox MH Activa</p>
                <p className="text-[11px] text-muted-foreground">Habilita firma y recepción simulada contra tu API.</p>
              </div>
              <Switch
                checked={cfg.enabled}
                onCheckedChange={(v) => setCfg((prev) => ({ ...prev, enabled: v }))}
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/20">
              <div>
                <p className="text-xs font-bold">Transmisión Automática al Cobrar</p>
                <p className="text-[11px] text-muted-foreground">Envía cada Factura/CCF al cobrar en Caja sin bloquear la venta.</p>
              </div>
              <Switch
                checked={cfg.autoTransmit}
                disabled={!cfg.enabled}
                onCheckedChange={(v) => setCfg((prev) => ({ ...prev, autoTransmit: v }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-6 space-y-1.5">
              <Label className="text-xs font-bold">URL Base del Emulador / API MH</Label>
              <Input
                value={cfg.baseUrl}
                onChange={(e) => setCfg((prev) => ({ ...prev, baseUrl: e.target.value }))}
                placeholder={DEFAULT_HACIENDA_SANDBOX_URL}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs font-bold">Ambiente</Label>
              <Select
                value={cfg.ambiente}
                onValueChange={(v: '00' | '01') => setCfg((prev) => ({ ...prev, ambiente: v }))}
              >
                <SelectTrigger className="h-9 text-xs font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="00">00 - Pruebas</SelectItem>
                  <SelectItem value="01">01 - Producción</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs font-bold">Cód. Establecimiento</Label>
              <Input
                value={cfg.codEstableMH}
                onChange={(e) => setCfg((prev) => ({ ...prev, codEstableMH: e.target.value.toUpperCase() }))}
                placeholder="M001"
                maxLength={4}
                className="h-9 text-xs font-mono uppercase"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs font-bold">Punto de Venta</Label>
              <Input
                value={cfg.codPuntoVentaMH}
                onChange={(e) => setCfg((prev) => ({ ...prev, codPuntoVentaMH: e.target.value.toUpperCase() }))}
                placeholder="P001"
                maxLength={4}
                className="h-9 text-xs font-mono uppercase"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-9 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Guardar Configuración
            </Button>

            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing}
              className="h-9 text-xs font-bold rounded-xl"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
              Probar Conexión (Enviar DTE-01 de Prueba)
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={loadAll}
              disabled={loading}
              className="h-9 text-xs font-bold rounded-xl ml-auto"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar Bitácora
            </Button>
          </div>

          {lastTestResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                lastTestResult.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
              }`}
            >
              <div className="font-black flex items-center gap-1.5">
                {lastTestResult.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                Resultado de Prueba: {lastTestResult.estado} — {lastTestResult.descripcionMsg}
              </div>
              {lastTestResult.selloRecibido && (
                <div className="font-mono text-[11px] break-all">
                  <strong>Sello Recibido:</strong> {lastTestResult.selloRecibido}
                </div>
              )}
              {lastTestResult.observaciones && lastTestResult.observaciones.length > 0 && (
                <ul className="list-disc pl-5 text-[11px]">
                  {lastTestResult.observaciones.map((obs, idx) => (
                    <li key={idx}>{obs}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bitácora de Transmisiones */}
      <Card className="border-border/70 bg-card shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-sm font-black flex items-center gap-2">
            <FileJson className="h-4 w-4 text-indigo-500" />
            Bitácora de Transmisiones DTE (Sellos MH)
          </CardTitle>
          <CardDescription className="text-xs">
            Historial de los últimos 100 documentos transmitidos desde Caja y pruebas al Sandbox MH.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] font-bold uppercase pl-5">Fecha</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase">Documento / Control</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase">Cliente</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-right">Total</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-center">Estado</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase">Sello de Recepción</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-right pr-5">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Cargando transmisiones...
                      </span>
                    </TableCell>
                  </TableRow>
                ) : transmissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-xs text-muted-foreground italic">
                      Aún no hay transmisiones registradas. Presiona &quot;Probar Conexión&quot; o realiza una venta en Caja.
                    </TableCell>
                  </TableRow>
                ) : (
                  transmissions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="pl-5 text-[11px] whitespace-nowrap text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleString('es-SV', { timeZone: 'America/El_Salvador' })}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-bold font-mono">{tx.correlative}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {tx.docTypeLabel} · {tx.numeroControl}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium max-w-[180px] truncate">
                        {tx.customerName}
                      </TableCell>
                      <TableCell className="text-xs font-black text-right font-mono">
                        ${Number(tx.total || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-black ${
                            tx.estado === 'PROCESADO'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : tx.estado === 'RECHAZADO'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {tx.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        {tx.selloRecibido ? (
                          <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-300 break-all">
                            {tx.selloRecibido}
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 line-clamp-2">
                            {tx.observaciones?.[0] || tx.descripcionMsg || 'Sin sello'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-5">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-[10px] font-bold rounded-lg"
                            onClick={() => setSelectedTx(tx)}
                          >
                            <Eye size={12} className="mr-1" /> JSON
                          </Button>
                          {tx.estado !== 'PROCESADO' && (
                            <Button
                              size="sm"
                              className="h-7 px-2.5 text-[10px] font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
                              disabled={retryingId === tx.id}
                              onClick={() => handleRetry(tx)}
                            >
                              {retryingId === tx.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <>
                                  <RefreshCw size={11} className="mr-1" /> Reintentar
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Inspector JSON */}
      <Dialog open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm font-black flex items-center gap-2">
              <FileJson className="h-4 w-4 text-indigo-500" />
              Detalle DTE — {selectedTx?.numeroControl}
            </DialogTitle>
            <DialogDescription className="text-xs font-mono">
              UUID: {selectedTx?.codigoGeneracion} {selectedTx?.selloRecibido ? `· Sello: ${selectedTx.selloRecibido}` : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedTx?.observaciones && selectedTx.observaciones.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 space-y-1">
              <p className="font-bold">Observaciones de Hacienda Sandbox:</p>
              <ul className="list-disc pl-5 text-[11px]">
                {selectedTx.observaciones.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-bold"
              onClick={() => {
                if (selectedTx?.dteJson) {
                  navigator.clipboard.writeText(JSON.stringify(selectedTx.dteJson, null, 2));
                  toast({ title: 'JSON copiado al portapapeles' });
                }
              }}
            >
              <Copy size={13} className="mr-1.5" /> Copiar JSON Oficial
            </Button>
          </div>

          <pre className="flex-1 overflow-auto p-4 rounded-xl bg-slate-950 text-slate-100 text-[11px] font-mono leading-relaxed max-h-[50vh]">
            {selectedTx ? JSON.stringify(selectedTx.dteJson, null, 2) : ''}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
