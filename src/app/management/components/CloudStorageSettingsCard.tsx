'use client';

import React, { useEffect, useState } from 'react';
import {
  Cloud,
  CheckCircle2,
  ExternalLink,
  FolderSync,
  HardDrive,
  Loader2,
  RefreshCw,
  Save,
  Server,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  CLOUD_PROVIDER_META,
  CloudStorageConfig,
  CloudStorageProvider,
  DEFAULT_CLOUD_STORAGE_CONFIG,
  extractGoogleDriveFolderId,
  loadCloudStorageConfig,
  saveCloudStorageConfig
} from '@/lib/cloud-storage-config';

const PROVIDER_LIST: CloudStorageProvider[] = [
  'supabase_internal',
  'google_drive',
  'onedrive',
  'dropbox',
  'custom_cloud'
];

export default function CloudStorageSettingsCard() {
  const { toast } = useToast();
  const [config, setConfig] = useState<CloudStorageConfig>(DEFAULT_CLOUD_STORAGE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingPython, setTestingPython] = useState(false);
  const [pythonHealth, setPythonHealth] = useState<'idle' | 'online' | 'offline'>('idle');

  useEffect(() => {
    let active = true;
    loadCloudStorageConfig()
      .then((cfg) => {
        if (active) setConfig(cfg);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCloudStorageConfig(config);
      toast({
        title: 'Almacenamiento en la Nube Guardado',
        description: `Proveedor activo: ${CLOUD_PROVIDER_META[config.provider].label}`
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error al guardar configuración',
        description: err?.message || 'No se pudo guardar la configuración de nube.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestPythonService = async () => {
    const baseUrl = (config.pythonDteServiceUrl || 'http://localhost:8000').replace(/\/+$/, '');
    setTestingPython(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(`${baseUrl}/api/v1/health`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPythonHealth('online');
      toast({
        title: 'Microservicio Python DTE Conectado',
        description: `WeasyPrint PDF activo en ${baseUrl}`
      });
    } catch {
      setPythonHealth('offline');
      toast({
        variant: 'destructive',
        title: 'Servicio Python DTE no responde',
        description: `No se detectó dte-pdf-service en ${baseUrl}. El visor DTE JSON nativo del navegador seguirá funcionando normalmente.`
      });
    } finally {
      setTestingPython(false);
    }
  };

  const providerMeta = CLOUD_PROVIDER_META[config.provider];

  return (
    <Card className="border shadow-md rounded-2xl bg-card overflow-hidden">
      <CardHeader className="bg-slate-900 text-white p-6 dark:bg-slate-950">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight">
              <Cloud className="text-sky-400" size={20} />
              Almacenamiento en la Nube y Visor DTE (Bóveda Documental)
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs mt-1">
              Vincula Google Drive, OneDrive, Dropbox o tu propia nube para respaldar archivos y configura el motor PDF de Python.
            </CardDescription>
          </div>
          <Badge className="bg-sky-500/20 text-sky-300 border border-sky-400/30 text-[10px] font-bold">
            {providerMeta.shortLabel}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="animate-spin h-4 w-4" /> Cargando configuración de nube...
          </div>
        ) : (
          <>
            {/* Selector de Proveedor */}
            <div className="space-y-2.5">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                Proveedor de Almacenamiento para la Bóveda Documental
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                {PROVIDER_LIST.map((prov) => {
                  const meta = CLOUD_PROVIDER_META[prov];
                  const selected = config.provider === prov;
                  return (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => setConfig({ ...config, provider: prov })}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selected
                          ? 'bg-indigo-500/10 border-indigo-500 ring-1 ring-indigo-500/40'
                          : 'bg-muted/30 border-border hover:bg-muted/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-foreground">{meta.shortLabel}</span>
                        {prov === 'supabase_internal' ? (
                          <HardDrive size={14} className={selected ? 'text-indigo-500' : 'text-muted-foreground'} />
                        ) : (
                          <Cloud size={14} className={selected ? 'text-indigo-500' : 'text-muted-foreground'} />
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{meta.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Configuración específica del proveedor externo */}
            {config.provider !== 'supabase_internal' && (
              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <FolderSync size={15} className="text-indigo-500" />
                    Conexión con {providerMeta.label}
                  </div>
                  {config.folderUrl && (
                    <a
                      href={config.folderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      Abrir carpeta en la nube <ExternalLink size={12} />
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                      Nombre de la Carpeta Raíz
                    </Label>
                    <Input
                      value={config.folderName}
                      onChange={(e) => setConfig({ ...config, folderName: e.target.value })}
                      placeholder="Ej. ERP-NEXWAY Documentos 2026"
                      className="h-10 text-xs bg-background"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                      Correo de Cuenta Vinculada (Opcional)
                    </Label>
                    <Input
                      type="email"
                      value={config.accountEmail}
                      onChange={(e) => setConfig({ ...config, accountEmail: e.target.value })}
                      placeholder="gerencia@miempresa.com"
                      className="h-10 text-xs bg-background"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                      URL de Carpeta Compartida en {providerMeta.shortLabel}
                    </Label>
                    <Input
                      value={config.folderUrl}
                      onChange={(e) => {
                        const url = e.target.value;
                        setConfig({
                          ...config,
                          folderUrl: url,
                          folderId:
                            config.provider === 'google_drive'
                              ? extractGoogleDriveFolderId(url)
                              : config.folderId
                        });
                      }}
                      placeholder={providerMeta.placeholderUrl}
                      className="h-10 text-xs font-mono bg-background"
                    />
                    {config.provider === 'google_drive' && config.folderId && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                        ✓ Folder ID detectado: {config.folderId}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <div>
                    <div className="text-xs font-bold text-foreground">Acceso directo desde Bóveda Documental</div>
                    <p className="text-[10px] text-muted-foreground">
                      Muestra el botón de carpeta en la nube y permite vincular archivos alojados en {providerMeta.shortLabel}.
                    </p>
                  </div>
                  <Switch
                    checked={config.autoBackupEnabled}
                    onCheckedChange={(val) => setConfig({ ...config, autoBackupEnabled: val })}
                  />
                </div>
              </div>
            )}

            {/* Microservicio Python PDF DTE */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Server size={15} className="text-emerald-500" />
                  Microservicio Python para PDF Oficial de DTE (dte-pdf-service)
                </div>
                {pythonHealth === 'online' && (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px]">
                    <CheckCircle2 size={11} className="mr-1" /> En línea
                  </Badge>
                )}
                {pythonHealth === 'offline' && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40 text-[10px]">
                    <AlertCircle size={11} className="mr-1" /> Apagado (Usando visor nativo)
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                La Bóveda Documental visualiza e imprime todos los archivos <strong>DTE JSON</strong> directamente en el navegador. Si ejecutas el microservicio Python (WeasyPrint + QR), indícalo aquí para generar también PDFs vectoriales oficiales.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={config.pythonDteServiceUrl}
                  onChange={(e) => setConfig({ ...config, pythonDteServiceUrl: e.target.value })}
                  placeholder="http://localhost:8000"
                  className="h-9 text-xs font-mono bg-background flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestPythonService}
                  disabled={testingPython}
                  className="h-9 text-xs gap-1.5"
                >
                  {testingPython ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  Probar Conexión
                </Button>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs gap-2"
            >
              {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save size={15} />}
              GUARDAR AJUSTES DE NUBE Y VISOR DTE
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
