'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  FileText,
  Landmark,
  ListPlus,
  Loader2,
  Plus,
  Printer,
  Receipt,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/supabase/client';
import { useUser } from '@/supabase/use-user';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface InvoiceItem {
  number: string;
  docType?: 'CCF' | 'FCF' | 'NC' | 'FSE';
  invoiceDate?: string;
  amount: number;
}

interface QuedanExtendedMeta {
  quedanNumber: string;
  supplierNit?: string;
  supplierNrc?: string;
  supplierPhone?: string;
  receptionDate: string;
  creditDays?: number;
  paymentMethod: string;
  bankAccount?: string;
  applyRetention1: boolean;
  retentionAmount: number;
  netPayable: number;
  receivedBy?: string;
  deliveredBy?: string;
  notes?: string;
  paidAt?: string;
  paymentReference?: string;
}

interface QuedanRecord {
  id: string;
  supplier: string;
  dueDate: string;
  invoices: InvoiceItem[];
  totalAmount: number;
  status: 'PENDIENTE' | 'PAGADO';
  createdAt: string;
  meta: QuedanExtendedMeta;
}

const META_CONFIG_KEY = 'quedan_extended_metadata';
const LOCAL_META_KEY = 'nexway_quedan_extended_meta';

function addDaysToIso(baseIso: string, days: number): string {
  const d = baseIso ? new Date(`${baseIso}T12:00:00`) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getDaysUntilDue(dueDate: string): number {
  if (!dueDate) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function printOfficialQuedan(q: QuedanRecord, companyProfile: any) {
  const rows = (q.invoices || [])
    .map(
      (inv, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td style="text-align:center;font-weight:bold;">${inv.docType || 'CCF'}</td>
        <td style="font-family:monospace;">${inv.number}</td>
        <td style="text-align:center;">${inv.invoiceDate || '—'}</td>
        <td style="text-align:right;font-family:monospace;font-weight:bold;">$${Number(inv.amount || 0).toFixed(2)}</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Quedan ${q.meta.quedanNumber}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0f172a; margin: 28px; font-size: 12px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #4c1d95; padding-bottom: 12px; margin-bottom: 16px; }
      .title { font-size: 20px; font-weight: 900; color: #4c1d95; letter-spacing: 0.5px; }
      .qnum { font-family: monospace; font-size: 15px; font-weight: bold; background: #f3e8ff; color: #5b21b6; padding: 6px 12px; border-radius: 8px; border: 1px solid #d8b4fe; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
      .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; }
      .box h4 { margin: 0 0 6px 0; font-size: 10px; text-transform: uppercase; color: #475569; letter-spacing: 0.5px; }
      .row-info { margin: 3px 0; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th, td { border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 11px; }
      th { background: #f8fafc; text-align: left; text-transform: uppercase; font-size: 10px; color: #475569; }
      .totals { width: 290px; margin-left: auto; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; }
      .trow { display: flex; justify-content: space-between; padding: 3px 0; }
      .tgrand { border-top: 2px solid #0f172a; margin-top: 6px; padding-top: 6px; font-size: 14px; font-weight: 900; }
      .note { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-top: 12px; font-size: 11px; }
      .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; text-align: center; }
      .sig-line { border-top: 1px solid #334155; padding-top: 6px; font-size: 11px; }
      @media print { body { margin: 14px; } }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <div class="title">COMPROBANTE DE QUEDAN</div>
        <div style="font-weight:bold;margin-top:4px;">${companyProfile?.razonSocial || companyProfile?.nombreComercial || 'ERP NEXWAY / TECNICOLOR'}</div>
        <div style="font-size:11px;color:#475569;">
          ${companyProfile?.nit ? `NIT: ${companyProfile.nit}` : ''} ${companyProfile?.nrc ? `| NRC: ${companyProfile.nrc}` : ''}
        </div>
        ${companyProfile?.address ? `<div style="font-size:11px;color:#475569;">${companyProfile.address}</div>` : ''}
      </div>
      <div style="text-align:right;">
        <div class="qnum">${q.meta.quedanNumber}</div>
        <div style="margin-top:6px;font-size:11px;"><strong>Fecha Recepción:</strong> ${q.meta.receptionDate}</div>
        <div style="font-size:11px;color:#b45309;"><strong>Fecha Programada de Pago:</strong> ${q.dueDate}</div>
        <div style="margin-top:4px;font-size:10px;font-weight:bold;">ESTADO: ${q.status}</div>
      </div>
    </div>

    <div class="grid">
      <div class="box">
        <h4>Datos del Proveedor</h4>
        <div class="row-info"><strong>Razón Social:</strong> ${q.supplier}</div>
        <div class="row-info"><strong>NIT:</strong> ${q.meta.supplierNit || '—'} &nbsp;|&nbsp; <strong>NRC:</strong> ${q.meta.supplierNrc || '—'}</div>
        <div class="row-info"><strong>Teléfono:</strong> ${q.meta.supplierPhone || '—'}</div>
      </div>
      <div class="box">
        <h4>Condiciones de Pago</h4>
        <div class="row-info"><strong>Forma de Pago:</strong> ${q.meta.paymentMethod || 'Transferencia Bancaria'}</div>
        <div class="row-info"><strong>Banco / Cuenta:</strong> ${q.meta.bankAccount || 'Según registro de tesorería'}</div>
        <div class="row-info"><strong>Recibido por:</strong> ${q.meta.receivedBy || '—'}</div>
        ${q.meta.paymentReference ? `<div class="row-info"><strong>Ref. Pago:</strong> ${q.meta.paymentReference}</div>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:36px;text-align:center;">#</th>
          <th style="width:70px;text-align:center;">Tipo</th>
          <th>No. Documento / Control DTE</th>
          <th style="width:95px;text-align:center;">Fecha Doc.</th>
          <th style="width:110px;text-align:right;">Monto</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <div class="trow"><span>Total Facturas (${q.invoices.length}):</span><span style="font-family:monospace;">$${q.totalAmount.toFixed(2)}</span></div>
      ${
        q.meta.retentionAmount > 0
          ? `<div class="trow" style="color:#b45309;"><span>Retención 1% IVA:</span><span style="font-family:monospace;">-$${q.meta.retentionAmount.toFixed(2)}</span></div>`
          : ''
      }
      <div class="trow tgrand"><span>NETO A PAGAR:</span><span style="font-family:monospace;">$${q.meta.netPayable.toFixed(2)}</span></div>
    </div>

    ${q.meta.notes ? `<div class="note"><strong>Observaciones:</strong> ${q.meta.notes}</div>` : ''}

    <div class="note" style="font-size:10px;color:#475569;">
      Quedan en nuestro poder los documentos detallados arriba para trámite de revisión y pago en la fecha programada. Para efectuar el cobro es indispensable presentar este comprobante original o su referencia.
    </div>

    <div class="signatures">
      <div>
        <div class="sig-line"><strong>Entregado por (Proveedor)</strong><br/>${q.meta.deliveredBy || 'Nombre y Firma'}</div>
      </div>
      <div>
        <div class="sig-line"><strong>Recibido por (Contabilidad / Tesorería)</strong><br/>${q.meta.receivedBy || 'Nombre, Firma y Sello'}</div>
      </div>
    </div>
    <script>window.onload = function(){ window.print(); };</script>
  </body>
  </html>`;

  const win = window.open('', '_blank', 'width=920,height=780');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
  }
}

export default function QuedanTab() {
  const { toast } = useToast();
  const { user } = useUser();

  const todayIso = new Date().toISOString().slice(0, 10);

  // Listas cargadas
  const [quedans, setQuedans] = useState<QuedanRecord[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Filtros historial
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDIENTE' | 'VENCIDO' | 'PAGADO'>('all');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);

  // Modal de detalle y pago
  const [selectedQuedan, setSelectedQuedan] = useState<QuedanRecord | null>(null);
  const [paymentRefInput, setPaymentRefInput] = useState('');

  // Formulario de Emisión Completo
  const [quedanNumber, setQuedanNumber] = useState('');
  const [supplier, setSupplier] = useState('');
  const [supplierNit, setSupplierNit] = useState('');
  const [supplierNrc, setSupplierNrc] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [receptionDate, setReceptionDate] = useState(todayIso);
  const [dueDate, setDueDate] = useState(addDaysToIso(todayIso, 30));
  const [paymentMethod, setPaymentMethod] = useState('Transferencia Bancaria');
  const [bankAccount, setBankAccount] = useState('');
  const [applyRetention1, setApplyRetention1] = useState(false);
  const [receivedBy, setReceivedBy] = useState('');
  const [deliveredBy, setDeliveredBy] = useState('');
  const [notes, setNotes] = useState('');

  // Facturas dentro del Quedan
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [currentDocType, setCurrentDocType] = useState<'CCF' | 'FCF' | 'NC' | 'FSE'>('CCF');
  const [currentInvoiceNum, setCurrentInvoiceNum] = useState('');
  const [currentInvoiceDate, setCurrentInvoiceDate] = useState(todayIso);
  const [currentInvoiceAmount, setCurrentInvoiceAmount] = useState<string>('');

  useEffect(() => {
    if (user?.email && !receivedBy) {
      setReceivedBy(user.email);
    }
  }, [user]);

  const loadMetaMap = async (): Promise<Record<string, QuedanExtendedMeta>> => {
    let localMeta: Record<string, QuedanExtendedMeta> = {};
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(LOCAL_META_KEY);
        if (raw) localMeta = JSON.parse(raw);
      } catch {}
    }
    try {
      const { data } = await supabase.from('system_config').select('value').eq('key', META_CONFIG_KEY).maybeSingle();
      const remoteMeta = data?.value && typeof data.value === 'object' ? (data.value as Record<string, QuedanExtendedMeta>) : {};
      return { ...localMeta, ...remoteMeta };
    } catch {
      return localMeta;
    }
  };

  const saveMetaEntry = async (id: string, entry: QuedanExtendedMeta) => {
    const current = await loadMetaMap();
    const updated = { ...current, [id]: entry };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_META_KEY, JSON.stringify(updated));
      } catch {}
    }
    await supabase
      .from('system_config')
      .upsert({ key: META_CONFIG_KEY, value: updated, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [qRes, supRes, compRes, metaMap] = await Promise.all([
        supabase.from('quedan').select('*').order('created_at', { ascending: false }),
        supabase.from('suppliers').select('*').order('name').limit(200),
        supabase.from('system_config').select('value').eq('key', 'company_profile').maybeSingle(),
        loadMetaMap()
      ]);

      if (qRes.error) throw qRes.error;
      if (supRes.data) setSuppliers(supRes.data);
      if (compRes.data?.value) setCompanyProfile(compRes.data.value);

      const list: QuedanRecord[] = (qRes.data || []).map((q: any, idx: number) => {
        const total = parseFloat(q.total_amount) || 0;
        const storedMeta = metaMap[q.id];
        const fallbackNum = `QDN-${new Date(q.created_at || Date.now()).getFullYear()}-${String((qRes.data?.length || 1) - idx).padStart(4, '0')}`;
        const meta: QuedanExtendedMeta = storedMeta || {
          quedanNumber: fallbackNum,
          receptionDate: q.created_at ? String(q.created_at).slice(0, 10) : todayIso,
          paymentMethod: 'Transferencia Bancaria',
          applyRetention1: false,
          retentionAmount: 0,
          netPayable: total
        };

        return {
          id: q.id,
          supplier: q.supplier || 'Sin proveedor',
          dueDate: q.due_date || '',
          invoices: Array.isArray(q.invoices) ? q.invoices : [],
          totalAmount: total,
          status: q.status === 'PAGADO' ? 'PAGADO' : 'PENDIENTE',
          createdAt: q.created_at,
          meta
        };
      });

      setQuedans(list);

      // Sugerir siguiente correlativo
      const nextNum = `QDN-${new Date().getFullYear()}-${String(list.length + 1).padStart(4, '0')}`;
      setQuedanNumber((prev) => prev || nextNum);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo sincronizar el historial de Quedan.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const addInvoiceToList = () => {
    const amount = parseFloat(currentInvoiceAmount) || 0;
    if (!currentInvoiceNum.trim() || amount <= 0) {
      toast({ variant: 'destructive', title: 'Datos incompletos', description: 'Ingrese número de documento y monto mayor a $0.' });
      return;
    }

    setInvoices((prev) => [
      ...prev,
      {
        number: currentInvoiceNum.trim(),
        docType: currentDocType,
        invoiceDate: currentInvoiceDate || todayIso,
        amount
      }
    ]);
    setCurrentInvoiceNum('');
    setCurrentInvoiceAmount('');
  };

  const removeInvoiceFromList = (index: number) => {
    setInvoices((prev) => prev.filter((_, i) => i !== index));
  };

  const totalAmount = useMemo(() => invoices.reduce((acc, inv) => acc + inv.amount, 0), [invoices]);

  const retentionAmount = useMemo(() => {
    if (!applyRetention1) return 0;
    const gravado = totalAmount / 1.13;
    if (gravado < 100) return 0;
    return Number((gravado * 0.01).toFixed(2));
  }, [applyRetention1, totalAmount]);

  const netPayable = useMemo(() => Math.max(0, Number((totalAmount - retentionAmount).toFixed(2))), [totalAmount, retentionAmount]);

  const handleCreateQuedan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier.trim() || !dueDate || invoices.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Faltan datos',
        description: 'Debe ingresar proveedor, fecha de pago programada y al menos una factura.'
      });
      return;
    }

    setIsSaving(true);
    try {
      const dbPayload = {
        supplier: supplier.trim(),
        due_date: dueDate,
        invoices,
        total_amount: Number(totalAmount.toFixed(2)),
        status: 'PENDIENTE'
      };

      const { data: inserted, error } = await supabase.from('quedan').insert(dbPayload).select('id').single();
      if (error) throw error;

      const finalNumber = quedanNumber.trim() || `QDN-${new Date().getFullYear()}-${String(quedans.length + 1).padStart(4, '0')}`;
      if (inserted?.id) {
        await saveMetaEntry(inserted.id, {
          quedanNumber: finalNumber,
          supplierNit: supplierNit.trim() || undefined,
          supplierNrc: supplierNrc.trim() || undefined,
          supplierPhone: supplierPhone.trim() || undefined,
          receptionDate: receptionDate || todayIso,
          paymentMethod,
          bankAccount: bankAccount.trim() || undefined,
          applyRetention1,
          retentionAmount,
          netPayable,
          receivedBy: receivedBy.trim() || undefined,
          deliveredBy: deliveredBy.trim() || undefined,
          notes: notes.trim() || undefined
        });
      }

      toast({
        title: `Quedan ${finalNumber} Emitido`,
        description: `Neto a pagar: $${netPayable.toFixed(2)} programado para el ${dueDate}.`
      });

      setSupplier('');
      setSupplierNit('');
      setSupplierNrc('');
      setSupplierPhone('');
      setBankAccount('');
      setDeliveredBy('');
      setNotes('');
      setApplyRetention1(false);
      setInvoices([]);
      setQuedanNumber(`QDN-${new Date().getFullYear()}-${String(quedans.length + 2).padStart(4, '0')}`);

      await loadData();
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: error?.message || 'No se pudo registrar el Quedan.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkPaidOrPending = async (q: QuedanRecord, refPago?: string) => {
    const nextStatus = q.status === 'PENDIENTE' ? 'PAGADO' : 'PENDIENTE';
    try {
      const { error } = await supabase.from('quedan').update({ status: nextStatus }).eq('id', q.id);
      if (error) throw error;

      await saveMetaEntry(q.id, {
        ...q.meta,
        paidAt: nextStatus === 'PAGADO' ? new Date().toISOString() : undefined,
        paymentReference: nextStatus === 'PAGADO' ? refPago?.trim() || q.meta.paymentReference : undefined
      });

      toast({
        title: nextStatus === 'PAGADO' ? 'Quedan Liquidado / Pagado' : 'Quedan Reabierto como Pendiente',
        description: `${q.meta.quedanNumber} — ${q.supplier}`
      });

      setSelectedQuedan(null);
      setPaymentRefInput('');
      await loadData();
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el estado del Quedan.' });
    }
  };

  const handleDeleteQuedan = async (q: QuedanRecord) => {
    if (!window.confirm(`¿Eliminar el Quedan ${q.meta.quedanNumber} de ${q.supplier}?`)) return;
    try {
      const { error } = await supabase.from('quedan').delete().eq('id', q.id);
      if (error) throw error;
      toast({ title: 'Quedan Eliminado' });
      if (selectedQuedan?.id === q.id) setSelectedQuedan(null);
      await loadData();
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el Quedan.' });
    }
  };

  // KPIs
  const kpis = useMemo(() => {
    let pendingTotal = 0;
    let overdueTotal = 0;
    let dueSoonTotal = 0;
    let paidTotal = 0;
    let overdueCount = 0;

    quedans.forEach((q) => {
      const net = q.meta.netPayable ?? q.totalAmount;
      if (q.status === 'PAGADO') {
        paidTotal += net;
      } else {
        pendingTotal += net;
        const days = getDaysUntilDue(q.dueDate);
        if (days < 0) {
          overdueTotal += net;
          overdueCount++;
        } else if (days <= 7) {
          dueSoonTotal += net;
        }
      }
    });

    return { pendingTotal, overdueTotal, dueSoonTotal, paidTotal, overdueCount };
  }, [quedans]);

  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.trim().toLowerCase();
    if (!q) return suppliers.slice(0, 25);
    return suppliers
      .filter((s) => (s.name || '').toLowerCase().includes(q) || (s.nit || '').toLowerCase().includes(q))
      .slice(0, 25);
  }, [suppliers, supplierSearch]);

  const filteredQuedans = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return quedans.filter((item) => {
      if (statusFilter === 'PENDIENTE' && item.status !== 'PENDIENTE') return false;
      if (statusFilter === 'PAGADO' && item.status !== 'PAGADO') return false;
      if (statusFilter === 'VENCIDO' && !(item.status === 'PENDIENTE' && getDaysUntilDue(item.dueDate) < 0)) return false;

      if (!q) return true;
      return (
        item.supplier.toLowerCase().includes(q) ||
        item.meta.quedanNumber.toLowerCase().includes(q) ||
        (item.meta.supplierNit || '').toLowerCase().includes(q) ||
        item.invoices.some((inv) => (inv.number || '').toLowerCase().includes(q))
      );
    });
  }, [quedans, searchTerm, statusFilter]);

  return (
    <div className="space-y-6">
      {/* KPIs DE TESORERÍA QUEDAN */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card border-border rounded-2xl shadow-sm">
          <CardContent className="p-4">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Pendiente por Pagar</div>
            <div className="text-xl font-black text-foreground font-mono mt-1">${kpis.pendingTotal.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-rose-500/30 rounded-2xl shadow-sm">
          <CardContent className="p-4">
            <div className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <AlertTriangle size={12} /> Vencidos ({kpis.overdueCount})
            </div>
            <div className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono mt-1">${kpis.overdueTotal.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-amber-500/30 rounded-2xl shadow-sm">
          <CardContent className="p-4">
            <div className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Por Vencer (≤ 7 días)</div>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">${kpis.dueSoonTotal.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-emerald-500/30 rounded-2xl shadow-sm">
          <CardContent className="p-4">
            <div className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Liquidados / Pagados</div>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">${kpis.paidTotal.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PANEL IZQUIERDO: EMISIÓN COMPLETA DE QUEDAN */}
        <div className="lg:col-span-5">
          <Card className="bg-card border-border rounded-2xl overflow-hidden shadow-sm">
            <CardHeader className="bg-purple-700 text-white p-5">
              <div className="flex justify-between items-center gap-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Plus size={18} className="text-purple-200" />
                  Emisión de Quedan
                </CardTitle>
                <Badge className="bg-purple-500/80 text-white border-purple-300/40 font-mono text-[11px]">
                  {quedanNumber}
                </Badge>
              </div>
              <CardDescription className="text-purple-100 text-xs">
                Agrupa facturas CCF/FCF de un proveedor con plazo, retención 1% IVA y comprobante imprimible.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              <form onSubmit={handleCreateQuedan} className="space-y-4">
                {/* Correlativo + Proveedor */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-4 space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">No. Quedan</Label>
                    <Input
                      value={quedanNumber}
                      onChange={(e) => setQuedanNumber(e.target.value)}
                      className="h-9 text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="sm:col-span-8 space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Proveedor *</Label>
                    <div className="flex gap-1.5">
                      <Input
                        placeholder="Razón social del proveedor..."
                        value={supplier}
                        onChange={(e) => setSupplier(e.target.value)}
                        className="h-9 text-xs font-semibold"
                      />
                      <Popover open={supplierPopoverOpen} onOpenChange={setSupplierPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" title="Elegir proveedor del directorio">
                            <Building2 size={14} />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-0 bg-popover border-border" align="end">
                          <div className="p-2 border-b border-border">
                            <Input
                              placeholder="Buscar proveedor..."
                              value={supplierSearch}
                              onChange={(e) => setSupplierSearch(e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                          <ScrollArea className="h-44">
                            {filteredSuppliers.length === 0 ? (
                              <div className="p-4 text-center text-xs text-muted-foreground">Sin proveedores registrados</div>
                            ) : (
                              filteredSuppliers.map((sup) => (
                                <button
                                  key={sup.id}
                                  type="button"
                                  onClick={() => {
                                    setSupplier(sup.name || '');
                                    setSupplierNit(sup.nit || '');
                                    setSupplierNrc(sup.nrc || '');
                                    setSupplierPhone(sup.phone || '');
                                    setSupplierPopoverOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-muted/60 border-b border-border/50 text-xs"
                                >
                                  <div className="font-bold text-foreground truncate">{sup.name}</div>
                                  <div className="text-[10px] text-muted-foreground font-mono">
                                    {sup.nit ? `NIT: ${sup.nit}` : 'Proveedor'} {sup.nrc ? `• NRC: ${sup.nrc}` : ''}
                                  </div>
                                </button>
                              ))
                            )}
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>

                {/* NIT, NRC, Teléfono */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">NIT</Label>
                    <Input placeholder="Opcional" value={supplierNit} onChange={(e) => setSupplierNit(e.target.value)} className="h-8 text-xs font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">NRC</Label>
                    <Input placeholder="Opcional" value={supplierNrc} onChange={(e) => setSupplierNrc(e.target.value)} className="h-8 text-xs font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Teléfono</Label>
                    <Input placeholder="Opcional" value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>

                {/* Fechas y Plazo Rápido */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Fecha Recepción</Label>
                    <Input
                      type="date"
                      value={receptionDate}
                      onChange={(e) => setReceptionDate(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Fecha de Pago *</Label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="h-9 text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground mr-1">Plazo rápido:</span>
                  {[15, 30, 45, 60].map((d) => (
                    <Button
                      key={d}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDueDate(addDaysToIso(receptionDate, d))}
                      className="h-6 text-[10px] px-2 rounded-lg"
                    >
                      +{d} días
                    </Button>
                  ))}
                </div>

                {/* Forma de Pago y Banco */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Forma de Pago</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Transferencia Bancaria" className="text-xs">Transferencia Bancaria</SelectItem>
                        <SelectItem value="Cheque" className="text-xs">Cheque</SelectItem>
                        <SelectItem value="Depósito en Cuenta" className="text-xs">Depósito en Cuenta</SelectItem>
                        <SelectItem value="Efectivo" className="text-xs">Efectivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Banco / Cuenta</Label>
                    <Input
                      placeholder="Ej. Agrícola #00123..."
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                {/* Facturas incluidas */}
                <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-3">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground block">
                    Facturas / Documentos a Incluir ({invoices.length})
                  </Label>
                  <div className="grid grid-cols-12 gap-1.5">
                    <div className="col-span-3">
                      <Select value={currentDocType} onValueChange={(v: any) => setCurrentDocType(v)}>
                        <SelectTrigger className="h-8 text-[11px] bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CCF" className="text-xs">CCF</SelectItem>
                          <SelectItem value="FCF" className="text-xs">FCF</SelectItem>
                          <SelectItem value="FSE" className="text-xs">FSE</SelectItem>
                          <SelectItem value="NC" className="text-xs">NC</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-5">
                      <Input
                        placeholder="No. Doc / Control"
                        value={currentInvoiceNum}
                        onChange={(e) => setCurrentInvoiceNum(e.target.value)}
                        className="h-8 text-xs font-mono bg-background"
                      />
                    </div>
                    <div className="col-span-4">
                      <Input
                        type="date"
                        value={currentInvoiceDate}
                        onChange={(e) => setCurrentInvoiceDate(e.target.value)}
                        className="h-8 text-[11px] bg-background"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Monto factura ($)"
                        value={currentInvoiceAmount}
                        onChange={(e) => setCurrentInvoiceAmount(e.target.value)}
                        className="h-8 pl-7 text-xs font-bold font-mono bg-background"
                      />
                    </div>
                    <Button type="button" size="sm" variant="secondary" onClick={addInvoiceToList} className="h-8 text-xs gap-1 px-3">
                      <ListPlus size={14} /> Agregar
                    </Button>
                  </div>

                  {invoices.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-border">
                      {invoices.map((inv, index) => (
                        <div key={`${inv.number}-${index}`} className="flex justify-between items-center bg-card px-2.5 py-1.5 rounded-lg border border-border text-xs">
                          <div className="min-w-0">
                            <span className="font-bold text-purple-600 dark:text-purple-400 mr-1.5">[{inv.docType || 'CCF'}]</span>
                            <span className="font-mono font-semibold">{inv.number}</span>
                            {inv.invoiceDate && <span className="text-[10px] text-muted-foreground ml-2">{inv.invoiceDate}</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold">${inv.amount.toFixed(2)}</span>
                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-rose-500" onClick={() => removeInvoiceFromList(index)}>
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Retención 1% IVA + Responsables */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <ShieldCheck size={14} /> Aplicar Retención 1% IVA
                    </div>
                    <p className="text-[10px] text-amber-800/80 dark:text-amber-200/80">
                      Descuenta 1% sobre subtotal gravado (≥ $100)
                    </p>
                  </div>
                  <Switch checked={applyRetention1} onCheckedChange={setApplyRetention1} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Recibido por</Label>
                    <Input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Contabilidad / Caja" className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Entregado por</Label>
                    <Input value={deliveredBy} onChange={(e) => setDeliveredBy(e.target.value)} placeholder="Mensajero / Vendedor" className="h-8 text-xs" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Observaciones</Label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej. Pagar los viernes en horario de 2:00 PM a 4:00 PM..."
                    className="h-8 text-xs"
                  />
                </div>

                {/* Resumen de Totales */}
                {invoices.length > 0 && (
                  <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Facturas:</span>
                      <span className="font-mono font-semibold">${totalAmount.toFixed(2)}</span>
                    </div>
                    {retentionAmount > 0 && (
                      <div className="flex justify-between text-amber-600 dark:text-amber-400 font-semibold">
                        <span>Retención 1% IVA:</span>
                        <span className="font-mono">-${retentionAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-border font-black text-sm text-purple-700 dark:text-purple-400">
                      <span>NETO A PAGAR:</span>
                      <span className="font-mono">${netPayable.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 bg-purple-600 hover:bg-purple-700 rounded-xl font-bold text-white shadow-sm text-xs gap-2"
                  disabled={isSaving || invoices.length === 0}
                >
                  {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <CalendarClock size={16} />}
                  Generar Quedan Consolidado
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* PANEL DERECHO: HISTORIAL Y CONTROL DE VENCIMIENTOS */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-3 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
              <Input
                placeholder="Buscar por No. Quedan, proveedor, NIT o No. Factura..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs bg-background"
              />
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              {(
                [
                  { id: 'all', label: 'Todos' },
                  { id: 'PENDIENTE', label: 'Pendientes' },
                  { id: 'VENCIDO', label: 'Vencidos' },
                  { id: 'PAGADO', label: 'Pagados' }
                ] as const
              ).map((f) => (
                <Button
                  key={f.id}
                  size="sm"
                  variant={statusFilter === f.id ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(f.id)}
                  className="h-8 text-[11px] px-2.5 rounded-lg"
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          <Card className="bg-card border-border rounded-2xl overflow-hidden shadow-sm">
            <ScrollArea className="h-[640px]">
              <Table>
                <TableHeader className="bg-muted/40 sticky top-0 z-10 border-b border-border">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold uppercase px-4">Quedan & Proveedor</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-center">Vencimiento</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-right">Neto a Pagar</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-center">Estado</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-right px-4">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20 text-xs text-muted-foreground">
                        <Loader2 className="animate-spin mx-auto mb-2 text-purple-600 h-5 w-5" />
                        Sincronizando historial de Quedan...
                      </TableCell>
                    </TableRow>
                  ) : filteredQuedans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic text-xs">
                        No hay Quedan que coincidan con los filtros.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredQuedans.map((q) => {
                      const days = getDaysUntilDue(q.dueDate);
                      const isOverdue = q.status === 'PENDIENTE' && days < 0;
                      const isSoon = q.status === 'PENDIENTE' && days >= 0 && days <= 7;

                      return (
                        <TableRow
                          key={q.id}
                          onClick={() => {
                            setSelectedQuedan(q);
                            setPaymentRefInput(q.meta.paymentReference || '');
                          }}
                          className="hover:bg-muted/30 border-b border-border/60 cursor-pointer"
                        >
                          <TableCell className="px-4 py-3.5">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-black text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                                  {q.meta.quedanNumber}
                                </span>
                                <span className="font-bold text-foreground text-xs">{q.supplier}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                                <span>{q.meta.paymentMethod}</span>
                                <span>•</span>
                                <span>{q.invoices.length} doc(s):</span>
                                {q.invoices.slice(0, 3).map((inv, idx) => (
                                  <Badge key={`${inv.number}-${idx}`} variant="outline" className="text-[9px] font-mono h-4 px-1">
                                    {inv.number}
                                  </Badge>
                                ))}
                                {q.invoices.length > 3 && <span className="text-[9px]">+{q.invoices.length - 3}</span>}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-xs font-mono font-bold text-foreground">{q.dueDate}</span>
                              {q.status === 'PENDIENTE' && (
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    isOverdue
                                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                      : isSoon
                                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                      : 'bg-muted text-muted-foreground'
                                  }`}
                                >
                                  {isOverdue ? `Vencido (${Math.abs(days)}d)` : days === 0 ? 'Vence hoy' : `En ${days} días`}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="font-mono font-black text-sm text-foreground">${q.meta.netPayable.toFixed(2)}</div>
                            {q.meta.retentionAmount > 0 && (
                              <div className="text-[9px] text-amber-600 dark:text-amber-400 font-mono">
                                Ret. 1%: -${q.meta.retentionAmount.toFixed(2)}
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full ${
                                q.status === 'PAGADO'
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                                  : isOverdue
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              }`}
                            >
                              {q.status === 'PAGADO' ? <CheckCircle2 size={10} className="mr-1" /> : <Clock size={10} className="mr-1" />}
                              {q.status}
                            </Badge>
                          </TableCell>

                          <TableCell className="px-4 text-right">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Ver detalle"
                                onClick={() => {
                                  setSelectedQuedan(q);
                                  setPaymentRefInput(q.meta.paymentReference || '');
                                }}
                                className="h-7 w-7 text-indigo-500"
                              >
                                <Eye size={13} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Imprimir Comprobante Quedan"
                                onClick={() => printOfficialQuedan(q, companyProfile)}
                                className="h-7 w-7 text-purple-600 dark:text-purple-400"
                              >
                                <Printer size={13} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Eliminar"
                                onClick={() => handleDeleteQuedan(q)}
                                className="h-7 w-7 text-rose-500 hover:bg-rose-500/10"
                              >
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </div>
      </div>

      {/* MODAL DETALLE 360° DEL QUEDAN + LIQUIDACIÓN */}
      <Dialog open={!!selectedQuedan} onOpenChange={(open) => !open && setSelectedQuedan(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
          {selectedQuedan && (
            <>
              <DialogHeader className="border-b border-border pb-3">
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle className="text-base font-bold flex items-center gap-2">
                    <FileText size={17} className="text-purple-500" />
                    Quedan {selectedQuedan.meta.quedanNumber}
                  </DialogTitle>
                  <Badge
                    className={
                      selectedQuedan.status === 'PAGADO'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-500 text-white'
                    }
                  >
                    {selectedQuedan.status}
                  </Badge>
                </div>
                <DialogDescription className="text-xs">
                  {selectedQuedan.supplier} • Recepción: {selectedQuedan.meta.receptionDate} • Pago programado: {selectedQuedan.dueDate}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-muted/30 border border-border">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">NIT / NRC</div>
                    <div className="font-mono font-semibold mt-0.5">
                      {selectedQuedan.meta.supplierNit || '—'} / {selectedQuedan.meta.supplierNrc || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Forma de Pago</div>
                    <div className="font-semibold mt-0.5">{selectedQuedan.meta.paymentMethod}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Banco / Cuenta</div>
                    <div className="font-semibold mt-0.5">{selectedQuedan.meta.bankAccount || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Recibido por</div>
                    <div className="font-semibold mt-0.5 truncate">{selectedQuedan.meta.receivedBy || '—'}</div>
                  </div>
                </div>

                {/* Tabla de facturas */}
                <div className="border border-border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40 text-[10px]">
                      <TableRow>
                        <TableHead className="w-16 text-center">Tipo</TableHead>
                        <TableHead>No. Documento</TableHead>
                        <TableHead className="text-center">Fecha Doc.</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedQuedan.invoices.map((inv, idx) => (
                        <TableRow key={`${inv.number}-${idx}`} className="text-xs">
                          <TableCell className="text-center font-bold">{inv.docType || 'CCF'}</TableCell>
                          <TableCell className="font-mono">{inv.number}</TableCell>
                          <TableCell className="text-center">{inv.invoiceDate || '—'}</TableCell>
                          <TableCell className="text-right font-mono font-bold">${Number(inv.amount || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Totales */}
                <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1 max-w-xs ml-auto">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Facturas:</span>
                    <span className="font-mono">${selectedQuedan.totalAmount.toFixed(2)}</span>
                  </div>
                  {selectedQuedan.meta.retentionAmount > 0 && (
                    <div className="flex justify-between text-amber-600 dark:text-amber-400 font-semibold">
                      <span>Retención 1% IVA:</span>
                      <span className="font-mono">-${selectedQuedan.meta.retentionAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 border-t border-border font-black text-sm text-purple-700 dark:text-purple-400">
                    <span>Neto a Pagar:</span>
                    <span className="font-mono">${selectedQuedan.meta.netPayable.toFixed(2)}</span>
                  </div>
                </div>

                {selectedQuedan.meta.notes && (
                  <div className="p-3 rounded-xl bg-muted/20 border border-border">
                    <strong>Observaciones:</strong> {selectedQuedan.meta.notes}
                  </div>
                )}

                {selectedQuedan.status === 'PENDIENTE' && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                      Referencia de Pago (No. Cheque / Transferencia) para Liquidar
                    </Label>
                    <Input
                      placeholder="Ej. Transferencia BAC #998821 o Cheque #00412"
                      value={paymentRefInput}
                      onChange={(e) => setPaymentRefInput(e.target.value)}
                      className="h-9 text-xs bg-background"
                    />
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => printOfficialQuedan(selectedQuedan, companyProfile)}
                  className="gap-1.5 text-xs"
                >
                  <Printer size={14} /> Imprimir Comprobante
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleMarkPaidOrPending(selectedQuedan, paymentRefInput)}
                  className={`gap-1.5 text-xs font-bold text-white ${
                    selectedQuedan.status === 'PENDIENTE'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  <CheckCircle2 size={14} />
                  {selectedQuedan.status === 'PENDIENTE' ? 'Marcar como Pagado' : 'Reabrir como Pendiente'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
