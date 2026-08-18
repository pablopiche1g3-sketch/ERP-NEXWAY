'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Users, Loader2, AlertTriangle, Clock, Activity, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function RetentionTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [inactiveCustomers, setInactiveCustomers] = useState<any[]>([]);
  const [thresholdFilter, setThresholdFilter] = useState<string>('30'); // Default to 30 days

  const loadData = async () => {
    setLoading(true);
    try {
      let query = supabase.from('vw_inactive_customers').select('*');
      
      const { data, error } = await query;
      if (error) throw error;
      
      let filteredData = data || [];
      const threshold = parseInt(thresholdFilter);
      
      if (!isNaN(threshold)) {
         filteredData = filteredData.filter((c: any) => c.days_inactive >= threshold);
      }
      
      setInactiveCustomers(filteredData);
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los datos de retención.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [thresholdFilter]);

  const handleContactAction = (email: string, phone: string, name: string) => {
    if (phone) {
       window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=Hola ${name}, te extrañamos en nuestra tienda...`, '_blank');
    } else if (email) {
       window.location.href = `mailto:${email}?subject=Oferta especial para ti!`;
    } else {
       toast({ title: 'Sin contacto', description: 'El cliente no tiene teléfono ni correo registrado.' });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card className="border shadow-md rounded-2xl bg-card">
        <CardHeader className="bg-card text-card-foreground p-6 border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 rounded-t-2xl">
          <div>
             <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight">
               <Activity className="text-orange-400" size={20} />
               Retención y Recuperación de Clientes
             </CardTitle>
             <CardDescription className="text-slate-400 text-xs">Monitorea clientes inactivos sin compras recientes para campañas de fidelización.</CardDescription>
          </div>
          
          <div className="flex items-center gap-2 bg-white/10 p-2 rounded-xl">
             <span className="text-xs font-bold whitespace-nowrap text-white">Inactivos hace:</span>
             <Select value={thresholdFilter} onValueChange={setThresholdFilter}>
                <SelectTrigger className="w-32 h-8 text-xs bg-slate-800 border-0 text-white rounded-lg">
                   <SelectValue />
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="30">Más de 30 días</SelectItem>
                   <SelectItem value="60">Más de 60 días</SelectItem>
                   <SelectItem value="90">Más de 90 días</SelectItem>
                   <SelectItem value="180">Más de 6 meses</SelectItem>
                </SelectContent>
             </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0 border-t border-border">
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-orange-500" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="p-4 font-bold text-[10px] uppercase">Cliente</th>
                    <th className="p-4 font-bold text-[10px] uppercase">Contacto</th>
                    <th className="p-4 font-bold text-[10px] uppercase">Última Compra</th>
                    <th className="p-4 font-bold text-[10px] uppercase text-center">Días de Inactividad</th>
                    <th className="p-4 font-bold text-[10px] uppercase text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {inactiveCustomers.map(c => (
                    <tr key={c.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="p-4">
                         <div className="font-bold text-slate-800 dark:text-slate-200">{c.name}</div>
                         <div className="text-[10px] text-slate-500">{c.doc_number || 'S/N'}</div>
                      </td>
                      <td className="p-4">
                         <div className="text-xs">{c.phone || '-'}</div>
                         <div className="text-[10px] text-slate-500">{c.email || '-'}</div>
                      </td>
                      <td className="p-4">
                         <div className="text-xs font-medium">{c.last_purchase_date ? new Date(c.last_purchase_date).toLocaleDateString() : 'N/A'}</div>
                      </td>
                      <td className="p-4 text-center">
                         <Badge className={`font-black uppercase text-[10px] tracking-wider ${
                            c.days_inactive > 90 ? 'bg-rose-100 text-rose-600 border-rose-200' :
                            c.days_inactive > 60 ? 'bg-orange-100 text-orange-600 border-orange-200' :
                            'bg-yellow-100 text-yellow-600 border-yellow-200'
                         }`}>
                            {c.days_inactive} DÍAS
                         </Badge>
                      </td>
                      <td className="p-4 text-right">
                         <Button size="sm" onClick={() => handleContactAction(c.email, c.phone, c.name)} className="bg-emerald-600 hover:bg-emerald-700 h-8 rounded-lg text-[10px] font-bold shadow-sm">
                            <MessageCircle size={14} className="mr-2" /> CONTACTAR
                         </Button>
                      </td>
                    </tr>
                  ))}
                  {inactiveCustomers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-slate-500 font-medium">
                         <AlertTriangle size={32} className="mx-auto mb-4 text-slate-300 opacity-50" />
                         No hay clientes que superen el umbral de inactividad seleccionado.
                      </td>
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
