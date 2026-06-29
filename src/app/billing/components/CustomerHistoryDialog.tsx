'use client';

import React, { useState } from 'react';
import { supabase } from '@/supabase/client';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, Clock, Package, Calendar } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface CustomerHistoryDialogProps {
  customerId: string | null;
  customerName: string;
}

export function CustomerHistoryDialog({ customerId, customerName }: CustomerHistoryDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      // 1. Fetch sales for this customer
      const { data: sales, error: salesErr } = await supabase
        .from('sales')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (salesErr) throw salesErr;

      // 2. Fetch items for these sales
      if (sales && sales.length > 0) {
        const saleIds = sales.map(s => s.id);
        const { data: items, error: itemsErr } = await supabase
          .from('invoice_items')
          .select('*')
          .in('invoice_id', saleIds);
          
        if (itemsErr) throw itemsErr;

        const historyData = sales.map(s => ({
          ...s,
          items: (items || []).filter(i => i.invoice_id === s.id)
        }));
        setHistory(historyData);
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    fetchHistory();
  };

  return (
    <>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={handleOpen}
        disabled={!customerId}
        className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg shrink-0 ml-1"
        title="Ver historial del cliente"
      >
        <Eye size={16} />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px] bg-white/80 dark:bg-[#0f111a]/80 backdrop-blur-xl border-white/20 dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black">
              <Clock className="text-blue-500" />
              Historial de Compras
            </DialogTitle>
            <DialogDescription>
              Últimas transacciones del cliente <strong className="text-slate-800 dark:text-white">{customerName}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[400px] w-full rounded-md border p-4 bg-white/50 dark:bg-black/20">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
                Cargando historial...
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Package size={32} className="mb-2 opacity-50" />
                No hay compras previas registradas.
              </div>
            ) : (
              <div className="space-y-6">
                {history.map((sale) => (
                  <div key={sale.id} className="relative border-l-2 border-blue-100 dark:border-blue-900 pl-4 pb-4 last:pb-0">
                    <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-blue-100 dark:bg-blue-900 border-2 border-white dark:border-[#0f111a]" />
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <Calendar size={14} className="text-blue-500" />
                        {format(new Date(sale.created_at), "dd MMM yyyy, h:mm a", { locale: es })}
                      </div>
                      <Badge variant="outline" className="font-mono text-xs bg-white dark:bg-black/50">
                        {sale.correlative}
                      </Badge>
                    </div>
                    
                    <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10 p-3 shadow-sm">
                      <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100 dark:border-white/10">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {sale.payment_method === 'Crédito' ? (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px]">Al Crédito</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">Al Contado</Badge>
                          )}
                        </span>
                        <span className="text-sm font-black text-blue-600 dark:text-[#7c7fff]">
                          ${Number(sale.total).toFixed(2)}
                        </span>
                      </div>
                      
                      <div className="space-y-2 mt-2">
                        {sale.items?.map((item: any) => (
                          <div key={item.id} className="flex justify-between items-center text-xs group hover:bg-slate-50 dark:hover:bg-white/5 p-1 rounded-md transition-colors">
                            <div className="flex items-center gap-2 truncate max-w-[70%]">
                              <span className="bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/60 px-1.5 py-0.5 rounded font-mono text-[9px] shrink-0">
                                {item.sku}
                              </span>
                              <span className="truncate text-slate-700 dark:text-slate-300 font-medium">
                                {item.product_name}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-slate-500 dark:text-slate-400 text-[10px]">
                                {item.quantity} x ${Number(item.unit_price).toFixed(2)}
                              </span>
                              <span className="font-bold text-slate-700 dark:text-slate-200 w-12 text-right">
                                ${(item.quantity * item.unit_price).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
