'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Building2, Save, Plus, Loader2, Trash2 } from 'lucide-react';

export default function CostCentersTab() {
  const { toast } = useToast();
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newBranchId, setNewBranchId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: br } = await supabase.from('branches').select('*');
      setBranches(br || []);
      
      const { data: cc, error } = await supabase.from('cost_centers').select('*, branches(name)');
      if (error) throw error;
      setCostCenters(cc || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    if (!newName) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('cost_centers').insert({
        name: newName,
        description: newDesc,
        branch_id: newBranchId || null
      });
      if (error) throw error;
      
      toast({ title: 'Centro Creado', description: 'Se ha registrado el centro de costo.' });
      setNewName('');
      setNewDesc('');
      setNewBranchId('');
      await loadData();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que desea eliminar este centro?')) return;
    try {
      const { error } = await supabase.from('cost_centers').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Centro Eliminado' });
      await loadData();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card className="border shadow-md rounded-2xl bg-card">
        <CardHeader className="bg-card text-card-foreground p-6 border-b border-border">
          <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight">
            <Building2 className="text-amber-400" size={20} />
            Análisis de Centros de Costo
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">Gestión y control de centros de costo por sucursal / departamento.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10">
            <Input placeholder="Nombre del centro..." value={newName} onChange={e => setNewName(e.target.value)} />
            <Input placeholder="Descripción breve..." value={newDesc} onChange={e => setNewDesc(e.target.value)} />
            <select 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={newBranchId} 
              onChange={e => setNewBranchId(e.target.value)}
            >
              <option value="">(Sin Sucursal Vinculada)</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <Button onClick={handleCreate} disabled={isSaving || !newName} className="bg-amber-600 hover:bg-amber-700">
              {isSaving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Plus className="mr-2" size={16} />}
              CREAR CENTRO
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-amber-500" /></div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="p-4 font-bold text-xs uppercase">Centro de Costo</th>
                    <th className="p-4 font-bold text-xs uppercase">Descripción</th>
                    <th className="p-4 font-bold text-xs uppercase">Sucursal</th>
                    <th className="p-4 font-bold text-xs uppercase text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {costCenters.map(cc => (
                    <tr key={cc.id} className="border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="p-4 font-semibold text-slate-700 dark:text-slate-200">{cc.name}</td>
                      <td className="p-4 text-slate-500">{cc.description}</td>
                      <td className="p-4"><span className="uppercase text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-1 rounded-md tracking-widest">{cc.branches?.name || 'GLOBAL'}</span></td>
                      <td className="p-4 text-right">
                        <Button size="sm" variant="ghost" className="h-8 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10" onClick={() => handleDelete(cc.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {costCenters.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted-foreground">No hay centros de costo registrados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
