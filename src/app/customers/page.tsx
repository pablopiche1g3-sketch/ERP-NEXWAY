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
  Briefcase,
  UserCheck,
  Sparkles,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function CustomersPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('cf');

  const [form, setForm] = useState({
    name: '',
    nit: '',
    nrc: '',
    giro: '',
    email: '',
    phone: '',
    address: ''
  });

  const { data: customers, loading: loadingData } = useCollection<any>(collection(db, 'customers'));

  const handleCreateCustomer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!form.name || (activeTab === 'ccf' && (!form.nit || !form.nrc))) {
      toast({ 
        variant: "destructive", 
        title: "Faltan campos", 
        description: activeTab === 'cf' ? "El nombre es obligatorio." : "Nombre, NIT y NRC son obligatorios para Crédito Fiscal." 
      });
      return;
    }

    const customerData = {
      ...form,
      type: activeTab === 'cf' ? 'Individual' : 'Empresa',
      category: activeTab === 'cf' ? 'Consumidor Final' : 'Crédito Fiscal',
      createdAt: new Date().toISOString()
    };

    const customersRef = collection(db, 'customers');

    // Operación no bloqueante
    addDoc(customersRef, customerData)
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: 'customers',
          operation: 'create',
          requestResourceData: customerData,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
      });

    toast({ title: "Cliente Registrado", description: `${form.name} ha sido añadido.` });
    
    setForm({
      name: '',
      nit: '',
      nrc: '',
      giro: '',
      email: '',
      phone: '',
      address: ''
    });
  };

  const handleLoadDemo = () => {
    const demo1 = {
      name: 'Juan Pérez (Demo CF)',
      type: 'Individual',
      category: 'Consumidor Final',
      email: 'juan@example.com',
      phone: '7777-1234',
      address: 'San Salvador, El Salvador',
      createdAt: new Date().toISOString()
    };

    const demo2 = {
      name: 'Distribuidora Salvadoreña S.A. (Demo CCF)',
      type: 'Empresa',
      category: 'Crédito Fiscal',
      nit: '0614-010180-101-1',
      nrc: '12345-6',
      giro: 'Venta de repuestos automotrices',
      email: 'contacto@distribuidora.sv',
      phone: '2222-3333',
      address: 'Zona Industrial, Soyapango',
      createdAt: new Date().toISOString()
    };

    addDoc(collection(db, 'customers'), demo1);
    addDoc(collection(db, 'customers'), demo2);

    toast({ 
      title: "Datos de Prueba Cargados", 
      description: "Se han añadido clientes de ejemplo (CF y CCF)." 
    });
  };

  const handleDeleteCustomer = (id: string) => {
    const customerRef = doc(db, 'customers', id);
    deleteDoc(customerRef)
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: customerRef.path,
          operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
      });
    
    toast({ title: "Registro Eliminado", description: "El cliente ha sido removido." });
  };

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (c.nit && c.nit.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [searchTerm, customers]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full bg-white shadow-sm hover:bg-slate-100"
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="text-slate-600" size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Registro de Clientes</h1>
            <p className="text-slate-500 text-sm">Gestión de carteras y datos tributarios</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={handleLoadDemo}
          className="rounded-xl border-dashed border-sky-300 text-sky-600 hover:bg-sky-50 font-bold gap-2"
        >
          <Sparkles size={16} />
          Cargar Clientes de Prueba
        </Button>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-6">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Plus size={20} className="text-sky-400" />
                Alta de Cliente
              </CardTitle>
              <CardDescription className="text-slate-400">Seleccione el tipo de contribuyente</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <Tabs defaultValue="cf" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-2 mb-6 bg-slate-100 rounded-xl p-1">
                  <TabsTrigger value="cf" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <User size={14} className="mr-2" />
                    Consumidor Final
                  </TabsTrigger>
                  <TabsTrigger value="ccf" className="rounded-lg data-[state=active]:bg-sky-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                    <Building2 size={14} className="mr-2" />
                    Crédito Fiscal
                  </TabsTrigger>
                </TabsList>

                <form onSubmit={handleCreateCustomer} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">
                      {activeTab === 'cf' ? 'Nombre Completo' : 'Nombre o Razón Social'}
                    </Label>
                    <div className="relative">
                      <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <Input 
                        placeholder={activeTab === 'cf' ? "Ej. Juan Pérez" : "Ej. Industrias El Salvador S.A."}
                        value={form.name}
                        onChange={e => setForm({...form, name: e.target.value})}
                        className="h-10 pl-9 bg-slate-50 border-slate-100 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  {activeTab === 'ccf' && (
                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">NIT</Label>
                        <div className="relative">
                          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                          <Input 
                            placeholder="0000-000000-000-0" 
                            value={form.nit}
                            onChange={e => setForm({...form, nit: e.target.value})}
                            className="h-10 pl-9 bg-slate-50 border-slate-100 rounded-xl text-xs font-mono"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">NRC</Label>
                        <div className="relative">
                          <BadgeInfo className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                          <Input 
                            placeholder="Registro..." 
                            value={form.nrc}
                            onChange={e => setForm({...form, nrc: e.target.value})}
                            className="h-10 pl-9 bg-slate-50 border-slate-100 rounded-xl text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'ccf' && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Giro Comercial</Label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <Input 
                          placeholder="Venta de productos, servicios..." 
                          value={form.giro}
                          onChange={e => setForm({...form, giro: e.target.value})}
                          className="h-10 pl-9 bg-slate-50 border-slate-100 rounded-xl text-xs"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Correo Electrónico</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <Input 
                          type="email"
                          placeholder="correo@ejemplo.com" 
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
                    <Label className="text-[10px] font-black uppercase text-slate-400">Dirección</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 text-slate-400" size={14} />
                      <textarea 
                        placeholder="Ubicación del cliente..."
                        value={form.address}
                        onChange={e => setForm({...form, address: e.target.value})}
                        className="w-full min-h-[60px] pl-9 pt-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-sky-500/20 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full h-12 bg-sky-600 hover:bg-sky-700 rounded-xl font-bold text-white shadow-lg shadow-sky-200">
                    <Users size={18} className="mr-2" />
                    Registrar en Cartera
                  </Button>
                </form>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-7 space-y-4">
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
            <ScrollArea className="h-[550px]">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase px-6">Receptor</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Tipo</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Contacto</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingData ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400"><Loader2 className="animate-spin mx-auto mb-2" /> Cargando base de datos...</TableCell></TableRow>
                  ) : filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-20 text-slate-400 italic text-xs">
                        No hay clientes que coincidan con la búsqueda.
                      </TableCell>
                    </TableRow>
                  ) : filteredCustomers.map((customer: any) => (
                    <TableRow key={customer.id} className="hover:bg-slate-50/50">
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-xs">{customer.name}</span>
                          <span className="text-[10px] font-mono text-slate-400">{customer.nit || 'Consumidor Final'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[8px] font-black uppercase ${customer.category === 'Crédito Fiscal' ? 'bg-sky-50 text-sky-600 border-sky-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {customer.category || customer.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                            <Phone size={10} className="text-slate-400" />
                            {customer.phone || 'N/A'}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                            <Mail size={10} className="text-slate-400" />
                            {customer.email || 'N/A'}
                          </div>
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
