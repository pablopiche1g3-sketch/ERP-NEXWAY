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
import { Coins, Plus, User, CheckCircle2 } from 'lucide-react';

const MOCK_ADVANCES = [
  { id: 'adv_1', client_name: 'DISTRIBUIDORA BETA S.A.', amount: 1500.00, used_amount: 500.00, notes: 'Anticipo para pedido especial de varilla', created_at: '2026-08-10' },
  { id: 'adv_2', client_name: 'CONSTRUCTORA ALFA', amount: 800.00, used_amount: 800.00, notes: 'Prima del 20% por compra de cemento', created_at: '2026-08-05' }
];

export default function AdvancesTab() {
  const { toast } = useToast();
  const [advances, setAdvances] = useState<any[]>(MOCK_ADVANCES);
  const [isAdding, setIsAdding] = useState(false);
  const [clientName, setClientName] = useState('COMERCIALIZADORA GAMA');
  const [amount, setAmount] = useState('500.00');
  const [notes, setNotes] = useState('Reserva de mercadería');

  const handleAddAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    const newAdv = {
      id: 'adv_' + Date.now(),
      client_name: clientName,
      amount: parseFloat(amount) || 0,
      used_amount: 0,
      notes,
      created_at: new Date().toISOString().split('T')[0]
    };
    setAdvances(prev => [newAdv, ...prev]);
    setIsAdding(false);
    toast({ title: 'Anticipo Registrado', description: `Se registró anticipo por $${amount} a favor de ${clientName}.` });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-2xl border shadow-sm">
        <div>
          <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Coins className="text-amber-500" size={20} />
            Gestión de Anticipos y Saldos a Favor de Clientes
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Control de primas y depósitos recibidos previamente antes de la facturación final.
          </p>
        </div>

        <Button onClick={() => setIsAdding(!isAdding)} className="bg-amber-600 hover:bg-amber-700 font-bold text-xs h-9 rounded-xl text-white">
          <Plus size={15} className="mr-1.5" /> Registrar Anticipo
        </Button>
      </div>

      {isAdding && (
        <Card className="border shadow-md rounded-2xl p-5 bg-card animate-in fade-in duration-200">
          <form onSubmit={handleAddAdvance} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Razón Social del Cliente</Label>
              <Input value={clientName} onChange={e => setClientName(e.target.value)} className="h-9 text-xs" required />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Monto Recibido ($)</Label>
              <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="h-9 text-xs font-mono" required />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Concepto / Notas</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} className="h-9 text-xs" />
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsAdding(false)} className="h-9 text-xs font-bold flex-1">Cancelar</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 h-9 text-xs font-bold flex-1">Guardar</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {advances.map(adv => {
          const available = adv.amount - adv.used_amount;
          return (
            <Card key={adv.id} className="border shadow-sm p-5 rounded-2xl bg-card">
              <div className="flex justify-between items-start">
                <div>
                  <Badge className="bg-amber-500/10 text-amber-500 border-0 text-[9px] font-black uppercase mb-1">Anticipo de Cliente</Badge>
                  <h4 className="text-sm font-black text-slate-800 dark:text-white">{adv.client_name}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">{adv.notes}</p>
                </div>
                <User size={20} className="text-slate-400" />
              </div>

              <div className="mt-4 pt-3 border-t grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold">Monto Inicial</span>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-0.5">${adv.amount.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold">Aplicado</span>
                  <p className="text-sm font-bold text-rose-500 mt-0.5">${adv.used_amount.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold">Disponible</span>
                  <p className="text-sm font-black text-emerald-500 mt-0.5">${available.toFixed(2)}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
