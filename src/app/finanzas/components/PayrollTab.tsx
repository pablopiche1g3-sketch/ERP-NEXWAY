'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Banknote, 
  Landmark, 
  Gift, 
  Users, 
  Save, 
  Loader2, 
  PlusCircle, 
  DollarSign, 
  CheckCircle2, 
  Calculator, 
  Send,
  FileSpreadsheet
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function PayrollTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'salaries' | 'loans' | 'bonuses'>('salaries');

  // Datos
  const [employees, setEmployees] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [payrollPeriod, setPayrollPeriod] = useState(`${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')} Q1`);

  // Estado temporal de salarios editables
  const [baseSalaries, setBaseSalaries] = useState<Record<string, number>>({});
  const [isProcessingPayroll, setIsProcessingPayroll] = useState(false);

  // Modales
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [loanEmployeeId, setLoanEmployeeId] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanInstallment, setLoanInstallment] = useState('');
  const [loanReason, setLoanReason] = useState('');
  const [isSavingLoan, setIsSavingLoan] = useState(false);

  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
  const [bonusEmployeeId, setBonusEmployeeId] = useState('');
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusReason, setBonusReason] = useState('');
  const [isSavingBonus, setIsSavingBonus] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Empleados / Perfiles
      const { data: profs } = await supabase.from('profiles').select('id, email, role');
      setEmployees(profs || []);

      // 2. Préstamos
      const { data: lns } = await supabase.from('employee_loans').select('*, profiles(email)');
      setLoans(lns || []);

      // 3. Bonos
      const { data: bns } = await supabase.from('employee_bonuses').select('*, profiles(email)');
      setBonuses(bns || []);

      // Cargar últimos salarios base guardados si existen
      const { data: pRecords } = await supabase.from('payroll_records').select('profile_id, base_salary');
      const salMap: Record<string, number> = {};
      (pRecords || []).forEach((r: any) => {
        if (r.profile_id) salMap[r.profile_id] = parseFloat(r.base_salary) || 0;
      });
      setBaseSalaries(salMap);

    } catch (e: any) {
      console.error('Error cargando Nómina:', e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los datos de Nómina.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Cálculo de Ley de El Salvador (ISSS, AFP, Renta)
  const calculatePayrollRow = (empId: string, base: number) => {
    const isss = Math.min(base * 0.03, 30.00); // 3% max $30
    const afp = base * 0.0725; // 7.25%
    const taxableRenta = base - isss - afp;
    
    // Tabla Oficial de Retención de Renta ISR El Salvador (Ministerio de Hacienda)
    let renta = 0;
    if (taxableRenta > 2038.10) {
      renta = 288.57 + (taxableRenta - 2038.10) * 0.30; // Tramo IV (30% sobre exceso de $2038.10 + $288.57)
    } else if (taxableRenta > 895.24) {
      renta = 60.00 + (taxableRenta - 895.24) * 0.20; // Tramo III (20% sobre exceso de $895.24 + $60.00)
    } else if (taxableRenta > 472.00) {
      renta = 17.67 + (taxableRenta - 472.00) * 0.10; // Tramo II (10% sobre exceso de $472.00 + $17.67)
    } // Tramo I (hasta $472.00) es Exento (0%)

    // Buscar préstamo activo del empleado
    const empLoan = loans.find(l => l.profile_id === empId && l.status === 'ACTIVO' && l.balance > 0);
    const loanDeduction = empLoan ? Math.min(empLoan.installment_amount, empLoan.balance) : 0;

    // Buscar bonos pendientes del empleado
    const empBonuses = bonuses.filter(b => b.profile_id === empId && b.status === 'PENDIENTE');
    const bonusTotal = empBonuses.reduce((acc, b) => acc + (parseFloat(b.amount) || 0), 0);

    const netPaid = Math.max(0, base - isss - afp - renta - loanDeduction + bonusTotal);

    return {
      isss,
      afp,
      renta,
      loanDeduction,
      bonusTotal,
      netPaid
    };
  };

  // Métricas Generales
  const totalBaseSalary = employees.reduce((sum, e) => sum + (baseSalaries[e.id] || 0), 0);
  const totalActiveLoans = loans.filter(l => l.status === 'ACTIVO').reduce((sum, l) => sum + (parseFloat(l.balance) || 0), 0);
  const totalPendingBonuses = bonuses.filter(b => b.status === 'PENDIENTE').reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);

  const handleSalaryChange = (empId: string, value: string) => {
    const num = parseFloat(value) || 0;
    setBaseSalaries(prev => ({ ...prev, [empId]: num }));
  };

  const handleProcessPayroll = async () => {
    setIsProcessingPayroll(true);
    try {
      for (const emp of employees) {
        const base = baseSalaries[emp.id] || 0;
        if (base <= 0) continue;
        const calc = calculatePayrollRow(emp.id, base);

        await supabase.from('payroll_records').insert({
          profile_id: emp.id,
          base_salary: base,
          isss_deduction: calc.isss,
          afp_deduction: calc.afp,
          renta_deduction: calc.renta,
          period: payrollPeriod,
          net_paid: calc.netPaid,
          status: 'PROCESADO'
        });

        // Descontar saldo de préstamo si aplica
        const empLoan = loans.find(l => l.profile_id === emp.id && l.status === 'ACTIVO' && l.balance > 0);
        if (empLoan && calc.loanDeduction > 0) {
          const newBal = Math.max(0, empLoan.balance - calc.loanDeduction);
          await supabase.from('employee_loans').update({
            balance: newBal,
            status: newBal <= 0 ? 'PAGADO' : 'ACTIVO'
          }).eq('id', empLoan.id);
        }

        // Marcar bonos como pagados
        const empBonuses = bonuses.filter(b => b.profile_id === emp.id && b.status === 'PENDIENTE');
        for (const b of empBonuses) {
          await supabase.from('employee_bonuses').update({ status: 'PAGADO' }).eq('id', b.id);
        }
      }

      toast({ title: 'Planilla Procesada', description: `Se registró el pago de planilla para el período ${payrollPeriod}.` });
      await loadData();
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Ocurrió un error al procesar la planilla.' });
    } finally {
      setIsProcessingPayroll(false);
    }
  };

  const handleSaveLoan = async () => {
    if (!loanEmployeeId || !loanAmount || parseFloat(loanAmount) <= 0) {
      toast({ variant: 'destructive', title: 'Campos Incompletos', description: 'Selecciona empleado y un monto válido.' });
      return;
    }
    const amt = parseFloat(loanAmount);
    const inst = parseFloat(loanInstallment) || (amt / 5);

    setIsSavingLoan(true);
    try {
      const { error } = await supabase.from('employee_loans').insert({
        profile_id: loanEmployeeId,
        amount: amt,
        balance: amt,
        installment_amount: inst,
        reason: loanReason || 'Préstamo Interno de Empresa',
        status: 'ACTIVO'
      });
      if (error) throw error;
      toast({ title: 'Préstamo Registrado', description: `Se otorgó préstamo por $${amt.toFixed(2)}.` });
      setIsLoanModalOpen(false);
      setLoanEmployeeId('');
      setLoanAmount('');
      setLoanInstallment('');
      setLoanReason('');
      await loadData();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSavingLoan(false);
    }
  };

  const handleSaveBonus = async () => {
    if (!bonusEmployeeId || !bonusAmount || parseFloat(bonusAmount) <= 0) {
      toast({ variant: 'destructive', title: 'Campos Incompletos', description: 'Selecciona empleado y un monto válido.' });
      return;
    }
    const amt = parseFloat(bonusAmount);
    setIsSavingBonus(true);
    try {
      const { error } = await supabase.from('employee_bonuses').insert({
        profile_id: bonusEmployeeId,
        amount: amt,
        reason: bonusReason || 'Bonificación por desempeño / comisión',
        month: payrollPeriod,
        status: 'PENDIENTE'
      });
      if (error) throw error;
      toast({ title: 'Bono Registrado', description: `Se asignó bono por $${amt.toFixed(2)}.` });
      setIsBonusModalOpen(false);
      setBonusEmployeeId('');
      setBonusAmount('');
      setBonusReason('');
      await loadData();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSavingBonus(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tarjetas de Métricas RH & Nómina */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Planilla Salarial Base</p>
              <h3 className="text-2xl font-black mt-1 text-emerald-400">${totalBaseSalary.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
              <Banknote size={20} />
            </div>
          </div>
          <div className="h-1 bg-emerald-500 w-full absolute bottom-0 left-0" />
        </Card>

        <Card className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Préstamos Activos</p>
              <h3 className="text-2xl font-black mt-1 text-amber-400">${totalActiveLoans.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400">
              <Landmark size={20} />
            </div>
          </div>
          <div className="h-1 bg-amber-500 w-full absolute bottom-0 left-0" />
        </Card>

        <Card className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bonos / Comisiones</p>
              <h3 className="text-2xl font-black mt-1 text-blue-400">${totalPendingBonuses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
              <Gift size={20} />
            </div>
          </div>
          <div className="h-1 bg-blue-500 w-full absolute bottom-0 left-0" />
        </Card>

        <Card className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Colaboradores</p>
              <h3 className="text-2xl font-black mt-1 text-purple-400">{employees.length} Personal</h3>
            </div>
            <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-400">
              <Users size={20} />
            </div>
          </div>
          <div className="h-1 bg-purple-500 w-full absolute bottom-0 left-0" />
        </Card>
      </div>

      {/* Navegación Interna de Nómina */}
      <Card className="border shadow-md rounded-2xl bg-card">
        <CardHeader className="bg-slate-900 text-white p-5 rounded-t-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2">
              <Banknote className="text-emerald-400" size={18} />
              Gestión de Nóminas y Recursos Humanos
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">Cálculo de deducciones de ley, emisión de salarios, préstamos a personal y comisiones.</CardDescription>
          </div>

          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
            <Button
              variant={subTab === 'salaries' ? 'default' : 'ghost'}
              onClick={() => setSubTab('salaries')}
              className={`h-8 text-xs font-bold rounded-lg ${subTab === 'salaries' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'text-slate-300'}`}
            >
              <Calculator size={13} className="mr-1.5" /> Planilla & Deducciones
            </Button>
            <Button
              variant={subTab === 'loans' ? 'default' : 'ghost'}
              onClick={() => setSubTab('loans')}
              className={`h-8 text-xs font-bold rounded-lg ${subTab === 'loans' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'text-slate-300'}`}
            >
              <Landmark size={13} className="mr-1.5" /> Préstamos a Empleados
            </Button>
            <Button
              variant={subTab === 'bonuses' ? 'default' : 'ghost'}
              onClick={() => setSubTab('bonuses')}
              className={`h-8 text-xs font-bold rounded-lg ${subTab === 'bonuses' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'text-slate-300'}`}
            >
              <Gift size={13} className="mr-1.5" /> Comisiones y Bonos
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
          ) : subTab === 'salaries' ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <Label className="text-xs font-bold uppercase whitespace-nowrap">Período de Planilla:</Label>
                  <Input
                    value={payrollPeriod}
                    onChange={e => setPayrollPeriod(e.target.value)}
                    className="w-44 h-9 text-xs font-bold"
                  />
                </div>
                <Button 
                  onClick={handleProcessPayroll} 
                  disabled={isProcessingPayroll}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 rounded-xl shadow-md"
                >
                  {isProcessingPayroll ? <Loader2 className="animate-spin mr-2" size={16} /> : <CheckCircle2 className="mr-2" size={16} />}
                  PROCESAR Y PAGAR PLANILLA
                </Button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 dark:bg-white/5 border-b">
                    <tr className="text-left text-slate-500 dark:text-slate-400">
                      <th className="p-3.5 font-bold text-[10px] uppercase">Empleado</th>
                      <th className="p-3.5 font-bold text-[10px] uppercase">Rol</th>
                      <th className="p-3.5 font-bold text-[10px] uppercase">Salario Base ($)</th>
                      <th className="p-3.5 font-bold text-[10px] uppercase text-right">ISSS (3%)</th>
                      <th className="p-3.5 font-bold text-[10px] uppercase text-right">AFP (7.25%)</th>
                      <th className="p-3.5 font-bold text-[10px] uppercase text-right">Renta (ISR)</th>
                      <th className="p-3.5 font-bold text-[10px] uppercase text-right">Cuota Préstamo</th>
                      <th className="p-3.5 font-bold text-[10px] uppercase text-right">Bono (+)</th>
                      <th className="p-3.5 font-bold text-[10px] uppercase text-right">Salario Neto ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => {
                      const base = baseSalaries[emp.id] || 0;
                      const calc = calculatePayrollRow(emp.id, base);
                      return (
                        <tr key={emp.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                          <td className="p-3.5 font-bold text-slate-800 dark:text-slate-200">{emp.email}</td>
                          <td className="p-3.5">
                            <Badge variant="outline" className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-500/10">
                              {emp.role || 'Empleado'}
                            </Badge>
                          </td>
                          <td className="p-3.5">
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={baseSalaries[emp.id] ?? ''}
                              onChange={e => handleSalaryChange(emp.id, e.target.value)}
                              className="w-28 h-8 text-xs font-bold"
                            />
                          </td>
                          <td className="p-3.5 text-right text-rose-500 font-medium">-${calc.isss.toFixed(2)}</td>
                          <td className="p-3.5 text-right text-rose-500 font-medium">-${calc.afp.toFixed(2)}</td>
                          <td className="p-3.5 text-right text-rose-500 font-medium">-${calc.renta.toFixed(2)}</td>
                          <td className="p-3.5 text-right text-amber-500 font-bold">
                            {calc.loanDeduction > 0 ? `-$${calc.loanDeduction.toFixed(2)}` : '-'}
                          </td>
                          <td className="p-3.5 text-right text-blue-500 font-bold">
                            {calc.bonusTotal > 0 ? `+$${calc.bonusTotal.toFixed(2)}` : '-'}
                          </td>
                          <td className="p-3.5 text-right font-black text-emerald-600 dark:text-emerald-400 text-base">
                            ${calc.netPaid.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : subTab === 'loans' ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm uppercase text-slate-700 dark:text-slate-300">Préstamos Internos Otorgados</h4>
                <Button onClick={() => setIsLoanModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-9 text-xs rounded-xl">
                  <PlusCircle size={14} className="mr-1.5" /> Otorgar Préstamo
                </Button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 dark:bg-white/5 border-b">
                    <tr className="text-left text-slate-500 dark:text-slate-400">
                      <th className="p-3.5 font-bold text-[10px] uppercase">Empleado</th>
                      <th className="p-3.5 font-bold text-[10px] uppercase">Motivo / Razón</th>
                      <th className="p-3.5 font-bold text-[10px] uppercase text-right">Monto Original</th>
                      <th className="p-3.5 font-bold text-[10px] uppercase text-right">Cuota Mensual</th>
                      <th className="p-3.5 font-bold text-[10px] uppercase text-right">Saldo Actual</th>
                      <th className="p-3.5 font-bold text-[10px] uppercase text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loans.map(l => (
                      <tr key={l.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                        <td className="p-3.5 font-bold">{l.profiles?.email || 'Empleado'}</td>
                        <td className="p-3.5 text-xs text-slate-500">{l.reason || 'Sin especificar'}</td>
                        <td className="p-3.5 text-right font-semibold">${parseFloat(l.amount).toFixed(2)}</td>
                        <td className="p-3.5 text-right font-semibold text-amber-500">${parseFloat(l.installment_amount).toFixed(2)}</td>
                        <td className="p-3.5 text-right font-black text-rose-500">${parseFloat(l.balance).toFixed(2)}</td>
                        <td className="p-3.5 text-center">
                          <Badge className={`font-black text-[10px] uppercase ${l.status === 'PAGADO' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                            {l.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {loans.length === 0 && (
                      <tr><td colSpan={6} className="p-8 text-center text-slate-400 text-xs font-medium">No hay préstamos a empleados registrados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm uppercase text-slate-700 dark:text-slate-300">Bonificaciones y Comisiones</h4>
                <Button onClick={() => setIsBonusModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs rounded-xl">
                  <PlusCircle size={14} className="mr-1.5" /> Asignar Bono
                </Button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 dark:bg-white/5 border-b">
                    <tr className="text-left text-slate-500 dark:text-slate-400">
                      <th className="p-3.5 font-bold text-[10px] uppercase">Empleado</th>
                      <th className="p-3.5 font-bold text-[10px] uppercase">Motivo</th>
                      <th className="p-3.5 font-bold text-[10px] uppercase">Período</th>
                      <th className="p-3.5 font-bold text-[10px] uppercase text-right">Monto ($)</th>
                      <th className="p-3.5 font-bold text-[10px] uppercase text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bonuses.map(b => (
                      <tr key={b.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                        <td className="p-3.5 font-bold">{b.profiles?.email || 'Empleado'}</td>
                        <td className="p-3.5 text-xs text-slate-500">{b.reason}</td>
                        <td className="p-3.5 text-xs font-medium">{b.month}</td>
                        <td className="p-3.5 text-right font-black text-blue-500">${parseFloat(b.amount).toFixed(2)}</td>
                        <td className="p-3.5 text-center">
                          <Badge className={`font-black text-[10px] uppercase ${b.status === 'PAGADO' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                            {b.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {bonuses.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-slate-400 text-xs font-medium">No hay bonificaciones registradas.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL OTORGAR PRÉSTAMO */}
      <Dialog open={isLoanModalOpen} onOpenChange={setIsLoanModalOpen}>
        <DialogContent className="sm:max-w-md bg-card rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black uppercase text-base">
              <Landmark className="text-amber-500" size={18} />
              Otorgar Préstamo Interno a Empleado
            </DialogTitle>
            <DialogDescription className="text-xs">
              Se creará una cuenta por cobrar interna deducible de nómina.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Seleccionar Empleado</Label>
              <Select value={loanEmployeeId} onValueChange={setLoanEmployeeId}>
                <SelectTrigger className="h-10 rounded-xl text-xs">
                  <SelectValue placeholder="Elegir colaborador..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id} className="text-xs">{e.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase">Monto Préstamo ($)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={loanAmount}
                  onChange={e => setLoanAmount(e.target.value)}
                  className="h-10 text-xs font-bold rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase">Cuota Mensual ($)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={loanInstallment}
                  onChange={e => setLoanInstallment(e.target.value)}
                  className="h-10 text-xs font-bold rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Motivo u Observación</Label>
              <Input
                placeholder="Ej. Emergencia médica / anticipo"
                value={loanReason}
                onChange={e => setLoanReason(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsLoanModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveLoan} disabled={isSavingLoan} className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl">
              {isSavingLoan ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              REGISTRAR PRÉSTAMO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL OTORGAR BONO */}
      <Dialog open={isBonusModalOpen} onOpenChange={setIsBonusModalOpen}>
        <DialogContent className="sm:max-w-md bg-card rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black uppercase text-base">
              <Gift className="text-blue-500" size={18} />
              Asignar Bonificación o Comisión
            </DialogTitle>
            <DialogDescription className="text-xs">
              Monto que se sumará al salario neto en el siguiente pago de planilla.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Seleccionar Empleado</Label>
              <Select value={bonusEmployeeId} onValueChange={setBonusEmployeeId}>
                <SelectTrigger className="h-10 rounded-xl text-xs">
                  <SelectValue placeholder="Elegir colaborador..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id} className="text-xs">{e.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Monto Bonificación ($)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={bonusAmount}
                onChange={e => setBonusAmount(e.target.value)}
                className="h-10 text-xs font-bold rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Motivo de la Bonificación</Label>
              <Input
                placeholder="Ej. Comisión por metas de ventas cumplidas"
                value={bonusReason}
                onChange={e => setBonusReason(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsBonusModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveBonus} disabled={isSavingBonus} className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl">
              {isSavingBonus ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              ASIGNAR BONIFICACIÓN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
