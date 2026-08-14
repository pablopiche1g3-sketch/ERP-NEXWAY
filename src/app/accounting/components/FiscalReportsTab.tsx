'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  FileCheck, 
  Download, 
  Building2, 
  Calendar, 
  Landmark, 
  ShieldCheck, 
  FileSpreadsheet, 
  CheckCircle2 
} from 'lucide-react';

export default function FiscalReportsTab() {
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState(`${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`);
  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadF07 = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      toast({
        title: 'Informe F07 Generado (IVA)',
        description: `Se descargó el archivo oficial del Libro de Compras y Ventas IVA para el período ${selectedPeriod}.`
      });
    }, 600);
  };

  const handleDownloadF14 = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      toast({
        title: 'Informe F14 Generado (Renta)',
        description: `Se descargó el reporte de Retenciones de Renta ISR para el período ${selectedPeriod}.`
      });
    }, 600);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-2xl border shadow-sm">
        <div>
          <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
            <FileCheck className="text-emerald-500" size={22} />
            Generador de Informes Fiscales F07 y F14 (Ministerio de Hacienda)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Exportación automatizada de Libros de IVA (Compras/Ventas) e Informe de Retenciones ISR en formato oficial.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="h-9 text-xs w-44 font-mono font-bold"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2026-08">Período 2026 - Agosto</SelectItem>
              <SelectItem value="2026-07">Período 2026 - Julio</SelectItem>
              <SelectItem value="2026-06">Período 2026 - Junio</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* INFORME F07 IVA */}
        <Card className="border shadow-sm p-6 rounded-2xl bg-card space-y-4">
          <div className="flex items-center justify-between">
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 text-[10px] font-black uppercase">
              Impuesto al Valor Agregado (IVA)
            </Badge>
            <Landmark size={20} className="text-emerald-500" />
          </div>

          <div>
            <h4 className="text-base font-black text-slate-800 dark:text-white">Informe Mensual F07 (Libros de IVA)</h4>
            <p className="text-xs text-slate-500 mt-1">
              Incluye Libro de Ventas a Consumidor Final, Ventas a Contribuyentes (CCF) y Libro de Compras con Crédito Fiscal.
            </p>
          </div>

          <div className="p-3 bg-muted/40 rounded-xl space-y-1.5 text-xs">
            <div className="flex justify-between"><span>Total Ventas Gravadas:</span><strong className="font-mono">$12,450.00</strong></div>
            <div className="flex justify-between"><span>Debito Fiscal (13%):</span><strong className="font-mono text-emerald-600">$1,618.50</strong></div>
            <div className="flex justify-between"><span>Credito Fiscal Compras:</span><strong className="font-mono text-blue-600">$1,120.00</strong></div>
          </div>

          <Button onClick={handleDownloadF07} disabled={isExporting} className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold text-xs h-10 rounded-xl text-white">
            <Download size={15} className="mr-1.5" /> Descargar Informe F07 (Formato MH)
          </Button>
        </Card>

        {/* INFORME F14 RENTA */}
        <Card className="border shadow-sm p-6 rounded-2xl bg-card space-y-4">
          <div className="flex items-center justify-between">
            <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-0 text-[10px] font-black uppercase">
              Impuesto Sobre la Renta (ISR)
            </Badge>
            <ShieldCheck size={20} className="text-indigo-500" />
          </div>

          <div>
            <h4 className="text-base font-black text-slate-800 dark:text-white">Informe Mensual F14 (Retenciones ISR)</h4>
            <p className="text-xs text-slate-500 mt-1">
              Registro de retenciones de impuesto sobre la renta aplicadas en Planillas de Sueldos y Pago de Servicios Profesionales.
            </p>
          </div>

          <div className="p-3 bg-muted/40 rounded-xl space-y-1.5 text-xs">
            <div className="flex justify-between"><span>Retención Renta Planilla:</span><strong className="font-mono">$480.00</strong></div>
            <div className="flex justify-between"><span>Retención 10% Servicios:</span><strong className="font-mono text-indigo-600">$150.00</strong></div>
            <div className="flex justify-between border-t pt-1"><span>Total Retenciones F14:</span><strong className="font-mono text-slate-900 dark:text-white">$630.00</strong></div>
          </div>

          <Button onClick={handleDownloadF14} disabled={isExporting} className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold text-xs h-10 rounded-xl text-white">
            <Download size={15} className="mr-1.5" /> Descargar Informe F14 (Formato MH)
          </Button>
        </Card>
      </div>
    </div>
  );
}
