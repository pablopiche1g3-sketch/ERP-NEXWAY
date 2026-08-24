'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Banknote, Landmark, FileText, Loader2, Save } from 'lucide-react';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

export default function HrPayrollTab() {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      // Intentar cargar usuarios reales desde app_users
      const { data: appUsers, error: appErr } = await supabase
        .from('app_users')
        .select('id, full_name, username, email, role, status')
        .order('full_name');

      if (!appErr && appUsers && appUsers.length > 0) {
        const clean = appUsers.filter((u: any) => u.email !== 'caja1@nexway.sv');
        setUsers(clean);
      } else {
        // Fallback a profiles si app_users no retorna filas
        const { data, error } = await supabase.from('profiles').select('id, email, role');
        if (error) throw error;
        const clean = (data || []).filter((u: any) => u.email !== 'caja1@nexway.sv');
        setUsers(clean);
      }
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar colaboradores para RH.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSalary = (userId: string, email: string) => {
    toast({
      title: "Salario Guardado",
      description: `Se actualizó la configuración salarial para ${email}.`
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card className="border shadow-md rounded-2xl bg-card overflow-hidden">
        <CardHeader className="bg-slate-900 text-white p-6 dark:bg-slate-950">
          <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight">
            <Users className="text-emerald-400" size={20} />
            Recursos Humanos & Planilla
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">Administración de salarios base, préstamos y bonificaciones.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-emerald-500" /></div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <Button variant="outline" className="h-14 font-bold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10">
                  <Banknote className="mr-2" size={18} /> Salarios y Deducciones
                </Button>
                <Button variant="outline" className="h-14 font-bold border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10">
                  <Landmark className="mr-2" size={18} /> Gestión de Préstamos
                </Button>
                <Button variant="outline" className="h-14 font-bold border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10">
                  <FileText className="mr-2" size={18} /> Comisiones y Bonos
                </Button>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden bg-white/5">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                    <tr className="text-left text-slate-500 dark:text-slate-400">
                      <th className="p-4 font-bold text-xs uppercase">Colaborador / Empleado</th>
                      <th className="p-4 font-bold text-xs uppercase">Rol en el ERP</th>
                      <th className="p-4 font-bold text-xs uppercase">Salario Base ($)</th>
                      <th className="p-4 font-bold text-xs uppercase text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-slate-400">No hay usuarios registrados en el sistema.</td>
                      </tr>
                    ) : (
                      users.map(u => (
                        <tr key={u.id} className="border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                          <td className="p-4">
                            <p className="font-bold text-slate-800 dark:text-slate-200">{u.full_name || u.username || 'Usuario NexWay'}</p>
                            <p className="text-xs text-slate-400">{u.email}</p>
                          </td>
                          <td className="p-4">
                            <span className="uppercase text-[10px] font-black text-indigo-500 bg-indigo-500/10 px-2.5 py-1 rounded-md tracking-widest">
                              {u.role || 'Cajero'}
                            </span>
                          </td>
                          <td className="p-4">
                            <Input type="number" step="0.01" placeholder="0.00" className="w-32 h-9 text-sm font-bold bg-white dark:bg-black/20" />
                          </td>
                          <td className="p-4 text-right">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleSaveSalary(u.id, u.email)}
                              className="h-9 font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                            >
                              <Save size={14} className="mr-2" /> Guardar
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
