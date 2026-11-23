'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Link2,
  Loader2,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Store,
  Trash2,
  Warehouse,
  X
} from 'lucide-react';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface BranchRow {
  id: string;
  name: string;
}

interface WarehouseRow {
  id: string;
  name: string;
  branch_id?: string | null;
}

interface PosStationRow {
  id: string;
  name: string;
  warehouse_id: string;
  warehouse_name: string;
  station_role?: 'EMISORA_PRINCIPAL' | 'PREFACTURACION_ONLY';
}

export default function WarehousesAndRegistersTab() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [posStations, setPosStations] = useState<PosStationRow[]>([]);
  const [stockByWarehouse, setStockByWarehouse] = useState<Record<string, { skuCount: number; totalUnits: number }>>({});

  // Paso 1: Sucursales
  const [newBranchName, setNewBranchName] = useState('');
  const [savingBranch, setSavingBranch] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchRow | null>(null);
  const [editBranchName, setEditBranchName] = useState('');

  // Paso 2: Bodegas
  const [newWarehouseName, setNewWarehouseName] = useState('');
  const [newWarehouseBranchId, setNewWarehouseBranchId] = useState<string>('');
  const [savingWarehouse, setSavingWarehouse] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseRow | null>(null);
  const [editWarehouseName, setEditWarehouseName] = useState('');
  const [editWarehouseBranchId, setEditWarehouseBranchId] = useState<string>('__none');

  // Paso 3: Cajas POS
  const [newStationName, setNewStationName] = useState('');
  const [newStationWarehouseId, setNewStationWarehouseId] = useState<string>('');
  const [newStationRole, setNewStationRole] = useState<'EMISORA_PRINCIPAL' | 'PREFACTURACION_ONLY'>('EMISORA_PRINCIPAL');
  const [savingStation, setSavingStation] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [brRes, whRes, stRes, stockRes] = await Promise.all([
        supabase.from('branches').select('id, name').order('name'),
        supabase.from('warehouses').select('id, name, branch_id').order('name'),
        supabase.from('system_config').select('value').eq('key', 'pos_stations').maybeSingle(),
        supabase.from('inventory_stock').select('warehouse_id, sku, quantity')
      ]);

      const brList = (brRes.data || []) as BranchRow[];
      const whList = (whRes.data || []) as WarehouseRow[];
      const stations = Array.isArray(stRes.data?.value) ? (stRes.data.value as PosStationRow[]) : [];

      const statsMap: Record<string, { skuCount: number; totalUnits: number }> = {};
      (stockRes.data || []).forEach((row: any) => {
        const wId = row.warehouse_id;
        if (!wId) return;
        const qty = Number(row.quantity) || 0;
        if (!statsMap[wId]) statsMap[wId] = { skuCount: 0, totalUnits: 0 };
        if (qty > 0) statsMap[wId].skuCount += 1;
        statsMap[wId].totalUnits += qty;
      });

      setBranches(brList);
      setWarehouses(whList);
      setPosStations(stations);
      setStockByWarehouse(statsMap);

      if (!newWarehouseBranchId && brList.length > 0) {
        setNewWarehouseBranchId(brList[0].id);
      }
      if (!newStationWarehouseId && whList.length > 0) {
        setNewStationWarehouseId(whList[0].id);
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error cargando estructura logística',
        description: err?.message || 'No se pudieron cargar sucursales, bodegas y cajas.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // --- CRUD SUCURSALES ---
  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    setSavingBranch(true);
    try {
      const { error } = await supabase.from('branches').insert({ name: newBranchName.trim() });
      if (error) throw error;
      toast({ title: 'Sucursal Creada', description: `"${newBranchName.trim()}" registrada.` });
      setNewBranchName('');
      await loadAll();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al crear sucursal', description: err?.message });
    } finally {
      setSavingBranch(false);
    }
  };

  const handleSaveBranchEdit = async () => {
    if (!editingBranch || !editBranchName.trim()) return;
    try {
      const { error } = await supabase.from('branches').update({ name: editBranchName.trim() }).eq('id', editingBranch.id);
      if (error) throw error;
      toast({ title: 'Sucursal Actualizada' });
      setEditingBranch(null);
      await loadAll();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al actualizar sucursal', description: err?.message });
    }
  };

  const handleDeleteBranch = async (branch: BranchRow) => {
    const linkedWh = warehouses.filter((w) => w.branch_id === branch.id);
    if (linkedWh.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Sucursal en uso',
        description: `Tiene ${linkedWh.length} bodega(s) asignada(s). Reasígnalas primero antes de eliminar.`
      });
      return;
    }
    if (!window.confirm(`¿Eliminar la sucursal "${branch.name}"?`)) return;
    try {
      const { error } = await supabase.from('branches').delete().eq('id', branch.id);
      if (error) throw error;
      toast({ title: 'Sucursal Eliminada' });
      await loadAll();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al eliminar sucursal', description: err?.message });
    }
  };

  // --- CRUD BODEGAS ---
  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWarehouseName.trim()) {
      toast({ variant: 'destructive', title: 'Nombre requerido', description: 'Ingresa el nombre de la bodega.' });
      return;
    }
    setSavingWarehouse(true);
    try {
      const payload: any = {
        name: newWarehouseName.trim(),
        branch_id: newWarehouseBranchId && newWarehouseBranchId !== '__none' ? newWarehouseBranchId : null
      };
      const { error } = await supabase.from('warehouses').insert(payload);
      if (error) throw error;
      toast({ title: 'Bodega Creada', description: `"${newWarehouseName.trim()}" ya está disponible para stock y cajas.` });
      setNewWarehouseName('');
      await loadAll();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al crear bodega', description: err?.message });
    } finally {
      setSavingWarehouse(false);
    }
  };

  const handleSaveWarehouseEdit = async () => {
    if (!editingWarehouse || !editWarehouseName.trim()) return;
    try {
      const nextBranchId = editWarehouseBranchId === '__none' ? null : editWarehouseBranchId;
      const nextName = editWarehouseName.trim();
      const { error } = await supabase
        .from('warehouses')
        .update({ name: nextName, branch_id: nextBranchId })
        .eq('id', editingWarehouse.id);
      if (error) throw error;

      // Sincronizar warehouse_name en cajas vinculadas si cambió el nombre
      if (nextName !== editingWarehouse.name) {
        const updatedStations = posStations.map((st) =>
          st.warehouse_id === editingWarehouse.id ? { ...st, warehouse_name: nextName } : st
        );
        await supabase.from('system_config').upsert({ key: 'pos_stations', value: updatedStations }, { onConflict: 'key' });
      }

      toast({ title: 'Bodega Actualizada', description: `"${nextName}" actualizada correctamente.` });
      setEditingWarehouse(null);
      await loadAll();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al editar bodega', description: err?.message });
    }
  };

  const handleDeleteWarehouse = async (wh: WarehouseRow) => {
    const linkedStations = posStations.filter((st) => st.warehouse_id === wh.id);
    if (linkedStations.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Bodega vinculada a Caja POS',
        description: `Primero cambia la bodega en ${linkedStations.map((s) => s.name).join(', ')}.`
      });
      return;
    }
    if (!window.confirm(`¿Eliminar la bodega "${wh.name}"? Esta acción afectará los registros de stock de esta bodega.`)) return;
    try {
      const { error } = await supabase.from('warehouses').delete().eq('id', wh.id);
      if (error) throw error;
      toast({ title: 'Bodega Eliminada' });
      await loadAll();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al eliminar bodega', description: err?.message });
    }
  };

  // --- CRUD CAJAS POS ---
  const persistStations = async (updated: PosStationRow[], successMsg: string) => {
    const { error } = await supabase
      .from('system_config')
      .upsert({ key: 'pos_stations', value: updated, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
    setPosStations(updated);
    toast({ title: successMsg });
  };

  const handleCreateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStationName.trim() || !newStationWarehouseId) {
      toast({ variant: 'destructive', title: 'Campos requeridos', description: 'Ingresa nombre de caja y elige su bodega.' });
      return;
    }
    setSavingStation(true);
    try {
      const wh = warehouses.find((w) => w.id === newStationWarehouseId);
      const nextStation: PosStationRow = {
        id: crypto.randomUUID(),
        name: newStationName.trim(),
        warehouse_id: newStationWarehouseId,
        warehouse_name: wh?.name || 'Bodega',
        station_role: newStationRole
      };
      await persistStations([...posStations, nextStation], `Caja "${nextStation.name}" vinculada a "${nextStation.warehouse_name}"`);
      setNewStationName('');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al crear caja', description: err?.message });
    } finally {
      setSavingStation(false);
    }
  };

  const handleChangeStationWarehouse = async (stationId: string, newWhId: string) => {
    const wh = warehouses.find((w) => w.id === newWhId);
    if (!wh) return;
    try {
      const updated = posStations.map((st) =>
        st.id === stationId ? { ...st, warehouse_id: wh.id, warehouse_name: wh.name } : st
      );
      await persistStations(updated, `Bodega de caja actualizada a "${wh.name}"`);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al cambiar bodega', description: err?.message });
    }
  };

  const handleChangeStationRole = async (stationId: string, role: 'EMISORA_PRINCIPAL' | 'PREFACTURACION_ONLY') => {
    try {
      const updated = posStations.map((st) => (st.id === stationId ? { ...st, station_role: role } : st));
      await persistStations(updated, 'Rol de caja actualizado');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al cambiar rol', description: err?.message });
    }
  };

  const handleDeleteStation = async (st: PosStationRow) => {
    if (!window.confirm(`¿Eliminar la caja "${st.name}"?`)) return;
    try {
      const updated = posStations.filter((s) => s.id !== st.id);
      await persistStations(updated, `Caja "${st.name}" eliminada`);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al eliminar caja', description: err?.message });
    }
  };

  // --- DIAGNÓSTICO DE CONEXIONES ---
  const diagnostics = useMemo(() => {
    const whIds = new Set(warehouses.map((w) => w.id));
    const warehousesWithoutBranch = warehouses.filter((w) => !w.branch_id || !branches.some((b) => b.id === w.branch_id));
    const stationsWithInvalidWarehouse = posStations.filter((s) => !s.warehouse_id || !whIds.has(s.warehouse_id));
    const branchesWithoutWarehouse = branches.filter((b) => !warehouses.some((w) => w.branch_id === b.id));
    const totalUnits = Object.values(stockByWarehouse).reduce((acc, v) => acc + v.totalUnits, 0);

    return {
      warehousesWithoutBranch,
      stationsWithInvalidWarehouse,
      branchesWithoutWarehouse,
      totalUnits,
      hasWarnings:
        warehousesWithoutBranch.length > 0 ||
        stationsWithInvalidWarehouse.length > 0 ||
        branchesWithoutWarehouse.length > 0
    };
  }, [branches, warehouses, posStations, stockByWarehouse]);

  return (
    <div className="space-y-6">
      {/* KPIs + Botón Actualizar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card border-border rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">1. Sucursales</p>
              <p className="text-2xl font-black text-foreground">{branches.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Building2 size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">2. Bodegas</p>
              <p className="text-2xl font-black text-foreground">{warehouses.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Warehouse size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">3. Cajas POS</p>
              <p className="text-2xl font-black text-foreground">{posStations.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Store size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Unidades en Stock</p>
              <p className="text-2xl font-black text-foreground">{diagnostics.totalUnits.toLocaleString()}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={loadAll}
              disabled={loading}
              title="Recargar estructura"
              className="h-10 w-10 rounded-xl"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ALERTAS DE DIAGNÓSTICO */}
      {diagnostics.hasWarnings ? (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/35 text-xs space-y-1.5">
          <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <AlertTriangle size={15} />
            Se detectaron enlaces incompletos en tu estructura operativa:
          </div>
          <ul className="list-disc pl-5 space-y-0.5 text-amber-900/80 dark:text-amber-200/80">
            {diagnostics.branchesWithoutWarehouse.length > 0 && (
              <li>
                Sucursales sin bodega asignada:{' '}
                <strong>{diagnostics.branchesWithoutWarehouse.map((b) => b.name).join(', ')}</strong>.
              </li>
            )}
            {diagnostics.warehousesWithoutBranch.length > 0 && (
              <li>
                Bodegas sin sucursal:{' '}
                <strong>{diagnostics.warehousesWithoutBranch.map((w) => w.name).join(', ')}</strong> (edítalas abajo para asignarles sucursal).
              </li>
            )}
            {diagnostics.stationsWithInvalidWarehouse.length > 0 && (
              <li>
                Cajas sin bodega válida:{' '}
                <strong>{diagnostics.stationsWithInvalidWarehouse.map((s) => s.name).join(', ')}</strong> (selecciona una bodega en el Paso 3).
              </li>
            )}
          </ul>
        </div>
      ) : (
        !loading &&
        branches.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle2 size={15} />
            Estructura completa: todas las sucursales, bodegas y cajas POS están vinculadas correctamente.
          </div>
        )
      )}

      {/* FLUJO DE GESTIÓN EN 3 PASOS: 1. SUCURSALES -> 2. BODEGAS -> 3. CAJAS POS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* PASO 1: SUCURSALES */}
        <Card className="bg-card border-border rounded-2xl shadow-sm flex flex-col">
          <CardHeader className="p-4 border-b border-border">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center">
                1
              </span>
              Sucursales Físicas
            </CardTitle>
            <CardDescription className="text-xs">Crea los locales o tiendas de tu empresa.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4 flex-1">
            <form onSubmit={handleCreateBranch} className="flex gap-2">
              <Input
                placeholder="Ej. Sucursal Matriz..."
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                className="h-9 text-xs"
              />
              <Button type="submit" size="sm" disabled={savingBranch || !newBranchName.trim()} className="h-9 bg-blue-600 hover:bg-blue-700 text-white gap-1 px-3">
                {savingBranch ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Crear
              </Button>
            </form>

            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {branches.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-6">No hay sucursales creadas.</p>
              ) : (
                branches.map((br) => {
                  const whCount = warehouses.filter((w) => w.branch_id === br.id).length;
                  const isEditing = editingBranch?.id === br.id;
                  return (
                    <div key={br.id} className="p-2.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between gap-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <Input
                            value={editBranchName}
                            onChange={(e) => setEditBranchName(e.target.value)}
                            className="h-7 text-xs"
                          />
                          <Button type="button" size="icon" className="h-7 w-7 bg-emerald-600 text-white" onClick={handleSaveBranchEdit}>
                            <Save size={12} />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingBranch(null)}>
                            <X size={12} />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-foreground truncate">{br.name}</div>
                            <div className="text-[10px] text-muted-foreground">{whCount} bodega(s) asignada(s)</div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Renombrar sucursal"
                              onClick={() => {
                                setEditingBranch(br);
                                setEditBranchName(br.name);
                              }}
                            >
                              <Pencil size={12} />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-rose-500 hover:bg-rose-500/10"
                              title="Eliminar sucursal"
                              onClick={() => handleDeleteBranch(br)}
                            >
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* PASO 2: BODEGAS */}
        <Card className="bg-card border-border rounded-2xl shadow-sm flex flex-col">
          <CardHeader className="p-4 border-b border-border">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center">
                2
              </span>
              Bodegas / Almacenes
            </CardTitle>
            <CardDescription className="text-xs">Asigna cada bodega a su sucursal para controlar el inventario.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4 flex-1">
            <form onSubmit={handleCreateWarehouse} className="space-y-2">
              <Input
                placeholder="Ej. Bodega Central, Sala de Ventas..."
                value={newWarehouseName}
                onChange={(e) => setNewWarehouseName(e.target.value)}
                className="h-9 text-xs"
              />
              <div className="flex gap-2">
                <Select value={newWarehouseBranchId} onValueChange={setNewWarehouseBranchId}>
                  <SelectTrigger className="h-9 text-xs flex-1">
                    <SelectValue placeholder="Sucursal..." />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id} className="text-xs">
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="submit" size="sm" disabled={savingWarehouse || !newWarehouseName.trim()} className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white gap-1 px-3">
                  {savingWarehouse ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Crear
                </Button>
              </div>
            </form>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {warehouses.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-6">No hay bodegas creadas.</p>
              ) : (
                warehouses.map((wh) => {
                  const branchName = branches.find((b) => b.id === wh.branch_id)?.name;
                  const stockInfo = stockByWarehouse[wh.id] || { skuCount: 0, totalUnits: 0 };
                  const linkedCount = posStations.filter((s) => s.warehouse_id === wh.id).length;
                  return (
                    <div key={wh.id} className="p-2.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-xs font-bold text-foreground truncate">{wh.name}</div>
                        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                            {branchName || '⚠ Sin Sucursal'}
                          </Badge>
                          <span className="text-muted-foreground">
                            {stockInfo.skuCount} SKUs · {stockInfo.totalUnits} u.
                          </span>
                          {linkedCount > 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              · {linkedCount} caja(s)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Editar bodega o cambiar sucursal"
                          onClick={() => {
                            setEditingWarehouse(wh);
                            setEditWarehouseName(wh.name);
                            setEditWarehouseBranchId(wh.branch_id || '__none');
                          }}
                        >
                          <Pencil size={12} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-rose-500 hover:bg-rose-500/10"
                          title="Eliminar bodega"
                          onClick={() => handleDeleteWarehouse(wh)}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* PASO 3: CAJAS POS Y VÍNCULO CON BODEGA */}
        <Card className="bg-card border-border rounded-2xl shadow-sm flex flex-col">
          <CardHeader className="p-4 border-b border-border">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center">
                3
              </span>
              Cajas POS y Vínculo a Bodega
            </CardTitle>
            <CardDescription className="text-xs">Define de qué bodega descuenta cada caja al facturar.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4 flex-1">
            <form onSubmit={handleCreateStation} className="space-y-2">
              <Input
                placeholder="Ej. Caja 1 - Mostrador..."
                value={newStationName}
                onChange={(e) => setNewStationName(e.target.value)}
                className="h-9 text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <Select value={newStationWarehouseId} onValueChange={setNewStationWarehouseId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Bodega..." />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id} className="text-xs">
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={newStationRole} onValueChange={(v: any) => setNewStationRole(v)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMISORA_PRINCIPAL" className="text-xs">Caja Emisora DTE</SelectItem>
                    <SelectItem value="PREFACTURACION_ONLY" className="text-xs">Pre-Facturación</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={savingStation || !newStationName.trim() || !newStationWarehouseId}
                className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-bold"
              >
                {savingStation ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                Crear y Vincular Caja
              </Button>
            </form>

            <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
              {posStations.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-6">No hay cajas POS configuradas.</p>
              ) : (
                posStations.map((st) => (
                  <div key={st.id} className="p-2.5 rounded-xl bg-muted/40 border border-border space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-foreground truncate">{st.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-rose-500 hover:bg-rose-500/10"
                        title="Eliminar caja"
                        onClick={() => handleDeleteStation(st)}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Select value={st.warehouse_id} onValueChange={(val) => handleChangeStationWarehouse(st.id, val)}>
                        <SelectTrigger className="h-7 text-[11px] bg-background">
                          <SelectValue placeholder="Bodega..." />
                        </SelectTrigger>
                        <SelectContent>
                          {warehouses.map((w) => (
                            <SelectItem key={w.id} value={w.id} className="text-xs">
                              {w.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={st.station_role || 'EMISORA_PRINCIPAL'}
                        onValueChange={(v: any) => handleChangeStationRole(st.id, v)}
                      >
                        <SelectTrigger className="h-7 text-[11px] bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EMISORA_PRINCIPAL" className="text-xs">Emisora DTE</SelectItem>
                          <SelectItem value="PREFACTURACION_ONLY" className="text-xs">Pre-Factura</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MAPA VISUAL DE CONEXIONES: SUCURSAL -> BODEGAS -> CAJAS */}
      <Card className="bg-card border-border rounded-2xl shadow-sm">
        <CardHeader className="p-4 border-b border-border">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Link2 size={15} className="text-indigo-500" />
            Mapa Visual de Conexiones (Sucursal → Bodega → Caja POS)
          </CardTitle>
          <CardDescription className="text-xs">
            Verifica de un vistazo qué bodega alimenta a cada caja y cuánta mercadería tiene disponible.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {branches.length === 0 && warehouses.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              Crea tu primera sucursal y bodega arriba para visualizar el mapa operativo.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {branches.map((br) => {
                const brWarehouses = warehouses.filter((w) => w.branch_id === br.id);
                return (
                  <div key={br.id} className="p-4 rounded-2xl bg-muted/25 border border-border space-y-3">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60">
                      <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                        <Building2 size={15} className="text-blue-500" />
                        {br.name}
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {brWarehouses.length} bodega(s)
                      </Badge>
                    </div>

                    {brWarehouses.length === 0 ? (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 italic">
                        Sin bodegas asignadas todavía.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {brWarehouses.map((wh) => {
                          const whStations = posStations.filter((s) => s.warehouse_id === wh.id);
                          const st = stockByWarehouse[wh.id] || { skuCount: 0, totalUnits: 0 };
                          return (
                            <div key={wh.id} className="p-3 rounded-xl bg-card border border-border space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                  <Warehouse size={13} className="text-indigo-500" /> {wh.name}
                                </span>
                                <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                                  <Package size={11} /> {st.skuCount} SKUs ({st.totalUnits} u.)
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {whStations.length === 0 ? (
                                  <span className="text-[10px] text-muted-foreground italic">
                                    Sin cajas POS vinculadas (solo almacén)
                                  </span>
                                ) : (
                                  whStations.map((s) => (
                                    <Badge
                                      key={s.id}
                                      variant="outline"
                                      className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1"
                                    >
                                      <Store size={10} /> {s.name}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {diagnostics.warehousesWithoutBranch.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 space-y-3">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-amber-500/30">
                    <div className="flex items-center gap-2 font-bold text-sm text-amber-800 dark:text-amber-300">
                      <AlertTriangle size={15} />
                      Bodegas sin Sucursal
                    </div>
                  </div>
                  <div className="space-y-2">
                    {diagnostics.warehousesWithoutBranch.map((wh) => (
                      <div key={wh.id} className="p-2.5 rounded-xl bg-card border border-border flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{wh.name}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px]"
                          onClick={() => {
                            setEditingWarehouse(wh);
                            setEditWarehouseName(wh.name);
                            setEditWarehouseBranchId('__none');
                          }}
                        >
                          Asignar Sucursal
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL EDITAR BODEGA */}
      <Dialog open={!!editingWarehouse} onOpenChange={(open) => !open && setEditingWarehouse(null)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Warehouse size={16} className="text-indigo-500" /> Editar Bodega
            </DialogTitle>
            <DialogDescription className="text-xs">
              Actualiza el nombre o la sucursal a la que pertenece esta bodega.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Nombre de la Bodega</Label>
              <Input
                value={editWarehouseName}
                onChange={(e) => setEditWarehouseName(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Sucursal Asociada</Label>
              <Select value={editWarehouseBranchId} onValueChange={setEditWarehouseBranchId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Seleccione sucursal..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none" className="text-xs">Sin sucursal asignada</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs">
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditingWarehouse(null)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleSaveWarehouseEdit} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
