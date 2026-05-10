
'use client';

import React, { useMemo, useState } from 'react';
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
  FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';

export default function QuedanPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const [form, setForm] = useState({
    supplier: '',
    invoiceNumber: '',
    amount: '',
    dueDate: '',
  });

  const quedanRef = useMemo(() => collection(db, 'quedan'), [db]);
  const { data: quedans, loading } = useCollection<any>(quedanRef);

  const handleCreateQuedan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplier || !form.amount || !form.dueDate) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Proveedor, monto y fecha son obligatorios." });
      return;
    }

    const data = {
      ...form,
      amount: parseFloat(form.amount.toString()),
      status: 'PENDIENTE',
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(quedanRef, data);
      toast({ title: "Quedan Generado", description: "El compromiso de pago ha sido registrado." });
      setForm({ supplier: '', invoiceNumber: '', amount: '', dueDate: '' });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar el quedan." });
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'PENDIENTE' ? 'PAGADO' : 'PENDIENTE';
    await updateDoc(doc(db, 'quedan', id), { status: nextStatus });
    toast({ title: "Estado Actualizado", description: `El quedan ahora figura como ${nextStatus}.` });
  };

  const filteredQuedans = useMemo(() => {
    if (!quedans) return [];
    return quedans.filter(q => q.supplier.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, quedans]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm" onClick={() => router.push('/')}>
            <ArrowLeft className="text-slate-600" size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Área de Quedan</h1>
            <p className="text-slate-500 text-sm">Programación y control de pagos a proveedores</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4">
          <Card className="border-none shadow-sm rounded-3xl bg-white">
            <CardHeader className="bg-purple-600 text-white rounded-t-3xl p-6">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Plus size={20} />
                Emisión de Quedan
              </CardTitle>
              <CardDescription className="text-purple-100">Registre facturas recibidas para programación</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleCreateQuedan} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-400">Proveedor</Label>
                  <Input 
                    placeholder="Nombre del proveedor..." 
                    value={form.supplier}
                    onChange={e => setForm({...form, supplier: e.target.value})}
                    className="h-10 rounded-xl bg-slate-50 border-slate-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-400">No. Factura</Label>
                  <Input 
                    placeholder="0001-..." 
                    value={form.invoiceNumber}
                    onChange={e => setForm({...form, invoiceNumber: e.target.value})}
                    className="h-10 rounded-xl bg-slate-50 border-slate-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Monto ($)</Label>
                    <Input 
                      type="number"
                      step="0.01"
                      placeholder="0.00" 
                      value={form.amount}
                      onChange={e => setForm({...form, amount: e.target.value})}
                      className="h-10 rounded-xl bg-slate-50 border-slate-100 font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Fecha de Pago</Label>
                    <Input 
                      type="date"
                      value={form.dueDate}
                      onChange={e => setForm({...form, dueDate: e.target.value})}
                      className="h-10 rounded-xl bg-slate-50 border-slate-100"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full h-12 bg-purple-600 hover:bg-purple-700 rounded-xl font-bold shadow-lg">
                  Generar Compromiso
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input 
              placeholder="Buscar por proveedor..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-12 h-12 bg-white border-none shadow-sm rounded-2xl"
            />
          </div>

          <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase px-6">Proveedor / Factura</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Vencimiento</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Monto</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Estado</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuedans.map((q) => (
                    <TableRow key={q.id} className="hover:bg-slate-50/50">
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-xs">{q.supplier}</span>
                          <span className="text-[10px] text-slate-400 font-mono">FAC: {q.invoiceNumber || 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Calendar size={12} className="text-slate-400" />
                          {q.dueDate}
                        </div>
                      </TableCell>
                      <TableCell className="font-black text-slate-900 text-sm">
                        ${q.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          onClick={() => toggleStatus(q.id, q.status)}
                          className={`cursor-pointer text-[9px] font-black ${q.status === 'PAGADO' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}
                        >
                          {q.status === 'PAGADO' ? <CheckCircle2 size={10} className="mr-1" /> : <Clock size={10} className="mr-1" />}
                          {q.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(db, 'quedan', q.id))} className="h-8 w-8 text-slate-300 hover:text-rose-500">
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
