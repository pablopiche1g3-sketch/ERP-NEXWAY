
'use client';

import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  ArrowLeft, 
  Search, 
  Trash2, 
  Mail, 
  Phone, 
  MapPin, 
  Hash, 
  BadgeInfo, 
  Building2, 
  User, 
  Loader2,
  Briefcase
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';

export default function CustomersPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [form, setForm] = useState({
    name: '',
    type: 'Individual' as 'Individual' | 'Empresa',
    nit: '',
    nrc: '',
    giro: '',
    email: '',
    phone: '',
    address: ''
  });

  const { data: customers, loading: loadingData } = useCollection<any>(collection(db, 'customers'));

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.nit || !form.email) {
      toast({ variant: "destructive", title: "Faltan campos", description: "Nombre, NIT y Correo son obligatorios." });
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'customers'), {
        ...form,
        createdAt: new Date().toISOString()
      });
      toast({ title: "Cliente Registrado", description: `${form.name} ha sido añadido a la base de datos.` });
      setForm({
        name: '',
        type: 'Individual',
        nit: '',
        nrc: '',
        giro: '',
        email: '',
        phone: '',
        address: ''
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar al cliente." });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'customers', id));
      toast({ title: "Registro Eliminado", description: "El cliente ha sido removido." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el registro." });
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.nit.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, customers]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" asChild>
            <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm hover:bg-slate-100">
              <ArrowLeft className="text-slate-600" size={20} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Registro de Clientes</h1>
            <p className="text-slate-500 text-sm">Gestión de contribuyentes y consumidores finales</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-6">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Plus size={20} className="text-sky-400" />
                Nuevo Cliente
              </CardTitle>
              <CardDescription className="text-slate-400">Ingrese los datos tributarios y de contacto</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleCreateCustomer} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Tipo de Cliente</Label>
                  <Select value={form.type} onValueChange={(v: any) => setForm({...form, type: v})}>
                    <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Individual">Persona Natural (Individual)</SelectItem>
                      <SelectItem value="Empresa">Persona Jurídica (Empresa)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">
                    {form.type === 'Individual' ? 'Nombre Completo' : 'Razón Social'}
                  </Label>
                  <div className="relative">
                    {form.type === 'Individual' ? <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} /> : <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />}
                    <Input 
                      placeholder={form.type === 'Individual' ? "Ej. Juan Pérez" : "Ej. Industrias NexWay S.A. de C.V."}
                      value={form.name}
                      onChange={e => setForm({...form, name: e.target.value})}
                      className="h-10 pl-9 bg-slate-50 border-slate-100 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">NIT / DUI</Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <Input 
                        placeholder="0000-000000..." 
                        value={form.nit}
                        onChange={e => setForm({...form, nit: e.target.value})}
                        className="h-10 pl-9 bg-slate-50 border-slate-100 rounded-xl text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">NRC (Registro)</Label>
                    <div className="relative">
                      <BadgeInfo className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <Input 
                        placeholder="Opcional" 
                        value={form.nrc}
                        onChange={e => setForm({...form, nrc: e.target.value})}
                        className="h-10 pl-9 bg-slate-50 border-slate-100 rounded-xl text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Giro / Actividad</Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <Input 
                      placeholder="Venta de repuestos, servicios..." 
                      value={form.giro}
                      onChange={e => setForm({...form, giro: e.target.value})}
                      className="h-10 pl-9 bg-slate-50 border-slate-100 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Correo Electrónico</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <Input 
                        type="email"
                        placeholder="cliente@correo.com" 
                        value={form.email}
                        onChange={e => setForm({...form, email: e.target.value})}
                        className="h-10 pl-9 bg-slate-50 border-slate-100 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Teléfono</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <Input 
                        placeholder="2222-0000" 
                        value={form.phone}
                        onChange={e => setForm({...form, phone: e.target.value})}
                        className="h-10 pl-9 bg-slate-50 border-slate-100 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Dirección Completa</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 text-slate-400" size={14} />
                    <textarea 
                      placeholder="Calle, ciudad, departamento..."
                      value={form.address}
                      onChange={e => setForm({...form, address: e.target.value})}
                      className="w-full min-h-[80px] pl-9 pt-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-sky-500/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <Button disabled={loading} className="w-full h-12 bg-sky-600 hover:bg-sky-700 rounded-xl font-bold text-white shadow-lg">
                  {loading ? <Loader2 className="animate-spin" /> : 'Registrar Cliente'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input 
              placeholder="Buscar por nombre o NIT..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-12 h-12 bg-white border-none shadow-sm rounded-2xl"
            />
          </div>

          <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase px-6">Cliente / Tipo</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Documentación</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Contacto</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingData ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20">Cargando base de datos...</TableCell></TableRow>
                  ) : filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-20 text-slate-400 italic text-xs">
                        No se encontraron clientes registrados.
                      </TableCell>
                    </TableRow>
                  ) : filteredCustomers.map((customer: any) => (
                    <TableRow key={customer.id} className="hover:bg-slate-50/50">
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-xs">{customer.name}</span>
                          <Badge variant="outline" className={`mt-1 text-[8px] font-black uppercase w-fit ${customer.type === 'Individual' ? 'bg-sky-50 text-sky-600 border-sky-100' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
                            {customer.type}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-mono font-bold text-slate-600">NIT: {customer.nit}</span>
                          {customer.nrc && <span className="text-[10px] font-mono text-slate-400">NRC: {customer.nrc}</span>}
                          {customer.giro && <span className="text-[9px] text-slate-500 italic max-w-[150px] truncate">{customer.giro}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <Mail size={12} className="text-slate-400" />
                            {customer.email}
                          </div>
                          {customer.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <Phone size={12} className="text-slate-400" />
                              {customer.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteCustomer(customer.id)}
                          className="h-8 w-8 text-slate-300 hover:text-rose-500"
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
