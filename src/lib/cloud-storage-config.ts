import { supabase } from '@/supabase/client';

export type CloudStorageProvider = 'supabase_internal' | 'google_drive' | 'onedrive' | 'dropbox' | 'custom_cloud';

export interface CloudStorageConfig {
  provider: CloudStorageProvider;
  folderName: string;
  folderUrl: string;
  folderId: string;
  accountEmail: string;
  autoBackupEnabled: boolean;
  pythonDteServiceUrl: string;
  updatedAt?: string;
}

export const DEFAULT_CLOUD_STORAGE_CONFIG: CloudStorageConfig = {
  provider: 'supabase_internal',
  folderName: 'ERP-NEXWAY Bóveda Documental',
  folderUrl: '',
  folderId: '',
  accountEmail: '',
  autoBackupEnabled: false,
  pythonDteServiceUrl: 'http://localhost:8000'
};

export const CLOUD_PROVIDER_META: Record<
  CloudStorageProvider,
  { label: string; shortLabel: string; description: string; placeholderUrl: string }
> = {
  supabase_internal: {
    label: 'Almacenamiento Interno (Supabase ERP)',
    shortLabel: 'Interno ERP',
    description: 'Guarda los documentos directamente en la base de datos del ERP. Sin configuración extra.',
    placeholderUrl: ''
  },
  google_drive: {
    label: 'Google Drive',
    shortLabel: 'Google Drive',
    description: 'Vincula una carpeta de Google Drive de tu empresa para respaldar y enlazar archivos pesados y DTEs.',
    placeholderUrl: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp...'
  },
  onedrive: {
    label: 'Microsoft OneDrive / SharePoint',
    shortLabel: 'OneDrive',
    description: 'Conecta tu carpeta compartida de OneDrive o SharePoint corporativo.',
    placeholderUrl: 'https://onedrive.live.com/?id=...'
  },
  dropbox: {
    label: 'Dropbox',
    shortLabel: 'Dropbox',
    description: 'Enlaza una carpeta de Dropbox empresarial para acceso rápido desde cualquier sucursal.',
    placeholderUrl: 'https://www.dropbox.com/sh/...'
  },
  custom_cloud: {
    label: 'Otra Nube (Nextcloud / S3 / Servidor Propio)',
    shortLabel: 'Nube Propia',
    description: 'Usa cualquier repositorio en la nube o servidor web corporativo mediante URL raíz.',
    placeholderUrl: 'https://nube.miempresa.com/boveda'
  }
};

export const CLOUD_CONFIG_KEY = 'cloud_storage_config';
const LOCAL_STORAGE_KEY = 'nexway_cloud_storage_config';

export function extractGoogleDriveFolderId(urlOrId: string): string {
  const clean = (urlOrId || '').trim();
  if (!clean) return '';
  const match = clean.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match?.[1]) return match[1];
  const idParam = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParam?.[1]) return idParam[1];
  return clean.includes('http') ? '' : clean;
}

export async function loadCloudStorageConfig(): Promise<CloudStorageConfig> {
  let localCfg: Partial<CloudStorageConfig> = {};
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) localCfg = JSON.parse(raw);
    } catch {
      // ignore
    }
  }

  try {
    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', CLOUD_CONFIG_KEY)
      .maybeSingle();

    if (data?.value && typeof data.value === 'object') {
      const merged: CloudStorageConfig = {
        ...DEFAULT_CLOUD_STORAGE_CONFIG,
        ...localCfg,
        ...(data.value as Partial<CloudStorageConfig>)
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
      }
      return merged;
    }
  } catch {
    // fallback to local
  }

  return { ...DEFAULT_CLOUD_STORAGE_CONFIG, ...localCfg };
}

export async function saveCloudStorageConfig(cfg: CloudStorageConfig): Promise<void> {
  const payload: CloudStorageConfig = {
    ...cfg,
    folderId:
      cfg.provider === 'google_drive'
        ? extractGoogleDriveFolderId(cfg.folderId || cfg.folderUrl)
        : cfg.folderId.trim(),
    updatedAt: new Date().toISOString()
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
  }

  const { error } = await supabase.from('system_config').upsert(
    {
      key: CLOUD_CONFIG_KEY,
      value: payload},
    { onConflict: 'key' }
  );

  if (error) throw error;
}

export const DTE_TYPE_LABELS: Record<string, string> = {
  '01': 'Factura de Consumidor Final (DTE-01)',
  '03': 'Comprobante de Crédito Fiscal (DTE-03)',
  '04': 'Nota de Remisión (DTE-04)',
  '05': 'Nota de Crédito (DTE-05)',
  '06': 'Nota de Débito (DTE-06)',
  '07': 'Comprobante de Retención (DTE-07)',
  '11': 'Factura de Exportación (DTE-11)',
  '14': 'Factura de Sujeto Excluido (DTE-14)'
};

