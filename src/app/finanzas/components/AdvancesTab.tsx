'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Landmark, Plus, Users, Loader2, CheckCircle2, UserCheck, Calendar } from 'lucide-react';

export default function AdvancesTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);

  const [isAdding, setIsAdding] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [amount, setAmount] = useState('150.00');
  const [installmentsCount, setInstallmentsCount] = useState('1'); // número de meses a descontar
  const [reason, setReason] = useState('Adelanto de salario quincenal');
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Obtener empleados
      const { data: profs } = await supabase.from('profiles').select('id, email, role');
      setEmployees(profs || []);
      if (profs && profs.length > 0) setSelectedEmpId(profs[0].id);

      // 2. Obtener anticipos/préstamos de empleados
      const { data: lns } = await supabase.from('employee_loans').select('*, profiles(email)').order('created_at', { ascending: false });
      setLoans(lns || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId || !amount) return;

    const totalNum = parseFloat(amount) || 0;
    const countNum = parseInt(installmentsCount) || 1;
    const installmentAmt = totalNum / countNum;

    setIsSaving(true);
    try {
      const { data, error } = await supabase.from('employee_loans').insert({
        profile_id: selectedEmpId,
        amount: totalNum,
        installment_amount: installmentAmt,
        balance: totalNum,
        reason,
        status: 'ACTIVO'
      }).select('*, profiles(email)').single();

      if (error) throw error;

      toast({ title: 'Anticipo Registrado', description: `Se asignó un adelanto de $${totalNum.toFixed(2)} al colaborador.` });
      setLoans(prev => [data, ...prev]);
      setIsAdding(false);
      setAmount('150.00');
      setReason('Adelanto de salario quincenal');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message || 'No se pudo guardar el anticipo.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-2xl border shadow-sm">
        <div>
          <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Landmark className="text-indigo-500" size={20} />
            Gestión de Anticipos y Adelantos de Sueldo a Empleados
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Control de anticipos quincenales y préstamos internos descontados automáticamente de la nómina laboral.
          </p>
        </div>

        <Button onClick={() => setIsAdding(!isAdding)} className="bg-indigo-600 hover:bg-indigo-700 font-bold text-xs h-9 rounded-xl text-white">
          <Plus size={15} className="mr-1.5" /> Registrar Anticipo a Empleado
        </Button>
      </div>

      {/* Formulario Registrar Anticipo */}
      {isAdding && (
        <Card className="border shadow-md rounded-2xl p-5 bg-card animate-in fade-in duration-200">
          <form onSubmit={handleAddAdvance} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Colaborador / Empleado</Label>
              <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id} className="text-xs">
                      {emp.email} ({emp.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Monto del Adelanto ($)</Label>
              <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="h-9 text-xs font-mono" required />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Cuotas a Descontar (Meses)</Label>
              <Select value={installmentsCount} onValueChange={setInstallmentsCount}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Quincena / 1 Mes (Descuento Único)</SelectItem>
                  <SelectItem value="2">2 Meses (Cuotas iguales)</SelectItem>
                  <SelectItem value="3">3 Meses (Cuotas iguales)</SelectItem>
                  <SelectItem value="6">6 Meses (Cuotas iguales)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 col-span-1 sm:col-span-3">
              <Label className="text-xs font-bold">Motivo / Concepto del Adelanto</Label>
              <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ej. Adelanto quincena, emergencia médica" className="h-9 text-xs" required />
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsAdding(false)} className="h-9 text-xs font-bold flex-1">Cancelar</Button>
              <Button type="submit" disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 h-9 text-xs font-bold flex-1">
                {isSaving ? <Loader2 className="animate-spin" size={14} /> : 'Guardar Anticipo'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Grid de Anticipos de Empleados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loans.map(loan => {
          const empEmail = loan.profiles?.email || 'Empleado';
          const balanceNum = parseFloat(loan.balance) || 0;
          const totalNum = parseFloat(loan.amount) || 0;

          return (
            <Card key={loan.id} className="border shadow-sm p-5 rounded-2xl bg-card">
              <div className="flex justify-between items-start">
                <div>
                  <Badge className={`border-0 text-[9px] font-black uppercase mb-1 ${balanceNum > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                    {balanceNum > 0 ? 'Anticipo Activo' : 'Saldado / Liquidado'}
                  </Badge>
                  <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1">
                    <UserCheck size={14} className="text-indigo-500" />
                    {empEmail}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1">{loan.reason}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold">Adelanto Total</span>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">${totalNum.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold">Cuota Planilla</span>
                  <p className="text-xs font-bold text-rose-500 mt-0.5">${(parseFloat(loan.installment_amount) || 0).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold">Saldo Pendiente</span>
                  <p className="text-xs font-black text-indigo-500 mt-0.5">${balanceNum.toFixed(2)}</p>
                </div>
              </div>
            </Card>
          );
        })}

        {loans.length === 0 && !loading && (
          <div className="col-span-full p-8 text-center text-slate-500 border border-dashed rounded-2xl text-xs">
            No hay anticipos o adelantos de sueldo a empleados registrados actualmente.
          </div>
        )}
      </div>
    </div>
  );
}
