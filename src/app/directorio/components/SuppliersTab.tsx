'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { useRouter } from 'next/navigation';
import { ModeToggle } from '@/components/mode-toggle';

export default function SuppliersTab() {
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

  // Estados para datos cargados desde Supabase
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Función para cargar los proveedores desde Supabase
  const loadSuppliersData = async () => {
    try {
      setLoadingData(true);
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');
      
      if (error) throw error;

      // Mapear campos para compatibilidad con el resto del código
      const mapped = (data || []).map(s => ({
        id: s.id,
        name: s.name,
        nit: s.nit,
        nrc: s.nrc,
        giro: s.giro,
        email: s.email,
        phone: s.phone,
        address: s.address,
        applyRetention: s.apply_retention,
        applyPerception: s.apply_perception,
        createdAt: s.created_at
      }));

      setSuppliers(mapped);
    } catch (err: any) {
      console.error('Error al cargar proveedores desde Supabase:', err);
      toast({
        variant: 'destructive',
        title: 'Error de Conexión',
        description: 'No se pudo cargar el directorio de proveedores de Supabase.'
      });
    } finally {
      setLoadingData(false);
    }
  };

  // Cargar proveedores en el montaje
  useEffect(() => {
    loadSuppliersData();
  }, []);

  const handleCreateSupplier = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!form.name || !form.nit || !form.nrc) {
      toast({ 
        variant: "destructive", 
        title: "Faltan campos", 
        description: "Nombre, NIT y NRC son obligatorios para registrar un proveedor." 
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('suppliers')
        .insert({
          name: form.name,
          nit: form.nit,
          nrc: form.nrc,
          giro: form.giro || null,
          email: form.email || null,
          phone: form.phone || null,
          address: form.address || null,
          apply_retention: form.applyRetention,
          apply_perception: form.applyPerception
        });

      if (error) throw error;

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
      await loadSuppliersData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error al registrar", description: err.message });
    }
  };

  const handleUpdateSupplierField = async (id: string, field: string, value: boolean) => {
    try {
      const dbField = field === 'applyRetention' ? 'apply_retention' : 'apply_perception';
      const { error } = await supabase
        .from('suppliers')
        .update({ [dbField]: value })
        .eq('id', id);

      if (error) throw error;

      toast({ 
        title: "Perfil Actualizado", 
        description: `Se ha modificado la condición de ${field === 'applyRetention' ? 'Retención' : 'Percepción'} para este proveedor.` 
      });
      await loadSuppliersData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error al actualizar", description: err.message });
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: "Registro Eliminado", description: "El proveedor ha sido removido." });
      await loadSuppliersData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error al eliminar", description: err.message });
    }
  };

  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (s.nit && s.nit.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [searchTerm, suppliers]);

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-6 transition-colors duration-300 relative overflow-hidden">
<div className="relative z-10 max-w-7xl mx-auto mb-6 bg-white/5 dark:bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-10 h-10 rounded-xl bg-white/5 dark:bg-white/5 border border-white/10 hover:bg-white/10 dark:hover:bg-white/10" 
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="text-slate-800 dark:text-slate-300" size={18} />
          </Button>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white font-headline leading-tight">Directorio de Proveedores</h1>
            <p className="text-slate-500 dark:text-white/40 text-[11px] md:text-xs">Gestión de suministrantes y condiciones tributarias</p>
          </div>
        </div>
        <ModeToggle />
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 relative z-10">
        <div className="lg:col-span-4 space-y-4">
          <Card className="bg-white/5 dark:bg-white/5 backdrop-blur-md border-white/10 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-200 dark:border-white/10 p-6 bg-slate-50 dark:bg-white/5">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                <Building2 size={20} className="text-indigo-600 dark:text-emerald-500" />
                Nuevo Proveedor
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400 text-xs">Ingrese los datos legales para facturación</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleCreateSupplier} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Razón Social</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                    <Input 
                      placeholder="Ej. Suministros Industriales S.A."
                      value={form.name}
                      onChange={e => setForm({...form, name: e.target.value})}
                      className="h-10 pl-9 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">NIT</Label>
                    <Input 
                      placeholder="NIT..." 
                      value={form.nit}
                      onChange={e => setForm({...form, nit: e.target.value})}
                      className="h-10 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">NRC</Label>
                    <Input 
                      placeholder="NRC..." 
                      value={form.nrc}
                      onChange={e => setForm({...form, nrc: e.target.value})}
                      className="h-10 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Giro Comercial</Label>
                  <Input 
                    placeholder="Giro..." 
                    value={form.giro}
                    onChange={e => setForm({...form, giro: e.target.value})}
                    className="h-10 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl shadow-sm dark:shadow-none">
                    <Label className="text-[9px] font-bold uppercase text-slate-800 dark:text-white">Retención</Label>
                    <Switch 
                      checked={form.applyRetention}
                      onCheckedChange={(val) => setForm({...form, applyRetention: val})}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl shadow-sm dark:shadow-none">
                    <Label className="text-[9px] font-bold uppercase text-slate-800 dark:text-white">Percepción</Label>
                    <Switch 
                      checked={form.applyPerception}
                      onCheckedChange={(val) => setForm({...form, applyPerception: val})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Correo</Label>
                    <Input 
                      type="email"
                      placeholder="Email..." 
                      value={form.email}
                      onChange={e => setForm({...form, email: e.target.value})}
                      className="h-10 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Teléfono</Label>
                    <Input 
                      placeholder="Tel..." 
                      value={form.phone}
                      onChange={e => setForm({...form, phone: e.target.value})}
                      className="h-10 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 rounded-xl font-bold text-white shadow-lg shadow-indigo-500/20 dark:shadow-emerald-700/20 active:scale-95 transition-all">
                  <Plus size={18} className="mr-2" />
                  Registrar Proveedor
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-muted-foreground" size={18} />
            <Input 
              placeholder="Buscar por razón social o NIT..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-12 h-10 md:h-12 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-xs md:text-sm text-slate-800 dark:text-white"
            />
          </div>

          <Card className="bg-white/5 dark:bg-white/5 backdrop-blur-md border-white/10 shadow-sm rounded-2xl overflow-hidden">
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-white/5 sticky top-0 z-10 border-b border-slate-200 dark:border-white/10 shadow-sm">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase px-4 md:px-6 text-slate-700 dark:text-white">Proveedor</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-700 dark:text-white">Tributos</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-700 dark:text-white">Retención</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-700 dark:text-white">Percepción</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingData ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground"><Loader2 className="animate-spin mx-auto mb-2" /> Cargando directorio...</TableCell></TableRow>
                  ) : filteredSuppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic text-xs">
                        No hay proveedores registrados.
                      </TableCell>
                    </TableRow>
                  ) : filteredSuppliers.map((supplier: any) => (
                    <TableRow key={supplier.id} className="hover:bg-slate-50 dark:hover:bg-white/10 border-slate-100 dark:border-white/5 transition-colors">
                      <TableCell className="px-4 md:px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 dark:text-white text-xs">{supplier.name}</span>
                          <span className="text-[9px] text-slate-500 dark:text-slate-400">{supplier.email || 'Sin correo'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono font-bold text-slate-800 dark:text-white">NIT: {supplier.nit}</span>
                          <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">NRC: {supplier.nrc}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={supplier.applyRetention}
                            onCheckedChange={(val) => handleUpdateSupplierField(supplier.id, 'applyRetention', val)}
                            className="scale-75"
                          />
                          <span className={`text-[9px] font-black ${supplier.applyRetention ? 'text-amber-500' : 'text-slate-400 dark:text-slate-600'}`}>1%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={supplier.applyPerception}
                            onCheckedChange={(val) => handleUpdateSupplierField(supplier.id, 'applyPerception', val)}
                            className="scale-75"
                          />
                          <span className={`text-[9px] font-black ${supplier.applyPerception ? 'text-indigo-500 dark:text-sky-500' : 'text-slate-400 dark:text-slate-600'}`}>1%</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteSupplier(supplier.id)}
                          className="h-8 w-8 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-white/10 rounded-lg"
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
