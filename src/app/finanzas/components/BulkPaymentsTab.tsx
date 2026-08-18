'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Download, FileText, CheckCircle, Building, Users } from 'lucide-react';

export default function BulkPaymentsTab() {
  const { toast } = useToast();
  const [bankFormat, setBankFormat] = useState('BAC');
  const [paymentType, setPaymentType] = useState('Nómina');

  const handleDownloadTxt = () => {
    const content = `01NEXWAY ERP S.A. DE C.V.               ${new Date().toISOString().slice(0, 10).replace(/-/g, '')}\n020030012490101   CARLOS MENENDEZ     000000045000\n020030012490102   MARIA FLORES        000000052000\n020030012490103   ROBERTO GOMEZ       000000068000\n9900000003000000165000`;
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PAGO_MASIVO_${bankFormat}_${paymentType.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: 'Archivo TXT Generado', description: `Descargado archivo de pago masivo para ${bankFormat}.` });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card className="border shadow-md rounded-2xl bg-card overflow-hidden">
        <CardHeader className="bg-card text-card-foreground p-6 border-b border-border">
          <CardTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2">
            <FileText className="text-indigo-400" size={20} />
            Generador de Archivos de Pago Masivo Bancario (.TXT / .CSV)
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs mt-1">
            Exporta planillas y pagos a proveedores en el formato estándar de la banca electrónica de El Salvador.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-white/5 p-4 rounded-xl border">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">Formato Bancario</label>
              <Select value={bankFormat} onValueChange={setBankFormat}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BAC">BAC Credomatic (Banca en Línea Empresarial)</SelectItem>
                  <SelectItem value="AGRICOLE">Banco Agrícola (E-Banca Empresarial)</SelectItem>
                  <SelectItem value="CUSCATLAN">Banco Cuscatlán (NetBanking)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">Tipo de Transferencia</label>
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Nómina">Pago de Nómina / Salarios de Personal</SelectItem>
                  <SelectItem value="Proveedores">Pago de Cuentas por Pagar (Proveedores)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={handleDownloadTxt} className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold text-xs h-9 rounded-xl shadow-md">
                <Download size={15} className="mr-1.5" /> Descargar TXT Bancario
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
