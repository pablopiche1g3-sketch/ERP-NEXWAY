'use client';

import React, { useState } from 'react';
import { 
  Database, 
  Loader2, 
  CheckCircle2, 
  Play, 
  ArrowLeft,
  Warehouse, 
  Package, 
  Users, 
  History,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useFirestore, useUser } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { supabase } from '@/supabase/client';
import { useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';

export default function MigratePage() {
  const db = useFirestore();
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useUser();
  const [migrating, setMigrating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Progress states
  const [progress, setProgress] = useState({
    warehouses: 0,
    inventory: 0,
    suppliers: 0,
    customers: 0,
    journal: 0
  });

  const [status, setStatus] = useState({
    warehouses: 'pending' as 'pending' | 'loading' | 'success' | 'error',
    inventory: 'pending' as 'pending' | 'loading' | 'success' | 'error',
    suppliers: 'pending' as 'pending' | 'loading' | 'success' | 'error',
    customers: 'pending' as 'pending' | 'loading' | 'success' | 'error',
    journal: 'pending' as 'pending' | 'loading' | 'success' | 'error'
  });

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const startMigration = async () => {
    setMigrating(true);
    setLogs([]);
    addLog("Iniciando migración reactiva desde el navegador...");

    try {
      // 1. MIGRAR BODEGAS
      setStatus(prev => ({ ...prev, warehouses: 'loading' }));
      addLog("1. Obteniendo bodegas desde Firebase Firestore...");
      const whSnap = await getDocs(collection(db, 'warehouses'));
      addLog(`Se encontraron ${whSnap.docs.length} bodegas.`);
      
      const warehouseIdMap: Record<string, string> = {};
      let whIdx = 0;

      for (const docSnap of whSnap.docs) {
        const data = docSnap.data();
        const whName = data.name;
        if (!whName) continue;

        // Insertar en Supabase
        const { data: insertedWh, error: whErr } = await supabase
          .from('warehouses')
          .insert({ name: whName })
          .select()
          .single();

        if (whErr) {
          if (whErr.code === '23505') {
            const { data: existingWh } = await supabase
              .from('warehouses')
              .select('id')
              .eq('name', whName)
              .single();
            if (existingWh) {
              warehouseIdMap[whName] = existingWh.id;
              addLog(`- Bodega '${whName}' ya existía. Mapeada.`);
            }
          } else {
            addLog(`- Error en bodega '${whName}': ${whErr.message}`);
          }
        } else if (insertedWh) {
          warehouseIdMap[whName] = insertedWh.id;
          addLog(`- Bodega '${whName}' migrada con éxito.`);
        }
        
        whIdx++;
        setProgress(prev => ({ ...prev, warehouses: Math.round((whIdx / whSnap.docs.length) * 100) }));
      }
      setStatus(prev => ({ ...prev, warehouses: 'success' }));

      // 2. MIGRAR INVENTARIO
      setStatus(prev => ({ ...prev, inventory: 'loading' }));
      addLog("2. Obteniendo catálogo maestro desde Firebase...");
      const invSnap = await getDocs(collection(db, 'inventory'));
      addLog(`Se encontraron ${invSnap.docs.length} productos.`);

      let invIdx = 0;
      let stockCount = 0;

      for (const docSnap of invSnap.docs) {
        const data = docSnap.data();
        const sku = String(data.sku || '').trim().toUpperCase();
        const name = data.name;
        if (!sku || !name) continue;

        const category = data.category || 'General';
        const price = parseFloat(data.price) || 0.00;

        // Insertar producto maestro
        const { error: prodErr } = await supabase
          .from('inventory')
          .insert({ sku, name, category, price });

        if (prodErr && prodErr.code !== '23505') {
          addLog(`- Error en producto ${sku}: ${prodErr.message}`);
          continue;
        }

        // Migrar stock
        const bodegasStockObj = data.bodegas || {};
        for (const [whName, qtyVal] of Object.entries(bodegasStockObj)) {
          const whId = warehouseIdMap[whName];
          if (!whId) continue;

          const quantity = parseFloat(String(qtyVal)) || 0;
          const { error: stockErr } = await supabase
            .from('inventory_stock')
            .insert({ sku, warehouse_id: whId, quantity });

          if (!stockErr || stockErr.code === '23505') {
            stockCount++;
          }
        }

        invIdx++;
        setProgress(prev => ({ ...prev, inventory: Math.round((invIdx / invSnap.docs.length) * 100) }));
      }
      addLog(`Catálogo y existencias migrados. Stock mapeado: ${stockCount} registros.`);
      setStatus(prev => ({ ...prev, inventory: 'success' }));

      // 3. MIGRAR PROVEEDORES
      setStatus(prev => ({ ...prev, suppliers: 'loading' }));
      addLog("3. Migrando proveedores...");
      const supSnap = await getDocs(collection(db, 'suppliers'));
      let supIdx = 0;

      for (const docSnap of supSnap.docs) {
        const data = docSnap.data();
        const name = data.name;
        if (!name) continue;

        await supabase.from('suppliers').insert({
          name,
          nit: data.nit || null,
          nrc: data.nrc || null,
          address: data.address || null
        });

        supIdx++;
        setProgress(prev => ({ ...prev, suppliers: Math.round((supIdx / supSnap.docs.length) * 100) }));
      }
      setStatus(prev => ({ ...prev, suppliers: 'success' }));

      // 4. MIGRAR CLIENTES
      setStatus(prev => ({ ...prev, customers: 'loading' }));
      addLog("4. Migrando clientes...");
      const custSnap = await getDocs(collection(db, 'customers'));
      let custIdx = 0;

      for (const docSnap of custSnap.docs) {
        const data = docSnap.data();
        const name = data.name;
        if (!name) continue;

        await supabase.from('customers').insert({
          name,
          nit: data.nit || null,
          nrc: data.nrc || null,
          address: data.address || null
        });

        custIdx++;
        setProgress(prev => ({ ...prev, customers: Math.round((custIdx / custSnap.docs.length) * 100) }));
      }
      setStatus(prev => ({ ...prev, customers: 'success' }));

      // 5. MIGRAR LIBRO DIARIO
      setStatus(prev => ({ ...prev, journal: 'loading' }));
      addLog("5. Migrando partidas de libro diario...");
      const journalSnap = await getDocs(collection(db, 'journal'));
      let jIdx = 0;

      for (const docSnap of journalSnap.docs) {
        const data = docSnap.data();
        const desc = data.description || 'Partida de Diario';
        const type = data.type || 'Egreso';
        const amount = parseFloat(data.amount) || 0;

        const { data: insertedEntry, error: jErr } = await supabase
          .from('journal')
          .insert({
            description: desc,
            type,
            amount,
            created_at: data.timestamp || new Date().toISOString()
          })
          .select()
          .single();

        if (jErr) {
          addLog(`- Error en partida '${desc}': ${jErr.message}`);
          continue;
        }

        if (type === 'Avanzado' && Array.isArray(data.lines)) {
          for (const line of data.lines) {
            await supabase.from('journal_lines').insert({
              journal_id: insertedEntry.id,
              account_code: line.accountCode || '6101',
              debit: parseFloat(line.debit) || 0,
              credit: parseFloat(line.credit) || 0
            });
          }
        }

        jIdx++;
        setProgress(prev => ({ ...prev, journal: Math.round((jIdx / journalSnap.docs.length) * 100) }));
      }
      setStatus(prev => ({ ...prev, journal: 'success' }));

      addLog("=== MIGRACIÓN REACTIVA FINALIZADA CON ÉXITO ===");
    } catch (e: any) {
      addLog(`ERROR GENERAL: ${e.message}`);
    } finally {
      setMigrating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-12 transition-colors duration-300">
      <div className="max-w-4xl mx-auto flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" className="rounded-full bg-white dark:bg-card shadow-sm border" onClick={() => router.push('/')}>
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Migrador de Datos Visual (Firebase a Supabase)</h1>
          <p className="text-muted-foreground text-sm">Vuelque toda su información operativa en tiempo real con seguridad reactiva.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Progress Card */}
        <div className="md:col-span-5 space-y-6">
          <Card className="border shadow-sm rounded-3xl p-6 bg-white dark:bg-card">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-6 flex items-center gap-2">
              <Database size={16} /> Estado de Migración
            </h2>
            <div className="space-y-6">
              {/* Bodegas */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <Warehouse size={14} /> Bodegas
                  </span>
                  <span>{progress.warehouses}%</span>
                </div>
                <Progress value={progress.warehouses} className="h-2" />
              </div>

              {/* Inventario */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <Package size={14} /> Inventario
                  </span>
                  <span>{progress.inventory}%</span>
                </div>
                <Progress value={progress.inventory} className="h-2" />
              </div>

              {/* Proveedores */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <Users size={14} /> Proveedores
                  </span>
                  <span>{progress.suppliers}%</span>
                </div>
                <Progress value={progress.suppliers} className="h-2" />
              </div>

              {/* Clientes */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <Users size={14} /> Clientes
                  </span>
                  <span>{progress.customers}%</span>
                </div>
                <Progress value={progress.customers} className="h-2" />
              </div>

              {/* Contabilidad */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <FileText size={14} /> Contabilidad
                  </span>
                  <span>{progress.journal}%</span>
                </div>
                <Progress value={progress.journal} className="h-2" />
              </div>

              <Button 
                onClick={startMigration} 
                disabled={migrating}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all mt-4"
              >
                {migrating ? (
                  <>
                    <Loader2 className="animate-spin mr-2" />
Migrando...
                  </>
                ) : (
                  <>
                    <Play className="mr-2" size={16} />
Iniciar Migración Visual
                  </>
                )}
              </Button>
            </div>
          </Card>

          <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-800 dark:text-amber-400 rounded-2xl flex gap-3">
            <AlertTriangle className="shrink-0" size={16} />
            <p className="leading-relaxed">Este proceso leerá de forma segura todas sus colecciones de Firebase y las insertará en Supabase. No se alterará ni borrará ninguna información en Firebase.</p>
          </div>
        </div>

        {/* Logs Console Card */}
        <div className="md:col-span-7 flex flex-col">
          <Card className="border shadow-sm rounded-3xl bg-slate-950 text-slate-300 p-6 flex flex-col h-[500px]">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 border-b border-slate-900 pb-2">Consola de Salida</h2>
            <div className="flex-1 overflow-y-auto font-mono text-[10px] leading-relaxed pr-2">
              <div className="space-y-1">
                {logs.map((log, idx) => (
                  <div key={idx} className={log.includes('ERROR') ? 'text-rose-500 font-bold' : log.includes('==') ? 'text-blue-400 font-black' : 'text-slate-300'}>
                    {log}
                  </div>
                ))}
                {logs.length === 0 && (
                  <span className="text-slate-600 italic">Haga clic en Iniciar Migración para ver los registros aquí.</span>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
