
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { 
  CalendarClock, 
  ArrowLeft, 
  Plus, 
  Building2, 
  Calendar, 
  DollarSign, 
  Search,
  CheckCircle2,
  Clock,
  Trash2,
  FileText,
  ListPlus,
  Receipt,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';

interface InvoiceItem {
  number: string;
  amount: number;
}

export default function QuedanPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Estados del formulario
  const [supplier, setSupplier] = useState('');
  const [dueDate, setDueDate] = useState('');
  
  // Estados para la lista de facturas
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [currentInvoiceNum, setCurrentInvoiceNum] = useState('');
  const [currentInvoiceAmount, setCurrentInvoiceAmount] = useState<string | number>('');

  const quedanRef = useMemo(() => collection(db, 'quedan'), [db]);
  const { data: quedans, loading } = useCollection<any>(quedanRef);

  const addInvoiceToList = () => {
    if (!currentInvoiceNum || !currentInvoiceAmount) {
      toast({ variant: "destructive", title: "Datos incompletos", description: "Ingrese el número de factura y el monto." });
      return;
    }
    const amount = parseFloat(currentInvoiceAmount.toString()) || 0;
    if (amount <= 0) {
      toast({ variant: "destructive", title: "Monto inválido", description: "El monto debe ser mayor a cero." });
      return;
    }

    setInvoices(prev => [...prev, { number: currentInvoiceNum, amount }]);
    setCurrentInvoiceNum('');
    setCurrentInvoiceAmount('');
    toast({ title: "Factura Añadida", description: "Se agregó a la lista del Quedan." });
  };

  const removeInvoiceFromList = (index: number) => {
    setInvoices(prev => prev.filter((_, i) => i !== index));
  };

  const totalAmount = useMemo(() => {
    return invoices.reduce((acc, inv) => acc + inv.amount, 0);
  }, [invoices]);

  const handleCreateQuedan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier || !dueDate || invoices.length === 0) {
      toast({ 
        variant: "destructive", 
        title: "Faltan datos", 
        description: "Debe ingresar el proveedor, la fecha de vencimiento y al menos una factura." 
      });
      return;
    }

    setIsSaving(true);
    const data = {
      supplier,
      dueDate,
      invoices,
      totalAmount,
      status: 'PENDIENTE',
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(quedanRef, data);
      toast({ title: "Quedan Generado", description: `Compromiso de $${totalAmount.toFixed(2)} registrado.` });
      setSupplier('');
      setDueDate('');
      setInvoices([]);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar el Quedan." });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'PENDIENTE' ? 'PAGADO' : 'PENDIENTE';
    await updateDoc(doc(db, 'quedan', id), { status: nextStatus });
    toast({ title: "Estado Actualizado", description: `El Quedan ahora figura como ${nextStatus}.` });
  };

  const filteredQuedans = useMemo(() => {
    if (!quedans) return [];
    return quedans.filter((q: any) => q.supplier.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, quedans]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm" onClick={() => router.push('/')}>
            <ArrowLeft className="text-slate-600" size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-headline">Área de Quedan</h1>
            <p className="text-slate-500 text-sm">Programación consolidada de pagos a proveedores</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Panel Izquierdo: Formulario de Emisión */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-purple-600 text-white p-6">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Plus size={20} className="text-purple-200" />
                  Emisión de Quedan
                </CardTitle>
                {invoices.length > 0 && (
                  <Badge className="bg-purple-500 text-white border-purple-400">
                    Total: ${totalAmount.toFixed(2)}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-purple-100">
                Agrupe facturas de un solo proveedor para programar pago.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Proveedor</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <Input 
                      placeholder="Nombre del proveedor o razón social..." 
                      value={supplier}
                      onChange={e => setSupplier(e.target.value)}
                      className="h-10 pl-9 bg-slate-50 border-slate-100 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Fecha de Pago Programada</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <Input 
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="h-10 pl-9 bg-slate-50 border-slate-100 rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Área para agregar facturas */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                <Label className="text-[10px] font-black uppercase text-slate-400 block mb-2">Añadir Facturas y Montos</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <Input 
                      placeholder="No. Factura" 
                      value={currentInvoiceNum}
                      onChange={e => setCurrentInvoiceNum(e.target.value)}
                      className="h-9 pl-9 bg-white border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div className="relative w-32">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <Input 
                      type="number"
                      placeholder="Monto" 
                      value={currentInvoiceAmount}
                      onChange={e => setCurrentInvoiceAmount(e.target.value)}
                      className="h-9 pl-8 bg-white border-slate-200 rounded-lg text-xs font-bold"
                    />
                  </div>
                  <Button 
                    type="button" 
                    variant="secondary" 
                    size="icon" 
                    className="h-9 w-9 rounded-lg"
                    onClick={addInvoiceToList}
                  >
                    <ListPlus size={18} />
                  </Button>
                </div>

                {/* Lista de facturas agregadas */}
                {invoices.length > 0 && (
                  <div className="mt-4 border-t border-slate-200 pt-4 space-y-2">
                    {invoices.map((inv, index) => (
                      <div key={index} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-600">FAC: {inv.number}</span>
                          <span className="text-xs font-black text-slate-900">${inv.amount.toFixed(2)}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-slate-300 hover:text-rose-500"
                          onClick={() => removeInvoiceFromList(index)}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button 
                onClick={handleCreateQuedan} 
                className="w-full h-12 bg-purple-600 hover:bg-purple-700 rounded-xl font-bold text-white shadow-lg"
                disabled={isSaving || invoices.length === 0}
              >
                {isSaving ? <Loader2 className="animate-spin mr-2" /> : <CalendarClock className="mr-2" />}
                Generar Quedan Consolidado
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Panel Derecho: Listado de Quedan */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input 
              placeholder="Buscar por proveedor en historial..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-12 h-12 bg-white border-none shadow-sm rounded-2xl text-sm"
            />
          </div>

          <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase px-6">Proveedor / Detalle</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-center">Vencimiento</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right">Total Quedan</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-center">Estado</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin mx-auto mb-2 text-purple-600" /> Sincronizando historial...</TableCell></TableRow>
                  ) : filteredQuedans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20 text-slate-400 italic text-xs">
                        No hay compromisos registrados en el historial.
                      </TableCell>
                    </TableRow>
                  ) : filteredQuedans.map((q: any) => (
                    <TableRow key={q.id} className="hover:bg-slate-50/50">
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-slate-900 text-xs">{q.supplier}</span>
                          <div className="flex flex-wrap gap-1">
                            {q.invoices?.map((inv: any, idx: number) => (
                              <Badge key={idx} variant="secondary" className="text-[8px] font-mono px-1.5 h-4 bg-slate-100 text-slate-500">
                                {inv.number}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold text-slate-600">{q.dueDate}</span>
                          <span className="text-[9px] text-slate-400 uppercase font-black">Vencimiento</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-black text-slate-900 text-sm">
                          ${(q.totalAmount || 0).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant="outline" 
                          onClick={() => toggleStatus(q.id, q.status)}
                          className={`cursor-pointer text-[9px] font-black px-3 py-1 rounded-full ${q.status === 'PAGADO' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}
                        >
                          {q.status === 'PAGADO' ? <CheckCircle2 size={10} className="mr-1" /> : <Clock size={10} className="mr-1" />}
                          {q.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => deleteDoc(doc(db, 'quedan', q.id))} 
                          className="h-8 w-8 text-slate-200 hover:text-rose-500"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </div>
      </div>
    </div>
  );
}
