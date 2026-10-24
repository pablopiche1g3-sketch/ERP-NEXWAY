'use client';

import React, { useState, useMemo } from 'react';
import { 
  FileSearch, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Download, 
  Eye, 
  Printer, 
  RefreshCw, 
  ShoppingCart, 
  Truck, 
  DollarSign, 
  BookOpen, 
  Plus, 
  Layers, 
  Check, 
  ArrowUpRight, 
  ArrowDownLeft, 
  User, 
  Building,
  HelpCircle,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { postDoubleEntryJournal, JournalLineItem } from '@/lib/accounting-journal';

export interface AuditRecord {
  id: string;
  sourceType: 'SALE' | 'PURCHASE' | 'EXPENSE' | 'MANUAL';
  sourceTitle: string;
  sourceDocNumber: string;
  docType?: string;
  timestamp: string;
  thirdPartyName: string;
  thirdPartyTaxId?: string;
  thirdPartyNrc?: string;
  paymentMethod?: string;
  amount: number;
  branchName?: string;
  items?: any[];
  // Datos contables
  hasJournalEntry: boolean;
  journalId?: string;
  journalDescription?: string;
  lines: Array<{
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
  }>;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  balanceDiff: number;
  status: 'CUADRADA' | 'DESCUADRADA' | 'PENDIENTE';
  rawRecord: any;
}

interface ManualAuditTabProps {
  sales: any[];
  purchases: any[];
  journal: any[];
  branches?: any[];
  catalog: Array<{ code: string; name: string; group: string }>;
  onRefresh: () => Promise<void> | void;
  onOpenNewManualEntry?: (initialData?: any) => void;
  toast: (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;
  settings?: {
    taxProfile?: string;
    ivaRate?: number;
  };
}

export default function ManualAuditTab({
  sales,
  purchases,
  journal,
  branches = [],
  catalog,
  onRefresh,
  onOpenNewManualEntry,
  toast,
  settings
}: ManualAuditTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'SALE' | 'PURCHASE' | 'EXPENSE' | 'MANUAL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CUADRADA' | 'DESCUADRADA' | 'PENDIENTE'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPostingAuto, setIsPostingAuto] = useState<string | null>(null);

  // Modal de Inspección 360°
  const [selectedAuditRecord, setSelectedAuditRecord] = useState<AuditRecord | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState<'general' | 'voucher' | 'items'>('general');

  // Mapa rápido de catálogo de cuentas
  const catalogMap = useMemo(() => {
    const map = new Map<string, string>();
    catalog.forEach(c => map.set(c.code, c.name));
    return map;
  }, [catalog]);

  // Consolidación de transacciones auditables
  const auditRecords = useMemo<AuditRecord[]>(() => {
    const records: AuditRecord[] = [];
    const claimedJournalIds = new Set<string>();

    // 1. Audit Ventas (POS / DTE)
    (sales || []).forEach(sale => {
      // Buscar partida vinculada en journal
      const matchedJournal = (journal || []).find(j => {
        if (claimedJournalIds.has(j.id)) return false;
        const desc = (j.description || '').toLowerCase();
        const saleRef = (sale.correlative || sale.id || '').toLowerCase();
        const shortId = (sale.id || '').slice(0, 8).toLowerCase();
        
        return desc.includes(saleRef) || (shortId && desc.includes(shortId));
      });

      if (matchedJournal) {
        claimedJournalIds.add(matchedJournal.id);
      }

      let lines = matchedJournal?.lines || [];
      if (lines.length === 0 && !matchedJournal) {
        // Generar líneas simuladas esperadas para visualización del contador
        const total = sale.total || 0;
        const net = total / 1.13;
        const iva = total - net;
        const isCCF = sale.docType === 'CCF';
        const hasRetention = isCCF && net >= 100 && settings?.taxProfile === 'Gran Contribuyente';
        const retention = hasRetention ? net * 0.01 : 0;
        const cashAmount = total - retention;

        lines = [
          {
            accountCode: sale.paymentMethod === 'TARJETA' ? '1102' : '1101',
            accountName: sale.paymentMethod === 'TARJETA' ? 'Bancos e Instituciones Financieras' : 'Efectivo y Equivalentes de Efectivo',
            debit: cashAmount,
            credit: 0
          },
          ...(hasRetention ? [{
            accountCode: '2103',
            accountName: 'Retenciones de IVA por Cobrar/Pagar (1%)',
            debit: retention,
            credit: 0
          }] : []),
          {
            accountCode: '4101',
            accountName: 'Ventas de Mercadería Gravadas',
            debit: 0,
            credit: net
          },
          {
            accountCode: '2102',
            accountName: 'IVA Débito Fiscal (13%)',
            debit: 0,
            credit: iva
          }
        ];
      }

      const totalDebit = lines.reduce((acc: number, l: any) => acc + (Number(l.debit) || 0), 0);
      const totalCredit = lines.reduce((acc: number, l: any) => acc + (Number(l.credit) || 0), 0);
      const balanceDiff = Math.abs(totalDebit - totalCredit);
      const isBalanced = balanceDiff < 0.01;

      const branch = (branches || []).find(b => b.id === sale.branchId);

      records.push({
        id: `sale-${sale.id}`,
        sourceType: 'SALE',
        sourceTitle: `Venta POS (${sale.docType || 'Factura'})`,
        sourceDocNumber: sale.correlative ? `#${sale.correlative}` : `#${(sale.id || '').slice(0, 8)}`,
        docType: sale.docType || 'CF',
        timestamp: sale.timestamp || new Date().toISOString(),
        thirdPartyName: sale.customer || 'Consumidor Final',
        thirdPartyTaxId: sale.nit,
        thirdPartyNrc: sale.nrc,
        paymentMethod: sale.paymentMethod || 'EFECTIVO',
        amount: sale.total || 0,
        branchName: branch?.name || 'Casa Matriz',
        items: sale.items || [],
        hasJournalEntry: !!matchedJournal,
        journalId: matchedJournal?.id,
        journalDescription: matchedJournal?.description || `Venta POS ${sale.docType || 'CF'} ${sale.correlative || sale.id?.slice(0, 8)}`,
        lines: lines.map((l: any) => ({
          accountCode: l.accountCode || l.account_code,
          accountName: l.accountName || l.account_name || catalogMap.get(l.accountCode || l.account_code) || 'Cuenta Contable',
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0
        })),
        totalDebit,
        totalCredit,
        isBalanced,
        balanceDiff,
        status: !matchedJournal ? 'PENDIENTE' : isBalanced ? 'CUADRADA' : 'DESCUADRADA',
        rawRecord: sale
      });
    });

    // 2. Audit Compras a Proveedores
    (purchases || []).forEach(p => {
      const matchedJournal = (journal || []).find(j => {
        if (claimedJournalIds.has(j.id)) return false;
        const desc = (j.description || '').toLowerCase();
        const orderRef = (p.orderId || p.id || '').toLowerCase();
        const shortId = (p.id || '').slice(0, 8).toLowerCase();
        return (orderRef && desc.includes(orderRef)) || (shortId && desc.includes(shortId));
      });

      if (matchedJournal) {
        claimedJournalIds.add(matchedJournal.id);
      }

      let lines = matchedJournal?.lines || [];
      if (lines.length === 0 && !matchedJournal) {
        const total = p.total || 0;
        const net = total / 1.13;
        const iva = total - net;

        lines = [
          {
            accountCode: '1105',
            accountName: 'Inventarios de Mercadería',
            debit: net,
            credit: 0
          },
          {
            accountCode: '1104',
            accountName: 'IVA Crédito Fiscal (13%)',
            debit: iva,
            credit: 0
          },
          {
            accountCode: p.paymentMethod === 'CREDITO' ? '2101' : '1101',
            accountName: p.paymentMethod === 'CREDITO' ? 'Proveedores Locales C/P' : 'Efectivo y Equivalentes de Efectivo',
            debit: 0,
            credit: total
          }
        ];
      }

      const totalDebit = lines.reduce((acc: number, l: any) => acc + (Number(l.debit) || 0), 0);
      const totalCredit = lines.reduce((acc: number, l: any) => acc + (Number(l.credit) || 0), 0);
      const balanceDiff = Math.abs(totalDebit - totalCredit);
      const isBalanced = balanceDiff < 0.01;

      records.push({
        id: `purchase-${p.id}`,
        sourceType: 'PURCHASE',
        sourceTitle: `Compra a Proveedor`,
        sourceDocNumber: p.orderId ? `OC #${p.orderId}` : `FAC #${(p.id || '').slice(0, 8)}`,
        docType: 'CCF_PROV',
        timestamp: p.timestamp || new Date().toISOString(),
        thirdPartyName: p.supplier || 'Proveedor Local',
        thirdPartyTaxId: p.nit,
        thirdPartyNrc: p.nrc,
        paymentMethod: p.paymentMethod || 'CONTADO',
        amount: p.total || 0,
        branchName: 'Almacén Central',
        items: p.items || [],
        hasJournalEntry: !!matchedJournal,
        journalId: matchedJournal?.id,
        journalDescription: matchedJournal?.description || `Compra a Proveedor ${p.supplier} (OC: ${p.orderId || p.id?.slice(0, 8)})`,
        lines: lines.map((l: any) => ({
          accountCode: l.accountCode || l.account_code,
          accountName: l.accountName || l.account_name || catalogMap.get(l.accountCode || l.account_code) || 'Cuenta Contable',
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0
        })),
        totalDebit,
        totalCredit,
        isBalanced,
        balanceDiff,
        status: !matchedJournal ? 'PENDIENTE' : isBalanced ? 'CUADRADA' : 'DESCUADRADA',
        rawRecord: p
      });
    });

    // 3. Partidas de Diario Restantes (Manuales, Caja Chica, Egresos, Cierres de Caja)
    (journal || []).forEach(j => {
      if (claimedJournalIds.has(j.id)) return;

      const desc = j.description || '';
      const isExpense = j.type === 'Egreso' || desc.toLowerCase().includes('caja chica') || desc.toLowerCase().includes('gasto');
      
      let lines = j.lines || [];
      if (lines.length === 0) {
        if (j.type === 'Egreso') {
          lines = [
            { accountCode: '6101', accountName: 'Gastos de Administración', debit: j.amount, credit: 0 },
            { accountCode: '1101', accountName: 'Efectivo y Equivalentes de Efectivo', debit: 0, credit: j.amount }
          ];
        } else if (j.type === 'Ingreso') {
          lines = [
            { accountCode: '1101', accountName: 'Efectivo y Equivalentes de Efectivo', debit: j.amount, credit: 0 },
            { accountCode: '4101', accountName: 'Ventas de Mercadería Gravadas', debit: 0, credit: j.amount }
          ];
        }
      }

      const totalDebit = lines.reduce((acc: number, l: any) => acc + (Number(l.debit) || 0), 0);
      const totalCredit = lines.reduce((acc: number, l: any) => acc + (Number(l.credit) || 0), 0);
      const balanceDiff = Math.abs(totalDebit - totalCredit);
      const isBalanced = balanceDiff < 0.01;

      records.push({
        id: `journal-${j.id}`,
        sourceType: isExpense ? 'EXPENSE' : 'MANUAL',
        sourceTitle: isExpense ? 'Gasto / Caja Chica' : 'Partida de Diario Manual',
        sourceDocNumber: `ASIENTO #${(j.id || '').slice(0, 8)}`,
        docType: j.type || 'Avanzado',
        timestamp: j.timestamp || new Date().toISOString(),
        thirdPartyName: isExpense ? 'Responsable Caja / Proveedor' : 'Contabilidad Interna',
        amount: j.amount || 0,
        hasJournalEntry: true,
        journalId: j.id,
        journalDescription: j.description || 'Partida de ajuste contable',
        lines: lines.map((l: any) => ({
          accountCode: l.accountCode || l.account_code,
          accountName: l.accountName || l.account_name || catalogMap.get(l.accountCode || l.account_code) || 'Cuenta Contable',
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0
        })),
        totalDebit,
        totalCredit,
        isBalanced,
        balanceDiff,
        status: isBalanced ? 'CUADRADA' : 'DESCUADRADA',
        rawRecord: j
      });
    });

    // Ordenar de más reciente a más antiguo
    return records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [sales, purchases, journal, branches, catalogMap, settings]);

  // Filtrado reactivo en memoria
  const filteredRecords = useMemo(() => {
    return auditRecords.filter(r => {
      // Filtro de Módulo/Origen
      if (sourceFilter !== 'ALL' && r.sourceType !== sourceFilter) return false;

      // Filtro de Estado
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;

      // Filtro por Fecha
      if (startDate) {
        const itemDate = r.timestamp.slice(0, 10);
        if (itemDate < startDate) return false;
      }
      if (endDate) {
        const itemDate = r.timestamp.slice(0, 10);
        if (itemDate > endDate) return false;
      }

      // Filtro de búsqueda textual
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesDoc = r.sourceDocNumber.toLowerCase().includes(term);
        const matchesParty = r.thirdPartyName.toLowerCase().includes(term);
        const matchesDesc = (r.journalDescription || '').toLowerCase().includes(term);
        const matchesType = r.sourceTitle.toLowerCase().includes(term);
        const matchesAccount = r.lines.some(l => 
          l.accountCode.toLowerCase().includes(term) || 
          l.accountName.toLowerCase().includes(term)
        );

        if (!matchesDoc && !matchesParty && !matchesDesc && !matchesType && !matchesAccount) {
          return false;
        }
      }

      return true;
    });
  }, [auditRecords, sourceFilter, statusFilter, startDate, endDate, searchTerm]);

  // Contadores y KPIs
  const stats = useMemo(() => {
    const total = auditRecords.length;
    const cuadradas = auditRecords.filter(r => r.status === 'CUADRADA').length;
    const descuadradas = auditRecords.filter(r => r.status === 'DESCUADRADA').length;
    const pendientes = auditRecords.filter(r => r.status === 'PENDIENTE').length;
    const sumDebe = auditRecords.reduce((acc, r) => acc + r.totalDebit, 0);
    const sumHaber = auditRecords.reduce((acc, r) => acc + r.totalCredit, 0);

    return { total, cuadradas, descuadradas, pendientes, sumDebe, sumHaber };
  }, [auditRecords]);

  // Manejador de Refresco
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
      toast({
        title: 'Auditoría Sincronizada',
        description: 'Se han recargado todas las transacciones y partidas contables.'
      });
    } catch (e: any) {
      toast({
        title: 'Error al sincronizar',
        description: e.message || 'No se pudieron recargar los datos.',
        variant: 'destructive'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Asentar automáticamente una transacción pendiente
  const handleAutoPostJournal = async (record: AuditRecord) => {
    if (record.hasJournalEntry) {
      toast({
        title: 'Ya asentada',
        description: 'Esta transacción ya cuenta con una partida de diario registrada.'
      });
      return;
    }

    setIsPostingAuto(record.id);
    try {
      const result = await postDoubleEntryJournal({
        description: record.journalDescription || `${record.sourceTitle} - ${record.thirdPartyName}`,
        amount: record.amount,
        type: 'Avanzado',
        lines: record.lines.map(l => ({
          account_code: l.accountCode,
          account_name: l.accountName,
          debit: l.debit,
          credit: l.credit
        })),
        createdAt: record.timestamp
      });

      if (result.success) {
        toast({
          title: 'Partida Asentada con Éxito',
          description: `Se registró el comprobante de diario para ${record.sourceDocNumber} de forma balanceada.`
        });
        await onRefresh();
        if (selectedAuditRecord?.id === record.id) {
          setSelectedAuditRecord(prev => prev ? { ...prev, hasJournalEntry: true, status: 'CUADRADA' } : null);
        }
      } else {
        toast({
          title: 'Error al asentar',
          description: 'No se pudo guardar la partida contable.',
          variant: 'destructive'
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error en proceso contable',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setIsPostingAuto(null);
    }
  };

  // Exportar auditoría a CSV
  const handleExportCSV = () => {
    const headers = [
      'No',
      'Fecha',
      'Modulo/Origen',
      'Documento',
      'Tercero',
      'Monto Transaccion',
      'Partida Contable ID',
      'Descripcion Partida',
      'Total Debe',
      'Total Haber',
      'Diferencia',
      'Estado Cuadre',
      'Desglose Cuentas'
    ];

    const rows = filteredRecords.map((r, idx) => {
      const cuentasStr = r.lines
        .map(l => `[${l.accountCode} ${l.accountName} | D:$${l.debit.toFixed(2)} H:$${l.credit.toFixed(2)}]`)
        .join('; ');

      return [
        (idx + 1).toString(),
        new Date(r.timestamp).toLocaleString(),
        r.sourceTitle,
        r.sourceDocNumber,
        r.thirdPartyName,
        r.amount.toFixed(2),
        r.journalId || 'SIN ASENTAR',
        r.journalDescription || '',
        r.totalDebit.toFixed(2),
        r.totalCredit.toFixed(2),
        r.balanceDiff.toFixed(2),
        r.status,
        cuentasStr
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.map(val => `"${(val || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Auditoria_Contable_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Auditoría Exportada',
      description: 'El archivo CSV detallado se ha descargado correctamente.'
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* HEADER DE AUDITORÍA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card border-border shadow-sm p-6 rounded-2xl border border-slate-100 dark:border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
              <FileSearch size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-foreground">Auditoría & Revisión Manual de Operaciones</h2>
              <p className="text-xs text-muted-foreground">
                Inspeccione manualmente cada venta, compra, arqueo y partida contable con su trazabilidad de partida doble (Debe/Haber).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="rounded-xl text-xs h-9 font-bold border-slate-200 dark:border-border"
          >
            <RefreshCw size={14} className={`mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExportCSV}
            className="rounded-xl text-xs h-9 font-bold border-slate-200 dark:border-border"
          >
            <Download size={14} className="mr-1.5" />
            Exportar CSV
          </Button>

          {onOpenNewManualEntry && (
            <Button 
              size="sm" 
              onClick={() => onOpenNewManualEntry()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs h-9 font-bold shadow-md shadow-indigo-200 dark:shadow-none"
            >
              <Plus size={14} className="mr-1.5" />
              Nueva Partida Manual
            </Button>
          )}
        </div>
      </div>

      {/* KPI METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-sm rounded-2xl p-4 border border-slate-100 dark:border-border">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Total Operaciones</span>
            <Badge variant="secondary" className="text-[9px] font-bold">100%</Badge>
          </div>
          <p className="text-2xl font-black text-foreground">{stats.total}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Ventas, compras y diarios</p>
        </Card>

        <Card className="bg-card border-border shadow-sm rounded-2xl p-4 border border-slate-100 dark:border-border">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">Cuadradas</span>
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.cuadradas}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Debe == Haber ($0.00 diff)</p>
        </Card>

        <Card className="bg-card border-border shadow-sm rounded-2xl p-4 border border-slate-100 dark:border-border">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">Pendientes de Partida</span>
            <Clock size={16} className="text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.pendientes}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Listas para auto-asentar</p>
        </Card>

        <Card className="bg-card border-border shadow-sm rounded-2xl p-4 border border-slate-100 dark:border-border">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Volumen Asentado</span>
            <Layers size={16} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">${stats.sumDebe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Total movilizado en el período</p>
        </Card>
      </div>

      {/* BARRA DE FILTROS */}
      <Card className="bg-card border-border shadow-sm rounded-2xl p-4 border border-slate-100 dark:border-border space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Búsqueda textual */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <Input 
              placeholder="Buscar por DTE, cliente, proveedor, descripción, cuenta (ej. 1101)..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 text-xs bg-card border-border shadow-sm rounded-xl"
            />
          </div>

          {/* Filtro por Módulo / Origen */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-bold whitespace-nowrap">Origen:</span>
            <Select value={sourceFilter} onValueChange={(val: any) => setSourceFilter(val)}>
              <SelectTrigger className="w-40 h-10 text-xs rounded-xl bg-card border-border shadow-sm">
                <SelectValue placeholder="Módulo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los Orígenes</SelectItem>
                <SelectItem value="SALE">Ventas POS / DTE</SelectItem>
                <SelectItem value="PURCHASE">Compras Proveedor</SelectItem>
                <SelectItem value="EXPENSE">Caja Chica / Egresos</SelectItem>
                <SelectItem value="MANUAL">Partidas Manuales</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Estado de Cuadre */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-bold whitespace-nowrap">Estado:</span>
            <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
              <SelectTrigger className="w-36 h-10 text-xs rounded-xl bg-card border-border shadow-sm">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="CUADRADA">Cuadradas ✅</SelectItem>
                <SelectItem value="PENDIENTE">Pendientes ⚠️</SelectItem>
                <SelectItem value="DESCUADRADA">Descuadradas ❌</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Rango de Fechas */}
          <div className="flex items-center gap-2">
            <Input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 text-xs rounded-xl w-36 bg-card border-border shadow-sm"
            />
            <span className="text-xs text-muted-foreground">a</span>
            <Input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10 text-xs rounded-xl w-36 bg-card border-border shadow-sm"
            />
            {(startDate || endDate || searchTerm || sourceFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setSearchTerm('');
                  setSourceFilter('ALL');
                  setStatusFilter('ALL');
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-xs h-9 rounded-xl text-muted-foreground hover:text-foreground"
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* TABLA PRINCIPAL DE AUDITORÍA */}
      <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden border border-slate-100 dark:border-border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/70 dark:bg-muted/50 border-b border-slate-100 dark:border-border">
              <TableRow>
                <TableHead className="px-5 py-4 text-[10px] font-black uppercase text-muted-foreground tracking-wider">Fecha & Hora</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Módulo / Referencia</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Tercero (Cliente / Proveedor)</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Cuentas Afectadas (Debe / Haber)</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-wider text-right">Total Transacción</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-wider text-center">Estado Auditoría</TableHead>
                <TableHead className="px-5 py-4 text-[10px] font-black uppercase text-muted-foreground tracking-wider text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-muted-foreground text-xs italic">
                    No se encontraron transacciones con los filtros seleccionados.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => {
                  return (
                    <TableRow key={record.id} className="hover:bg-slate-50/50 dark:hover:bg-muted/20 border-b border-slate-100 dark:border-border/60">
                      {/* Fecha */}
                      <TableCell className="px-5 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        <span className="font-semibold block text-foreground">{new Date(record.timestamp).toLocaleDateString()}</span>
                        <span className="text-[10px]">{new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </TableCell>

                      {/* Origen & Documento */}
                      <TableCell className="py-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          {record.sourceType === 'SALE' && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900 text-[8px] font-black px-1.5 py-0 h-4 uppercase">
                              <ShoppingCart size={9} className="mr-1" /> VENTA
                            </Badge>
                          )}
                          {record.sourceType === 'PURCHASE' && (
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900 text-[8px] font-black px-1.5 py-0 h-4 uppercase">
                              <Truck size={9} className="mr-1" /> COMPRA
                            </Badge>
                          )}
                          {record.sourceType === 'EXPENSE' && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900 text-[8px] font-black px-1.5 py-0 h-4 uppercase">
                              <DollarSign size={9} className="mr-1" /> EGRESO
                            </Badge>
                          )}
                          {record.sourceType === 'MANUAL' && (
                            <Badge variant="outline" className="bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 text-[8px] font-black px-1.5 py-0 h-4 uppercase">
                              <BookOpen size={9} className="mr-1" /> MANUAL
                            </Badge>
                          )}
                          <span className="font-mono text-xs font-bold text-foreground">{record.sourceDocNumber}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground block line-clamp-1">{record.journalDescription}</span>
                      </TableCell>

                      {/* Tercero */}
                      <TableCell className="py-3">
                        <div className="flex items-center gap-1.5">
                          <User size={12} className="text-muted-foreground flex-shrink-0" />
                          <span className="text-xs font-semibold text-foreground line-clamp-1">{record.thirdPartyName}</span>
                        </div>
                        {record.paymentMethod && (
                          <span className="text-[9px] text-muted-foreground font-mono uppercase block mt-0.5">
                            Pago: {record.paymentMethod}
                          </span>
                        )}
                      </TableCell>

                      {/* Cuentas Afectadas & Debe/Haber */}
                      <TableCell className="py-3 max-w-xs">
                        <div className="flex flex-wrap gap-1 mb-1">
                          {record.lines.slice(0, 3).map((l, i) => (
                            <span 
                              key={i} 
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                                l.debit > 0 
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                                  : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                              }`}
                              title={`${l.accountCode} - ${l.accountName}`}
                            >
                              {l.accountCode} {l.debit > 0 ? `+$${l.debit.toFixed(0)}` : `-$${l.credit.toFixed(0)}`}
                            </span>
                          ))}
                          {record.lines.length > 3 && (
                            <span className="text-[9px] text-muted-foreground font-bold px-1 self-center">
                              +{record.lines.length - 3} más
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          D: <span className="font-bold text-foreground">${record.totalDebit.toFixed(2)}</span> | H: <span className="font-bold text-foreground">${record.totalCredit.toFixed(2)}</span>
                        </div>
                      </TableCell>

                      {/* Monto */}
                      <TableCell className="py-3 text-right">
                        <span className="text-xs font-black text-foreground">${record.amount.toFixed(2)}</span>
                      </TableCell>

                      {/* Estado */}
                      <TableCell className="py-3 text-center">
                        {record.status === 'CUADRADA' && (
                          <Badge className="bg-emerald-500/15 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[9px] font-black h-5 uppercase">
                            <Check size={10} className="mr-1" /> Cuadrada
                          </Badge>
                        )}
                        {record.status === 'PENDIENTE' && (
                          <Badge variant="outline" className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[9px] font-black h-5 uppercase">
                            <Clock size={10} className="mr-1" /> Sin Asentar
                          </Badge>
                        )}
                        {record.status === 'DESCUADRADA' && (
                          <Badge variant="destructive" className="text-[9px] font-black h-5 uppercase">
                            <AlertCircle size={10} className="mr-1" /> Dif: ${record.balanceDiff.toFixed(2)}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              setSelectedAuditRecord(record);
                              setModalActiveTab('general');
                            }}
                            className="h-7 px-2 text-[10px] font-bold rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400"
                          >
                            <Eye size={12} className="mr-1" />
                            Auditar
                          </Button>

                          {record.status === 'PENDIENTE' && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              disabled={isPostingAuto === record.id}
                              onClick={() => handleAutoPostJournal(record)}
                              className="h-7 px-2 text-[10px] font-bold rounded-lg border-amber-300 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                            >
                              {isPostingAuto === record.id ? 'Asentando...' : 'Asentar'}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ========================================== */}
      {/* MODAL DE INSPECCIÓN 360° DE AUDITORÍA */}
      {/* ========================================== */}
      <Dialog open={selectedAuditRecord !== null} onOpenChange={() => setSelectedAuditRecord(null)}>
        {selectedAuditRecord && (
          <DialogContent className="max-w-3xl rounded-2xl bg-card border-border shadow-sm border-slate-100 dark:border-border text-foreground overflow-y-auto max-h-[90vh]">
            <DialogHeader className="border-b pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                    <FileSearch size={18} />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-black text-foreground">
                      Expediente de Auditoría: {selectedAuditRecord.sourceDocNumber}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      Detalle de la transacción original y su partida de diario contable de doble entrada.
                    </DialogDescription>
                  </div>
                </div>

                <Badge className={`text-[10px] font-black h-6 uppercase ${
                  selectedAuditRecord.status === 'CUADRADA' 
                    ? 'bg-emerald-500 text-white' 
                    : selectedAuditRecord.status === 'PENDIENTE' 
                      ? 'bg-amber-500 text-white' 
                      : 'bg-rose-500 text-white'
                }`}>
                  {selectedAuditRecord.status === 'CUADRADA' && <Check size={11} className="mr-1" />}
                  {selectedAuditRecord.status}
                </Badge>
              </div>
            </DialogHeader>

            <Tabs value={modalActiveTab} onValueChange={(val: any) => setModalActiveTab(val)} className="space-y-4 pt-2">
              <TabsList className="bg-slate-100 dark:bg-muted p-1 rounded-xl">
                <TabsTrigger value="general" className="rounded-lg text-xs font-bold">
                  Resumen Comercial / Fiscal
                </TabsTrigger>
                <TabsTrigger value="voucher" className="rounded-lg text-xs font-bold">
                  Partida Contable (Doble Entrada)
                </TabsTrigger>
                {selectedAuditRecord.items && selectedAuditRecord.items.length > 0 && (
                  <TabsTrigger value="items" className="rounded-lg text-xs font-bold">
                    Ítems / Detalle ({selectedAuditRecord.items.length})
                  </TabsTrigger>
                )}
              </TabsList>

              {/* TAB 1: RESUMEN COMERCIAL */}
              <TabsContent value="general" className="space-y-4 outline-none">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-muted/30 rounded-xl border border-slate-100 dark:border-border">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Módulo de Origen</span>
                    <span className="text-xs font-black text-foreground">{selectedAuditRecord.sourceTitle}</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-muted/30 rounded-xl border border-slate-100 dark:border-border">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Fecha & Hora</span>
                    <span className="text-xs font-black text-foreground">{new Date(selectedAuditRecord.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-muted/30 rounded-xl border border-slate-100 dark:border-border">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Método de Pago</span>
                    <span className="text-xs font-black text-foreground uppercase">{selectedAuditRecord.paymentMethod || 'Efectivo'}</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-muted/30 rounded-xl border border-slate-100 dark:border-border col-span-2">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Cliente / Proveedor</span>
                    <span className="text-xs font-black text-foreground">{selectedAuditRecord.thirdPartyName}</span>
                    {(selectedAuditRecord.thirdPartyTaxId || selectedAuditRecord.thirdPartyNrc) && (
                      <span className="text-[10px] text-muted-foreground font-mono block mt-0.5">
                        NIT: {selectedAuditRecord.thirdPartyTaxId || 'N/A'} | NRC: {selectedAuditRecord.thirdPartyNrc || 'N/A'}
                      </span>
                    )}
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-muted/30 rounded-xl border border-slate-100 dark:border-border">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Sucursal / Ubicación</span>
                    <span className="text-xs font-black text-foreground">{selectedAuditRecord.branchName || 'Casa Matriz'}</span>
                  </div>
                </div>

                {/* Desglose Monetario Fiscal */}
                <Card className="bg-slate-50/50 dark:bg-muted/20 border border-slate-200 dark:border-border rounded-xl p-4">
                  <h4 className="text-xs font-bold text-foreground mb-3 uppercase tracking-wider">Desglose Impositivo (IVA El Salvador 13%)</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase block">Gravado Neto</span>
                      <span className="text-sm font-black text-foreground font-mono">
                        ${(selectedAuditRecord.amount / 1.13).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase block">IVA 13%</span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        ${(selectedAuditRecord.amount - (selectedAuditRecord.amount / 1.13)).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase block">Retención 1%</span>
                      <span className="text-sm font-black text-muted-foreground font-mono">
                        $0.00
                      </span>
                    </div>
                    <div className="border-l border-slate-200 dark:border-border pl-2">
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase block">Total Transacción</span>
                      <span className="text-base font-black text-foreground font-mono">
                        ${selectedAuditRecord.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* TAB 2: PARTIDA CONTABLE (VOUCHER) */}
              <TabsContent value="voucher" className="space-y-4 outline-none">
                <div className="p-3 bg-slate-50 dark:bg-muted/30 rounded-xl border border-slate-100 dark:border-border flex justify-between items-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Concepto / Glosa de la Partida</span>
                    <span className="text-xs font-bold text-foreground">{selectedAuditRecord.journalDescription}</span>
                  </div>
                  {selectedAuditRecord.journalId && (
                    <Badge variant="outline" className="font-mono text-[9px]">
                      ID: {selectedAuditRecord.journalId.slice(0, 8)}
                    </Badge>
                  )}
                </div>

                <div className="border border-slate-200 dark:border-border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-100 dark:bg-muted/60">
                      <TableRow className="h-8">
                        <TableHead className="w-24 text-[10px] uppercase font-black py-1">Código</TableHead>
                        <TableHead className="text-[10px] uppercase font-black py-1">Nombre de la Cuenta (Catálogo MH)</TableHead>
                        <TableHead className="w-28 text-[10px] uppercase font-black py-1 text-right">Debe ($)</TableHead>
                        <TableHead className="w-28 text-[10px] uppercase font-black py-1 text-right">Haber ($)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedAuditRecord.lines.map((line, idx) => (
                        <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-muted/20">
                          <TableCell className="py-2.5 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                            {line.accountCode}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs font-semibold text-foreground">
                            {line.accountName}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs font-mono font-bold text-right text-foreground">
                            {line.debit > 0 ? `$${line.debit.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs font-mono font-bold text-right text-foreground">
                            {line.credit > 0 ? `$${line.credit.toFixed(2)}` : '-'}
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Totales */}
                      <TableRow className="bg-slate-100/70 dark:bg-muted/80 font-bold border-t border-slate-300 dark:border-border">
                        <TableCell colSpan={2} className="text-xs uppercase font-black text-foreground">
                          Totales del Asiento Contable:
                        </TableCell>
                        <TableCell className="text-xs font-mono font-black text-right text-foreground">
                          ${selectedAuditRecord.totalDebit.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-xs font-mono font-black text-right text-foreground">
                          ${selectedAuditRecord.totalCredit.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-border text-xs font-bold bg-slate-50 dark:bg-muted/20">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase text-muted-foreground">Diferencia de Balance:</span>
                    <span className={`font-mono ${selectedAuditRecord.isBalanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                      ${selectedAuditRecord.balanceDiff.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    {selectedAuditRecord.isBalanced ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[11px]">
                        <CheckCircle2 size={13} /> Partida Cuadrada según Principios Contables
                      </span>
                    ) : (
                      <span className="text-rose-600 flex items-center gap-1 text-[11px]">
                        <AlertCircle size={13} /> Asiento Descuadrado
                      </span>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* TAB 3: ÍTEMS */}
              {selectedAuditRecord.items && selectedAuditRecord.items.length > 0 && (
                <TabsContent value="items" className="space-y-4 outline-none">
                  <div className="border border-slate-200 dark:border-border rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-100 dark:bg-muted/60">
                        <TableRow className="h-8">
                          <TableHead className="text-[10px] uppercase font-black py-1">Ítem / Producto</TableHead>
                          <TableHead className="w-20 text-[10px] uppercase font-black py-1 text-center">Cant.</TableHead>
                          <TableHead className="w-24 text-[10px] uppercase font-black py-1 text-right">P. Unitario</TableHead>
                          <TableHead className="w-24 text-[10px] uppercase font-black py-1 text-right">Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedAuditRecord.items.map((item: any, idx: number) => {
                          const qty = Number(item.quantity) || 1;
                          const price = Number(item.price) || 0;
                          const sub = qty * price;
                          return (
                            <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-muted/20">
                              <TableCell className="py-2 text-xs font-semibold text-foreground">
                                {item.name || item.title || item.productName || item.description || `Ítem #${idx + 1}`}
                              </TableCell>
                              <TableCell className="py-2 text-xs text-center text-foreground font-mono">
                                {qty}
                              </TableCell>
                              <TableCell className="py-2 text-xs text-right text-foreground font-mono">
                                ${price.toFixed(2)}
                              </TableCell>
                              <TableCell className="py-2 text-xs text-right text-foreground font-mono font-bold">
                                ${sub.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              )}
            </Tabs>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4 border-t pt-4">
              <Button 
                variant="outline"
                onClick={() => { if (typeof window !== 'undefined') window.print(); }}
                className="rounded-xl text-xs font-bold h-10 border-slate-200 dark:border-border"
              >
                <Printer size={13} className="mr-1.5" />
                Imprimir Voucher
              </Button>

              {!selectedAuditRecord.hasJournalEntry && (
                <Button 
                  onClick={() => handleAutoPostJournal(selectedAuditRecord)}
                  disabled={isPostingAuto === selectedAuditRecord.id}
                  className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold h-10"
                >
                  <Check size={13} className="mr-1.5" />
                  {isPostingAuto === selectedAuditRecord.id ? 'Asentando...' : 'Asentar Partida Contable Ahora'}
                </Button>
              )}

              <Button 
                onClick={() => setSelectedAuditRecord(null)}
                className="bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-bold h-10 flex-1 sm:flex-none"
              >
                Cerrar Expediente
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
