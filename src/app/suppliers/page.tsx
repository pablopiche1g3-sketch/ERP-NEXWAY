'use client';

import React, { useState, useMemo } from 'react';
import { 
  Truck, 
  ArrowLeft, 
  Search, 
  Trash2, 
  Mail, 
  Phone, 
  MapPin, 
  Hash, 
  BadgeInfo, 
  Building2, 
  Briefcase,
  Loader2,
  Plus
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
import { Switch } from '@/components/ui/switch';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { useRouter } from 'next/navigation';

export default function SuppliersPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const [form, setForm] = useState({
    name: '',
    nit: '',
    nrc: '',
    giro: '',
    email: '',
    phone: '',
    address: '',
    applyRetention: false,
    applyPerception: false
  });

  const suppliersCollectionRef = useMemo(() => collection(db, 'suppliers'), [db]);
  const { data: suppliers, loading: loadingData } = useCollection<any>(suppliersCollectionRef);

  const handleCreateSupplier = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!form.name || !form.nit || !form.nrc) {
      toast({ 
        variant: "destructive", 
        title: "Faltan campos", 
        description: "Nombre, NIT y NRC son obligatorios para registrar un proveedor." 
      });
      return;
    }

    const supplierData = {
      ...form,
      createdAt: new Date().toISOString()
    };

    addDoc(suppliersCollectionRef, supplierData)
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: 'suppliers',
          operation: 'create',
          requestResourceData: supplierData,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
      });

    toast({ title: "Proveedor Registrado", description: `${form.name} ha sido añadido.` });
    
    setForm({
      name: '',
      nit: '',
      nrc: '',
      giro: '',
      email: '',
      phone: '',
      address: '',
      applyRetention: false,
      applyPerception: false
    });
  };

  const handleUpdateSupplierField = async (id: string, field: string, value: boolean) => {
    const supplierRef = doc(db, 'suppliers', id);
    const updateData = { [field]: value };
    
    updateDoc(supplierRef, updateData)
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: supplierRef.path,
          operation: 'update',
          requestResourceData: updateData,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
      });
    
    toast({ 
      title: "Perfil Actualizado", 
      description: `Se ha modificado la condición de ${field === 'applyRetention' ? 'Retención' : 'Percepción'} para este proveedor.` 
    });
  };

  const handleDeleteSupplier = (id: string) => {
    const supplierRef = doc(db, 'suppliers', id);
    deleteDoc(supplierRef)
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: supplierRef.path,
          operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
      });
    
    toast({ title: "Registro Eliminado", description: "El proveedor ha sido removido." });
  };

  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (s.nit && s.nit.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [searchTerm, suppliers]);

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
            <h1 className="text-2xl font-bold text-slate-900">Directorio de Proveedores</h1>
            <p className="text-slate-500 text-sm">Gestión de suministrantes y condiciones tributarias</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-emerald-700 text-white p-6">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Building2 size={20} />
                Nuevo Proveedor
              </CardTitle>
              <CardDescription className="text-emerald-100">Ingrese los datos legales para facturación</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleCreateSupplier} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Razón Social</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <Input 
                      placeholder="Ej. Suministros Industriales S.A."
                      value={form.name}
                      onChange={e => setForm({...form, name: e.target.value})}
                      className="h-10 pl-9 bg-slate-50 border-slate-100 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">NIT</Label>
                    <Input 
                      placeholder="NIT..." 
                      value={form.nit}
                      onChange={e => setForm({...form, nit: e.target.value})}
                      className="h-10 bg-slate-50 border-slate-100 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">NRC</Label>
                    <Input 
                      placeholder="NRC..." 
                      value={form.nrc}
                      onChange={e => setForm({...form, nrc: e.target.value})}
                      className="h-10 bg-slate-50 border-slate-100 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Giro Comercial</Label>
                  <Input 
                    placeholder="Giro..." 
                    value={form.giro}
                    onChange={e => setForm({...form, giro: e.target.value})}
                    className="h-10 bg-slate-50 border-slate-100 rounded-xl text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <Label className="text-[9px] font-bold uppercase">Retención</Label>
                    <Switch 
                      checked={form.applyRetention}
                      onCheckedChange={(val) => setForm({...form, applyRetention: val})}
                    />
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <Label className="text-[9px] font-bold uppercase">Percepción</Label>
                    <Switch 
                      checked={form.applyPerception}
                      onCheckedChange={(val) => setForm({...form, applyPerception: val})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Correo</Label>
                    <Input 
                      type="email"
                      placeholder="Email..." 
                      value={form.email}
                      onChange={e => setForm({...form, email: e.target.value})}
                      className="h-10 bg-slate-50 border-slate-100 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Teléfono</Label>
                    <Input 
                      placeholder="Tel..." 
                      value={form.phone}
                      onChange={e => setForm({...form, phone: e.target.value})}
                      className="h-10 bg-slate-50 border-slate-100 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full h-12 bg-emerald-700 hover:bg-emerald-800 rounded-xl font-bold text-white shadow-lg">
                  <Plus size={18} className="mr-2" />
                  Registrar Proveedor
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input 
              placeholder="Buscar por razón social o NIT..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-12 h-12 bg-white border-none shadow-sm rounded-2xl"
            />
          </div>

          <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase px-6">Proveedor</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Tributos</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Retención</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Percepción</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingData ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400"><Loader2 className="animate-spin mx-auto mb-2" /> Cargando directorio...</TableCell></TableRow>
                  ) : filteredSuppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20 text-slate-400 italic text-xs">
                        No hay proveedores registrados.
                      </TableCell>
                    </TableRow>
                  ) : filteredSuppliers.map((supplier: any) => (
                    <TableRow key={supplier.id} className="hover:bg-slate-50/50">
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-xs">{supplier.name}</span>
                          <span className="text-[9px] text-slate-400">{supplier.email || 'Sin correo'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono font-bold text-slate-600">NIT: {supplier.nit}</span>
                          <span className="text-[10px] font-mono text-slate-400">NRC: {supplier.nrc}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={supplier.applyRetention}
                            onCheckedChange={(val) => handleUpdateSupplierField(supplier.id, 'applyRetention', val)}
                            className="scale-75"
                          />
                          <span className={`text-[9px] font-bold ${supplier.applyRetention ? 'text-amber-600' : 'text-slate-300'}`}>1%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={supplier.applyPerception}
                            onCheckedChange={(val) => handleUpdateSupplierField(supplier.id, 'applyPerception', val)}
                            className="scale-75"
                          />
                          <span className={`text-[9px] font-bold ${supplier.applyPerception ? 'text-blue-600' : 'text-slate-300'}`}>1%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteSupplier(supplier.id)}
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