export interface ParsedDteSummary {
  tipoDte: string;
  tipoDteLabel: string;
  ambiente: string;
  codigoGeneracion: string;
  numeroControl: string;
  fecEmi: string;
  horEmi: string;
  selloRecepcion: string;
  emisor: {
    nombre: string;
    nombreComercial?: string;
    nit: string;
    nrc: string;
    codActividad: string;
    descActividad: string;
    telefono: string;
    correo: string;
    direccion: string;
  };
  receptor: {
    nombre: string;
    tipoDocumento: string;
    numDocumento: string;
    nit: string;
    nrc: string;
    codActividad: string;
    descActividad: string;
    telefono: string;
    correo: string;
    direccion: string;
  };
  items: Array<{
    numItem: number;
    codigo: string;
    descripcion: string;
    cantidad: number;
    precioUni: number;
    montoDescu: number;
    ventaGravada: number;
    ventaExenta: number;
    ventaNoSuj: number;
  }>;
  resumen: {
    totalGravada: number;
    totalExenta: number;
    totalNoSuj: number;
    subTotal: number;
    totalDescu: number;
    totalIva: number;
    ivaRete1: number;
    reteRenta: number;
    totalPagar: number;
    totalLetras: string;
  };
}

function formatDireccion(dir: any): string {
  if (!dir) return '';
  if (typeof dir === 'string') return dir;
  return [dir.complemento, dir.municipio, dir.departamento].filter(Boolean).join(', ');
}

export function parseDteJsonDocument(raw: any): ParsedDteSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.identificacion;
  if (!id || typeof id !== 'object') return null;

  const emi = raw.emisor || {};
  const rec = raw.receptor || {};
  const res = raw.resumen || {};
  const itemsRaw = Array.isArray(raw.cuerpoDocumento) ? raw.cuerpoDocumento : [];
  const tipoDte = String(id.tipoDte || '01');

  // Calcular IVA desde resumen.totalIva o desde tributos[] (código '20')
  let totalIva = Number(res.totalIva || 0);
  if (!totalIva && Array.isArray(res.tributos)) {
    const ivaTrib = res.tributos.find((t: any) => String(t.codigo) === '20');
    if (ivaTrib) totalIva = Number(ivaTrib.valor || 0);
  }

  return {
    tipoDte,
    tipoDteLabel: DTE_TYPE_LABELS[tipoDte] || `Documento Tributario Electrónico (DTE-${tipoDte})`,
    ambiente: String(id.ambiente || '00'),
    codigoGeneracion: String(id.codigoGeneracion || ''),
    numeroControl: String(id.numeroControl || ''),
    fecEmi: String(id.fecEmi || ''),
    horEmi: String(id.horEmi || ''),
    selloRecepcion: String(
      raw.selloRecepcion ||
        raw.selloRecibido ||
        raw.responseMH?.selloRecibido ||
        raw.respuestaHacienda?.selloRecibido ||
        ''
    ),
    emisor: {
      nombre: String(emi.nombre || ''),
      nombreComercial: emi.nombreComercial ? String(emi.nombreComercial) : undefined,
      nit: String(emi.nit || ''),
      nrc: String(emi.nrc || ''),
      codActividad: String(emi.codActividad || ''),
      descActividad: String(emi.descActividad || ''),
      telefono: String(emi.telefono || ''),
      correo: String(emi.correo || ''),
      direccion: formatDireccion(emi.direccion)
    },
    receptor: {
      nombre: String(rec.nombre || 'Consumidor Final'),
      tipoDocumento: String(rec.tipoDocumento || (rec.nit ? '36' : '')),
      numDocumento: String(rec.numDocumento || rec.nit || ''),
      nit: String(rec.nit || ''),
      nrc: String(rec.nrc || ''),
      codActividad: String(rec.codActividad || ''),
      descActividad: String(rec.descActividad || ''),
      telefono: String(rec.telefono || ''),
      correo: String(rec.correo || ''),
      direccion: formatDireccion(rec.direccion)
    },
    items: itemsRaw.map((it: any, idx: number) => ({
      numItem: Number(it.numItem || idx + 1),
      codigo: String(it.codigo || ''),
      descripcion: String(it.descripcion || ''),
      cantidad: Number(it.cantidad || 0),
      precioUni: Number(it.precioUni || 0),
      montoDescu: Number(it.montoDescu || 0),
      ventaGravada: Number(it.ventaGravada || 0),
      ventaExenta: Number(it.ventaExenta || 0),
      ventaNoSuj: Number(it.ventaNoSuj || 0)
    })),
    resumen: {
      totalGravada: Number(res.totalGravada || 0),
      totalExenta: Number(res.totalExenta || 0),
      totalNoSuj: Number(res.totalNoSuj || 0),
      subTotal: Number(res.subTotal || res.subTotalVentas || 0),
      totalDescu: Number(res.totalDescu || 0),
      totalIva,
      ivaRete1: Number(res.ivaRete1 || 0),
      reteRenta: Number(res.reteRenta || 0),
      totalPagar: Number(res.totalPagar || res.montoTotalOperacion || 0),
      totalLetras: String(res.totalLetras || '')
    }
  };
}
