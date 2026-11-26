'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/Sidebar';
import GmailClient from '@/components/shared/GmailClient';
import { 
  Sparkles, 
  Plus, 
  Users, 
  TrendingUp, 
  CheckSquare, 
  MessageSquare, 
  Search, 
  SlidersHorizontal, 
  Trash2, 
  Edit3, 
  Clock, 
  AlertTriangle,
  ChevronRight,
  Loader2,
  Calendar,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  ArrowRight,
  Info,
  DollarSign,
  UserCheck,
  Package,
  FileText,
  MapPin,
  ListTodo,
  Navigation,
  Mails,
  Car,
  Crosshair,
  ArrowUpDown
} from 'lucide-react';
import { useUser } from '@/supabase/use-user';
import { supabase } from '@/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import RetentionTab from './components/RetentionTab';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DailySalesAgendaTab from './components/DailySalesAgendaTab';
import { CrmMap, SellerRouteStop, calculateDistanceKm } from '@/components/CrmMap';
import { useBms } from '@/contexts/BmsContext';
import { fetchSystemAppUsers } from '@/lib/session-operator';

const STAGES = [
  { id: 'PROSPECTO', label: 'Prospecto (Lead)', color: 'border-t-slate-500 bg-slate-500/5 text-slate-400' },
  { id: 'CONTACTO', label: 'Contacto Inicial', color: 'border-t-blue-500 bg-blue-500/5 text-blue-400' },
  { id: 'COTIZADO', label: 'Cotización Enviada', color: 'border-t-orange-500 bg-orange-500/5 text-orange-400' },
  { id: 'NEGOCIACION', label: 'Negociación', color: 'border-t-purple-500 bg-purple-500/5 text-purple-400' },
  { id: 'GANADA', label: 'Negocio Ganado 🎉', color: 'border-t-emerald-500 bg-emerald-500/5 text-emerald-400' },
  { id: 'PERDIDA', label: 'Negocio Perdido ❌', color: 'border-t-rose-500 bg-rose-500/5 text-rose-400' }
];

export default function CRMPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const { mapData, setMapData } = useBms();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);

  // Datos
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [stagnantProducts, setStagnantProducts] = useState<any[]>([]);



  // Modales y estados de formularios
  const [isOppModalOpen, setIsOppModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState<any | null>(null);

  // Formulario Oportunidad
  const [oppForm, setOppForm] = useState({
    id: '',
    title: '',
    customer_id: 'none',
    contact_name: '',
    estimated_value: '0',
    stage: 'PROSPECTO',
    priority: 'MEDIA',
    notes: '',
    suggested_sku: 'none'
  });

  // Formulario Interacción
  const [newInteraction, setNewInteraction] = useState({
    interaction_type: 'LLAMADA',
    summary: '',
    detail: ''
  });

  // Formulario Tarea
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: 'MEDIA'
  });

  const [savingOpp, setSavingOpp] = useState(false);
  const [savingInteraction, setSavingInteraction] = useState(false);
  const [savingTask, setSavingTask] = useState(false);

  // Búsqueda y filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [isCreatingQuotation, setIsCreatingQuotation] = useState(false);

  // Estado persistente de Rutas de Vendedores (Mapa CRM)
  const [sellerRouteStops, setSellerRouteStops] = useState<SellerRouteStop[]>([]);
  const [crmSellers, setCrmSellers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [crmBranches, setCrmBranches] = useState<{ id: string; name: string }[]>([]);
  const [selectedRouteSeller, setSelectedRouteSeller] = useState<string>('all');
  const [focusedStopId, setFocusedStopId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [originLabel, setOriginLabel] = useState<string>('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [sortByNearest, setSortByNearest] = useState(false);

  const handleSetManualOrigin = (coords: { lat: number; lng: number }, label = 'Ubicación Manual') => {
    setUserLocation(coords);
    setOriginLabel(label);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('nexway_crm_manual_origin', JSON.stringify({ coords, label }));
      } catch {}
    }
    toast({
      title: 'Punto de Salida Actualizado 📍',
      description: `Origen fijado en "${label}" (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}).`
    });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('nexway_crm_manual_origin');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.coords?.lat && parsed?.coords?.lng) {
          setUserLocation(parsed.coords);
          setOriginLabel(parsed.label || 'Ubicación Guardada');
        }
      }
    } catch {}
  }, []);

  const requestLiveGps = (silent = false) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      if (!silent) {
        toast({
          variant: 'destructive',
          title: 'GPS no disponible',
          description: 'Tu navegador no soporta geolocalización o requiere conexión segura (HTTPS).'
        });
      }
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        setOriginLabel('GPS del Dispositivo');
        setGpsLoading(false);
        if (!silent) {
          toast({
            title: 'GPS Activado 📍',
            description: `Ubicación detectada (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}). Las rutas ahora salen desde tu punto actual.`
          });
        }
      },
      (err) => {
        setGpsLoading(false);
        if (!silent) {
          const reason =
            err.code === 1
              ? 'Permiso de ubicación denegado. Permite el acceso a la ubicación en el candado del navegador.'
              : err.code === 2
              ? 'No se pudo obtener señal de ubicación en este dispositivo.'
              : 'Tiempo de espera agotado al buscar señal GPS.';
          toast({ variant: 'destructive', title: 'No se pudo activar el GPS', description: reason });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  const persistSellerRouteStops = async (nextStops: SellerRouteStop[]) => {
    setSellerRouteStops(nextStops);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('nexway_crm_seller_routes', JSON.stringify(nextStops));
      } catch {}
    }
    try {
      await supabase.from('system_config').upsert(
        {
          key: 'crm_seller_routes',
          value: nextStops},
        { onConflict: 'key' }
      );
    } catch (e) {
      console.warn('Advertencia guardando rutas de vendedores:', e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const limit30d = new Date();
      limit30d.setDate(limit30d.getDate() - 30);

      // Ejecutar todas las consultas del CRM en paralelo
      const [
        usersList,
        routesCfgRes,
        branchesRes,
        oppsRes,
        custsRes,
        invRes,
        stocksRes,
        salesRes
      ] = await Promise.all([
        fetchSystemAppUsers(),
        supabase.from('system_config').select('value').eq('key', 'crm_seller_routes').maybeSingle(),
        supabase.from('branches').select('id, name').order('name'),
        supabase.from('crm_opportunities').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('customers').select('id, name, email, phone, address, credit_limit').order('name').limit(300),
        supabase.from('inventory').select('sku, name, price'),
        supabase.from('inventory_stock').select('sku, quantity'),
        supabase.from('sales_items').select('sku, sales!inner(created_at, status)').neq('sales.status', 'CANCELADA').gte('sales.created_at', limit30d.toISOString()).limit(500)
      ]);

      setCrmSellers(usersList.map(u => ({ id: u.id, full_name: u.full_name, email: u.email })));
      setCrmBranches((branchesRes.data || []).map((b: any) => ({ id: b.id, name: b.name })));
      setOpportunities(oppsRes.data || []);
      const custs = custsRes.data || [];
      setCustomers(custs);

      // Cargar rutas persistidas o inicializar desde clientes reales
      let savedStops: SellerRouteStop[] = [];
      if (Array.isArray(routesCfgRes.data?.value) && routesCfgRes.data.value.length > 0) {
        savedStops = routesCfgRes.data.value;
      } else if (typeof window !== 'undefined') {
        try {
          const rawLocal = localStorage.getItem('nexway_crm_seller_routes');
          if (rawLocal) savedStops = JSON.parse(rawLocal);
        } catch {}
      }

      if (savedStops.length === 0 && custs.length > 0) {
        savedStops = custs.slice(0, 8).map((c: any, idx: number) => ({
          id: `cust-stop-${c.id}`,
          customerId: c.id,
          name: c.name,
          lat: 13.6929 + ((idx % 4) - 1.5) * 0.012,
          lng: -89.2182 + (Math.floor(idx / 4) - 0.5) * 0.015,
          type: (c.credit_limit || 0) > 0 ? 'VIP' : 'DELIVERY',
          balance: Number(c.credit_limit) || 0,
          address: c.address || 'San Salvador',
          phone: c.phone || '',
          sellerEmail: '',
          sellerName: 'Ruta General',
          visited: false
        }));
      }
      setSellerRouteStops(savedStops);

      const inv = invRes.data || [];
      setInventory(inv);

      const soldSkuSet = new Set<string>();
      (salesRes.data || []).forEach((row: any) => {
        if (row?.sku) soldSkuSet.add(row.sku);
      });

      const stockMap: Record<string, number> = {};
      (stocksRes.data || []).forEach(st => {
        stockMap[st.sku] = (stockMap[st.sku] || 0) + (parseFloat(st.quantity) || 0);
      });

      const stagnant = inv
        .filter(p => (stockMap[p.sku] || 0) > 10 && !soldSkuSet.has(p.sku))
        .map(p => ({ ...p, stock: stockMap[p.sku] }));

      setStagnantProducts(stagnant);
    } catch (error) {
      console.error('Error al cargar CRM:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    requestLiveGps(true);
  }, []);

  // Cargar detalles cuando se selecciona una oportunidad
  const loadOppDetails = async (oppId: string) => {
    try {
      // Interacciones
      const { data: inters } = await supabase
        .from('crm_interactions')
        .select('*')
        .eq('opportunity_id', oppId)
        .order('created_at', { ascending: false });
      setInteractions(inters || []);

      // Tareas
      const { data: tsk } = await supabase
        .from('crm_tasks')
        .select('*')
        .eq('opportunity_id', oppId)
        .order('due_date', { ascending: true });
      setTasks(tsk || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenDetail = (opp: any) => {
    setSelectedOpp(opp);
    loadOppDetails(opp.id);
    setIsDetailModalOpen(true);
  };

  // Crear o Editar Oportunidad
  const handleSaveOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oppForm.title.trim()) return;
    setSavingOpp(true);

    try {
      const payload: any = {
        title: oppForm.title,
        customer_id: oppForm.customer_id === 'none' ? null : oppForm.customer_id,
        contact_name: oppForm.contact_name || null,
        estimated_value: parseFloat(oppForm.estimated_value) || 0,
        stage: oppForm.stage,
        priority: oppForm.priority,
        notes: oppForm.notes,
        suggested_sku: oppForm.suggested_sku === 'none' ? null : oppForm.suggested_sku,
        assigned_to: user?.email,
        updated_at: new Date().toISOString()
      };

      if (oppForm.id) {
        // Editar
        const { error } = await supabase
          .from('crm_opportunities')
          .update(payload)
          .eq('id', oppForm.id);
        if (error) throw error;
        toast({ title: "Negocio Actualizado", description: "La oportunidad comercial se guardó con éxito." });
      } else {
        // Crear nuevo
        const { error } = await supabase
          .from('crm_opportunities')
          .insert(payload);
        if (error) throw error;
        toast({ title: "Negocio Creado", description: "Se registró la oportunidad en el embudo comercial." });
      }

      setIsOppModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo guardar la oportunidad." });
    } finally {
      setSavingOpp(false);
    }
  };

  // Eliminar oportunidad
  const handleDeleteOpportunity = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Estás seguro de eliminar esta oportunidad comercial? Todo su historial de interacciones y tareas será borrado.')) return;
    try {
      const { error } = await supabase
        .from('crm_opportunities')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast({ title: "Oportunidad Eliminada", description: "Se removió el negocio del embudo." });
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  // Agregar Interacción
  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInteraction.summary.trim() || !selectedOpp) return;
    setSavingInteraction(true);

    try {
      const { error } = await supabase
        .from('crm_interactions')
        .insert({
          opportunity_id: selectedOpp.id,
          customer_id: selectedOpp.customer_id,
          interaction_type: newInteraction.interaction_type,
          summary: newInteraction.summary,
          detail: newInteraction.detail,
          created_by: user?.email || 'Vendedor'
        });

      if (error) throw error;
      toast({ title: "Interacción Registrada", description: "Se agregó la nota comercial al historial." });
      setNewInteraction({ interaction_type: 'LLAMADA', summary: '', detail: '' });
      await loadOppDetails(selectedOpp.id);
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSavingInteraction(false);
    }
  };

  // Agregar Tarea / Recordatorio
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim() || !newTask.due_date || !selectedOpp) return;
    setSavingTask(true);

    try {
      const { error } = await supabase
        .from('crm_tasks')
        .insert({
          opportunity_id: selectedOpp.id,
          title: newTask.title,
          description: newTask.description,
          due_date: new Date(newTask.due_date).toISOString(),
          priority: newTask.priority,
          assigned_to: user?.email || 'Vendedor'
        });

      if (error) throw error;
      toast({ title: "Tarea Programada", description: "El recordatorio comercial ha sido agendado." });
      setNewTask({ title: '', description: '', due_date: '', priority: 'MEDIA' });
      await loadOppDetails(selectedOpp.id);
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSavingTask(false);
    }
  };

  // Completar Tarea
  const handleCompleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('crm_tasks')
        .update({ status: 'COMPLETADA' })
        .eq('id', taskId);
      if (error) throw error;
      toast({ title: "Tarea Completada", description: "El recordatorio fue marcado como realizado." });
      if (selectedOpp) await loadOppDetails(selectedOpp.id);
    } catch (err: any) {
      console.error(err);
    }
  };

  // Crear Cotización automática en ERP
  const handleCreateQuotationERP = async () => {
    if (!selectedOpp) return;
    setIsCreatingQuotation(true);
    try {
      // 1. Obtener datos del cliente
      const clientName = selectedOpp.contact_name || customers.find(c => c.id === selectedOpp.customer_id)?.name || 'Cliente CRM';
      
      // 2. Si hay un SKU sugerido, preparamos el JSON de items para la cotización
      let quoteItems: any[] = [];
      let totalAmount = selectedOpp.estimated_value || 0;
      
      if (selectedOpp.suggested_sku && selectedOpp.suggested_sku !== 'none') {
        const matchingProduct = inventory.find(p => p.sku === selectedOpp.suggested_sku);
        if (matchingProduct) {
          quoteItems = [{
            sku: matchingProduct.sku,
            name: matchingProduct.name,
            quantity: 1,
            price: matchingProduct.price,
            subtotal: matchingProduct.price,
            total: matchingProduct.price
          }];
          totalAmount = matchingProduct.price;
        }
      } else {
        // Fallback: concepto de servicio/propuesta genérica
        quoteItems = [{
          sku: 'SERV-CRM',
          name: selectedOpp.title,
          quantity: 1,
          price: selectedOpp.estimated_value || 0,
          subtotal: selectedOpp.estimated_value || 0,
          total: selectedOpp.estimated_value || 0
        }];
      }

      const { error } = await supabase
        .from('quotations')
        .insert({
          customer_name: clientName,
          items: quoteItems,
          subtotal: totalAmount,
          iva: totalAmount * 0.13, // IVA estándar de El Salvador (13%)
          total: totalAmount * 1.13,
          status: 'PENDIENTE'
        });

      if (error) throw error;

      // 3. Registrar interacción comercial automática
      await supabase.from('crm_interactions').insert({
        opportunity_id: selectedOpp.id,
        interaction_type: 'CORREO',
        summary: 'Cotización ERP Generada',
        detail: `Se generó automáticamente el documento de Cotización oficial en el ERP para el cliente "${clientName}" por un total estimado de $${totalAmount.toLocaleString()}.`,
        created_by: user?.email || 'Sistema'
      });

      toast({ 
        title: "Cotización Creada 🎉", 
        description: `Se registró la cotización en el ERP para ${clientName} exitosamente.` 
      });
      
      await loadOppDetails(selectedOpp.id);
    } catch (err: any) {
      console.error(err);
      toast({ 
        variant: "destructive", 
        title: "Error al cotizar", 
        description: err.message || "No se pudo generar la cotización." 
      });
    } finally {
      setIsCreatingQuotation(false);
    }
  };

  // Filtrar oportunidades en base a búsqueda y prioridad
  const filteredOpps = useMemo(() => {
    return opportunities.filter(opp => {
      const matchesSearch = opp.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (opp.contact_name && opp.contact_name.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesPriority = priorityFilter === 'all' || opp.priority === priorityFilter;
      return matchesSearch && matchesPriority;
    });
  }, [opportunities, searchQuery, priorityFilter]);

  // Agrupar oportunidades por etapa del embudo
  const oppsByStage = useMemo(() => {
    const groups: Record<string, any[]> = {};
    STAGES.forEach(s => { groups[s.id] = []; });
    filteredOpps.forEach(opp => {
      if (groups[opp.stage]) {
        groups[opp.stage].push(opp);
      }
    });
    return groups;
  }, [filteredOpps]);

  // Actualizar etapa arrastrando (simulada con botones rápidos en tarjetas para evitar bugs de librerías en Next 15)
  const handleMoveStage = async (oppId: string, nextStage: string) => {
    try {
      const { error } = await supabase
        .from('crm_opportunities')
        .update({ stage: nextStage, updated_at: new Date().toISOString() })
        .eq('id', oppId);
      if (error) throw error;
      
      // Registrar interacción automática
      await supabase.from('crm_interactions').insert({
        opportunity_id: oppId,
        interaction_type: 'NOTA',
        summary: `Etapa comercial actualizada a: ${nextStage}`,
        detail: 'Cambio de estado en el embudo comercial.',
        created_by: user?.email || 'Sistema'
      });

      toast({ title: "Etapa de Venta Actualizada" });
      await loadData();
    } catch (err: any) {
      console.error(err);
    }
  };

  const openCreateOppModal = () => {
    setOppForm({
      id: '',
      title: '',
      customer_id: 'none',
      contact_name: '',
      estimated_value: '0',
      stage: 'PROSPECTO',
      priority: 'MEDIA',
      notes: '',
      suggested_sku: 'none'
    });
    setIsOppModalOpen(true);
  };

  const openEditOppModal = (opp: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setOppForm({
      id: opp.id,
      title: opp.title,
      customer_id: opp.customer_id || 'none',
      contact_name: opp.contact_name || '',
      estimated_value: opp.estimated_value?.toString() || '0',
      stage: opp.stage,
      priority: opp.priority,
      notes: opp.notes || '',
      suggested_sku: opp.suggested_sku || 'none'
    });
    setIsOppModalOpen(true);
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
        {/* Cabecera del CRM */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 rounded-2xl border border-border shadow-sm">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-foreground font-headline flex items-center gap-2">
              <Sparkles className="text-amber-500 animate-pulse" size={24} /> CRM Comercial y Embudo de Ventas
            </h1>
            <p className="text-xs text-muted-foreground mt-1">Monitorea prospectos, programa llamadas de seguimiento y rota stock vinculando oportunidades.</p>
          </div>
          <Button onClick={openCreateOppModal} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs gap-1.5 h-10 px-4 shrink-0 transition-all">
            <Plus size={16} /> Nueva Oportunidad
          </Button>
        </div>

        {/* Foco de Ventas Integrado ( KPI de Stock Estancado como Oportunidad Comercial) */}
        {stagnantProducts.length > 0 && (
          <Card className="border border-amber-500/20 bg-amber-500/5 rounded-2xl overflow-hidden shadow-lg shadow-amber-500/5">
            <CardHeader className="p-4 bg-amber-500/10 border-b border-amber-500/20 flex flex-row items-center gap-3">
              <AlertTriangle className="text-amber-400 animate-bounce shrink-0" size={18} />
              <div>
                <CardTitle className="text-xs font-black uppercase text-amber-700 dark:text-amber-300 tracking-wider">Oportunidades de Rotación Urgente Detectadas</CardTitle>
                <CardDescription className="text-[10px] text-amber-700/80 dark:text-amber-200/70">Productos sin ventas en 30 días con alto volumen físico. Haz clic para crearles una oportunidad comercial.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-4 flex gap-3 overflow-x-auto">
              {stagnantProducts.slice(0, 4).map(prod => (
                <div key={prod.sku} className="bg-card p-3 rounded-xl border border-border min-w-[240px] flex flex-col justify-between shrink-0">
                  <div>
                    <span className="text-[8.5px] font-black uppercase font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/10">Estancado ({prod.stock} uds)</span>
                    <h4 className="text-xs font-bold text-foreground mt-2 truncate">{prod.name}</h4>
                    <p className="text-[9.5px] text-muted-foreground font-mono mt-0.5">SKU: {prod.sku} · Prom. ${prod.price}</p>
                  </div>
                  <Button 
                    onClick={() => {
                      setOppForm({
                        id: '',
                        title: `Rotación Especial: ${prod.name}`,
                        customer_id: 'none',
                        contact_name: 'Prospectos Varios',
                        estimated_value: (parseFloat(prod.price) * 10).toString(),
                        stage: 'PROSPECTO',
                        priority: 'ALTA',
                        notes: `Promoción activa para liberar stock físico de bodega. SKU: ${prod.sku}`,
                        suggested_sku: prod.sku
                      });
                      setIsOppModalOpen(true);
                    }}
                    variant="link" 
                    className="text-amber-400 hover:text-amber-300 text-[10px] p-0 h-auto self-start mt-3 font-bold"
                  >
                    Crear Campaña de Venta <ArrowRight size={10} className="ml-1" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Filtros e Historial */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full bg-card p-4 rounded-xl border border-border shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-3.5 h-3.5" />
            <Input 
              type="text" 
              placeholder="Buscar oportunidad o contacto..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 bg-background border-input text-xs font-medium rounded-lg w-full"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto shrink-0">
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-9 w-36 bg-background border-input rounded-lg text-xs font-bold">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-xs">
                <SelectItem value="all">Todas las prioridades</SelectItem>
                <SelectItem value="ALTA">Prioridad Alta 🔥</SelectItem>
                <SelectItem value="MEDIA">Prioridad Media ⚡</SelectItem>
                <SelectItem value="BAJA">Prioridad Baja 💤</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={loadData} variant="outline" size="sm" className="rounded-lg h-9 font-bold text-xs" disabled={loading}>
              {loading ? <Loader2 size={12} className="animate-spin" /> : '↺ Actualizar'}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="agenda" className="w-full mt-6">
          <TabsList className="bg-transparent p-0 h-auto flex flex-wrap w-full justify-start border-b border-slate-200 dark:border-white/10 gap-2 sm:gap-4 mb-5">
            <TabsTrigger value="agenda" className="rounded-none px-4 py-3 font-bold text-xs sm:text-sm text-slate-500 dark:text-white/50 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent transition-colors flex items-center gap-1.5">
              <Calendar size={15} /> 1. Agenda Diaria (Vendedores)
            </TabsTrigger>
            <TabsTrigger data-tour-id="tab-kanban" value="kanban" className="rounded-none px-4 py-3 font-bold text-xs sm:text-sm text-slate-500 dark:text-white/50 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors flex items-center gap-1.5">
              <SlidersHorizontal size={15} /> 2. Embudo Comercial (Kanban)
            </TabsTrigger>
            <TabsTrigger data-tour-id="tab-foco" value="foco" className="rounded-none px-4 py-3 font-bold text-xs sm:text-sm text-slate-500 dark:text-white/50 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-500 data-[state=active]:bg-transparent transition-colors flex items-center gap-1.5">
              <Package size={15} /> 3. Foco de Venta — Stock Estancado ({stagnantProducts.length})
            </TabsTrigger>
            <TabsTrigger data-tour-id="tab-retention" value="retention" className="rounded-none px-4 py-3 font-bold text-xs sm:text-sm text-slate-500 dark:text-white/50 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 data-[state=active]:bg-transparent transition-colors flex items-center gap-1.5">
              <AlertTriangle size={15} /> 4. Retención de Clientes
            </TabsTrigger>
            <TabsTrigger data-tour-id="tab-mapa" value="mapa" className="rounded-none px-4 py-3 font-bold text-xs sm:text-sm text-slate-500 dark:text-white/50 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:bg-transparent transition-colors flex items-center gap-1.5">
              <Navigation size={15} /> 5. Mapa de Rutas (Vendedores)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agenda" className="mt-0 outline-none">
            <DailySalesAgendaTab />
          </TabsContent>

          <TabsContent value="foco" className="mt-0 outline-none">
            <Card className="border shadow-sm rounded-2xl bg-card overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <CardTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2 text-foreground">
                    <Package className="text-amber-500" size={18} />
                    Foco de Venta — Productos sin Rotación (30 Días)
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Productos reales en inventario con existencias disponibles pero sin ventas recientes. Crea una oportunidad comercial con 1 clic para darles salida.
                  </CardDescription>
                </div>
                <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-mono text-xs font-black">
                  {stagnantProducts.length} SKUs para Priorizar
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border text-[10px] uppercase font-black text-muted-foreground">
                      <tr>
                        <th className="p-4 text-left">SKU</th>
                        <th className="p-4 text-left">Producto</th>
                        <th className="p-4 text-center">Existencias</th>
                        <th className="p-4 text-right">Precio Unit.</th>
                        <th className="p-4 text-right">Capital Retenido</th>
                        <th className="p-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {stagnantProducts.map((prod: any) => {
                        const tiedVal = (Number(prod.stock) || 0) * (Number(prod.price) || 0);
                        return (
                          <tr key={prod.sku} className="hover:bg-muted/30 transition-colors">
                            <td className="p-4 font-mono font-bold text-xs text-muted-foreground">{prod.sku}</td>
                            <td className="p-4 font-bold text-xs text-foreground">{prod.name}</td>
                            <td className="p-4 text-center">
                              <Badge variant="outline" className="font-mono text-xs border-amber-500/40 text-amber-600 dark:text-amber-400">
                                {prod.stock} uds
                              </Badge>
                            </td>
                            <td className="p-4 text-right font-mono text-xs">${(Number(prod.price) || 0).toFixed(2)}</td>
                            <td className="p-4 text-right font-mono font-black text-xs text-amber-600 dark:text-amber-400">
                              ${tiedVal.toFixed(2)}
                            </td>
                            <td className="p-4 text-right">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setOppForm({
                                    id: '',
                                    title: `Promoción ${prod.name}`,
                                    customer_id: 'none',
                                    contact_name: '',
                                    estimated_value: String(Math.round(tiedVal)),
                                    stage: 'PROSPECTO',
                                    priority: 'ALTA',
                                    suggested_sku: prod.sku,
                                    notes: `Impulsar rotación de ${prod.stock} unidades estancadas en bodega.`
                                  });
                                  setIsOppModalOpen(true);
                                }}
                                className="h-8 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl"
                              >
                                <Plus size={13} className="mr-1" /> Crear Oportunidad
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      {stagnantProducts.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-xs text-muted-foreground">
                            🎯 Excelente: no se detectan productos estancados sin rotación en los últimos 30 días.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="retention" className="outline-none mt-0">
             <RetentionTab />
          </TabsContent>

          <TabsContent value="kanban" className="mt-0 outline-none">
            {/* Embudo de Ventas Kanban */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-amber-500 w-8 h-8" />
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Cargando embudo comercial...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-start overflow-x-auto">
            {STAGES.map(stage => {
              const oppsInStage = oppsByStage[stage.id] || [];
              return (
                <div key={stage.id} className="flex flex-col rounded-xl bg-card border border-border min-w-[220px] max-h-[70vh] overflow-hidden shadow-sm">
                  {/* Título de Columna */}
                  <div className={`p-3.5 border-t-2 ${stage.color} flex items-center justify-between border-b border-border bg-muted/40`}>
                    <span className="text-[10px] font-black uppercase tracking-wider text-foreground">{stage.label}</span>
                    <Badge className="bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">{oppsInStage.length}</Badge>
                  </div>

                  {/* Tarjetas de Oportunidades */}
                  <div className="p-3 space-y-3 overflow-y-auto min-h-[150px]">
                    {oppsInStage.map(opp => (
                      <div 
                        key={opp.id} 
                        onClick={() => handleOpenDetail(opp)}
                        className="p-3.5 rounded-xl bg-card hover:bg-accent border border-border cursor-pointer transition-all duration-200 space-y-3.5 relative group shadow-sm"
                      >
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="text-xs font-bold text-foreground leading-snug group-hover:text-amber-500 transition-colors truncate max-w-[120px]">{opp.title}</h4>
                            <span className={`text-[8px] font-black font-mono px-1.5 py-0.5 rounded ${
                              opp.priority === 'ALTA' ? 'bg-rose-500/10 text-rose-500' : opp.priority === 'MEDIA' ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'
                            }`}>{opp.priority}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1 truncate">
                            👤 {opp.contact_name || customers.find(c => c.id === opp.customer_id)?.name || 'Sin contacto'}
                          </p>
                        </div>

                        {opp.suggested_sku && (
                          <div className="flex items-center gap-1 bg-amber-500/5 border border-amber-500/10 rounded px-1.5 py-0.5 text-[8.5px] text-amber-400 font-mono">
                            <Package size={10} /> Rotación SKU: {opp.suggested_sku}
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-2 border-t border-border/60 text-[10px]">
                          <span className="font-mono font-black text-emerald-400">${opp.estimated_value?.toLocaleString()}</span>
                          
                          {/* Controles de movimiento rápido en el Kanban */}
                          <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="w-5 h-5 text-indigo-400 hover:text-indigo-300 rounded" 
                              onClick={(e) => openEditOppModal(opp, e)}
                            >
                              <Edit3 size={10} />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="w-5 h-5 text-rose-500 hover:text-rose-400 rounded" 
                              onClick={(e) => handleDeleteOpportunity(opp.id, e)}
                            >
                              <Trash2 size={10} />
                            </Button>
                          </div>
                        </div>

                        {/* Botones de flujo rápido de etapa */}
                        <div className="grid grid-cols-2 gap-1 mt-2 pt-1 border-t border-border/60 opacity-0 group-hover:opacity-100 transition-all duration-300">
                          {opp.stage !== 'GANADA' && (
                            <Button 
                              onClick={(e) => { e.stopPropagation(); handleMoveStage(opp.id, 'GANADA'); }}
                              className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white text-[8px] font-bold py-1 h-5 rounded"
                            >
                              Ganar 🎉
                            </Button>
                          )}
                          {opp.stage !== 'PERDIDA' && (
                            <Button 
                              onClick={(e) => { e.stopPropagation(); handleMoveStage(opp.id, 'PERDIDA'); }}
                              className="bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white text-[8px] font-bold py-1 h-5 rounded"
                            >
                              Perder ❌
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {oppsInStage.length === 0 && (
                      <div className="py-8 text-center text-[10px] text-muted-foreground border border-dashed border-border/60 rounded-xl">Sin prospectos.</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
          </TabsContent>

          <TabsContent value="mapa" className="mt-0 outline-none">
            {(() => {
              const rawFilteredStops = selectedRouteSeller === 'all'
                ? sellerRouteStops
                : sellerRouteStops.filter(s => s.sellerEmail === selectedRouteSeller || !s.sellerEmail);

              const filteredStops = sortByNearest && userLocation
                ? [...rawFilteredStops].sort((a, b) => {
                    if (Boolean(a.visited) !== Boolean(b.visited)) return a.visited ? 1 : -1;
                    const dA = calculateDistanceKm(userLocation.lat, userLocation.lng, a.lat, a.lng);
                    const dB = calculateDistanceKm(userLocation.lat, userLocation.lng, b.lat, b.lng);
                    return dA - dB;
                  })
                : rawFilteredStops;

              const visitedCount = filteredStops.filter(s => s.visited).length;
              const progressPct = filteredStops.length > 0 ? Math.round((visitedCount / filteredStops.length) * 100) : 0;

              const originParam = userLocation ? `&origin=${userLocation.lat},${userLocation.lng}` : '';

              const handleOpenFullGoogleMapsRoute = () => {
                const pendingStops = filteredStops.filter(s => !s.visited);
                const targets = pendingStops.length > 0 ? pendingStops : filteredStops;
                if (targets.length === 0) {
                  toast({ variant: 'destructive', title: 'Sin paradas', description: 'Agrega al menos un cliente en el mapa para trazar la ruta.' });
                  return;
                }
                const dest = targets[targets.length - 1];
                const waypoints = targets.slice(0, -1).map(t => `${t.lat},${t.lng}`).join('|');
                const url = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${dest.lat},${dest.lng}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}&travelmode=driving`;
                window.open(url, '_blank');
              };

              const handleToggleStopVisited = (stopId: string) => {
                const next = sellerRouteStops.map(s =>
                  s.id === stopId
                    ? { ...s, visited: !s.visited, visitedAt: !s.visited ? new Date().toISOString() : undefined }
                    : s
                );
                persistSellerRouteStops(next);
              };

              const handleResetRouteVisits = () => {
                const next = sellerRouteStops.map(s => ({ ...s, visited: false, visitedAt: undefined }));
                persistSellerRouteStops(next);
                toast({ title: 'Jornada de Visitas Reiniciada', description: 'Todas las paradas quedaron listas como pendientes.' });
              };

              return (
                <div className="space-y-4">
                  {/* Barra Superior de Control de Ruta para Vendedores */}
                  <div className="bg-card border border-border rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground block">Filtrar Ruta por Vendedor</span>
                        <Select value={selectedRouteSeller} onValueChange={setSelectedRouteSeller}>
                          <SelectTrigger className="w-56 h-9 text-xs font-bold rounded-xl">
                            <UserCheck size={13} className="mr-1.5 text-indigo-500" />
                            <SelectValue placeholder="Todos los Vendedores" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos los Vendedores</SelectItem>
                            {crmSellers.map(s => (
                              <SelectItem key={s.id} value={s.email} className="text-xs">{s.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="min-w-[180px] space-y-1">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-muted-foreground">Avance de Visitas Hoy:</span>
                          <span className="text-emerald-600 dark:text-emerald-400">{visitedCount}/{filteredStops.length} ({progressPct}%)</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progressPct}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {sellerRouteStops.some((s) => s.type === 'BRANCH') && (
                        <Select
                          value={
                            sellerRouteStops.find(
                              (s) =>
                                s.type === 'BRANCH' &&
                                userLocation &&
                                Math.abs(s.lat - userLocation.lat) < 0.0001 &&
                                Math.abs(s.lng - userLocation.lng) < 0.0001
                            )?.id || '__custom'
                          }
                          onValueChange={(branchStopId) => {
                            const found = sellerRouteStops.find((s) => s.id === branchStopId);
                            if (found) {
                              handleSetManualOrigin({ lat: found.lat, lng: found.lng }, found.name);
                              setFocusedStopId(found.id);
                            }
                          }}
                        >
                          <SelectTrigger className="h-9 w-52 text-xs font-bold rounded-xl border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                            <SelectValue placeholder="Salir desde Sucursal..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__custom" disabled className="text-xs">
                              {originLabel ? `Origen: ${originLabel}` : 'Elegir Sucursal de Salida...'}
                            </SelectItem>
                            {sellerRouteStops
                              .filter((s) => s.type === 'BRANCH')
                              .map((br) => (
                                <SelectItem key={br.id} value={br.id} className="text-xs font-semibold">
                                  🏪 Salir desde: {br.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}

                      <Button
                        type="button"
                        size="sm"
                        variant={userLocation ? 'outline' : 'default'}
                        onClick={() => requestLiveGps(false)}
                        disabled={gpsLoading}
                        className={`h-9 text-xs font-bold rounded-xl gap-1.5 ${
                          userLocation
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-sky-600 hover:bg-sky-700 text-white'
                        }`}
                      >
                        {gpsLoading ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Crosshair size={14} />
                        )}
                        {userLocation ? (originLabel ? `Origen: ${originLabel}` : 'GPS Activo') : 'Activar Mi GPS'}
                      </Button>

                      {userLocation && (
                        <Button
                          type="button"
                          size="sm"
                          variant={sortByNearest ? 'default' : 'outline'}
                          onClick={() => setSortByNearest(prev => !prev)}
                          className={`h-9 text-xs font-bold rounded-xl gap-1.5 ${
                            sortByNearest ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''
                          }`}
                        >
                          <ArrowUpDown size={13} />
                          {sortByNearest ? 'Orden: Más Cercanos' : 'Ordenar por Cercanía'}
                        </Button>
                      )}

                      <Button
                        type="button"
                        size="sm"
                        onClick={handleOpenFullGoogleMapsRoute}
                        className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl gap-1.5 shadow-sm"
                      >
                        <Navigation size={14} /> Abrir Ruta Completa en Google Maps
                      </Button>
                      {visitedCount > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleResetRouteVisits}
                          className="h-9 text-xs font-bold rounded-xl"
                        >
                          Reiniciar Visitas
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Panel Dividido: Lista Ordenada de Paradas + Mapa Interactivo */}
                  <div className="flex flex-col lg:flex-row h-[620px] gap-4">
                    <div className="w-full lg:w-1/3 bg-card rounded-2xl border border-border p-4 flex flex-col h-[320px] lg:h-full overflow-hidden shadow-sm">
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                        <h3 className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                          <MapPin className="text-indigo-500" size={15} /> Paradas de la Ruta ({filteredStops.length})
                        </h3>
                        <Badge variant="outline" className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                          {userLocation ? 'GPS En Vivo' : 'Guardado en Nube'}
                        </Badge>
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                        {filteredStops.map((loc, idx) => {
                          const distKm = userLocation
                            ? calculateDistanceKm(userLocation.lat, userLocation.lng, loc.lat, loc.lng)
                            : null;
                          return (
                          <div
                            key={loc.id}
                            onClick={() => setFocusedStopId(loc.id)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                              loc.visited
                                ? 'bg-emerald-500/10 border-emerald-500/40'
                                : focusedStopId === loc.id
                                ? 'bg-indigo-500/10 border-indigo-500/50 shadow-sm'
                                : 'bg-muted/30 border-border hover:border-indigo-500/40'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 text-white ${loc.visited ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
                                  {loc.visited ? '✓' : idx + 1}
                                </span>
                                <span className={`text-xs font-bold truncate ${loc.visited ? 'line-through text-emerald-700 dark:text-emerald-300' : 'text-foreground'}`}>
                                  {loc.name}
                                </span>
                              </div>
                              {loc.type === 'BRANCH' ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetManualOrigin({ lat: loc.lat, lng: loc.lng }, loc.name);
                                  }}
                                  className="text-[9px] font-black px-2 py-0.5 rounded-full border bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-600 hover:text-white transition-colors shrink-0"
                                >
                                  🏪 USAR DE ORIGEN
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleStopVisited(loc.id);
                                  }}
                                  className={`text-[9px] font-black px-2 py-0.5 rounded-full border transition-colors shrink-0 ${
                                    loc.visited
                                      ? 'bg-emerald-600 text-white border-emerald-600'
                                      : 'bg-background text-muted-foreground border-border hover:border-emerald-500 hover:text-emerald-600'
                                  }`}
                                >
                                  {loc.visited ? 'VISITADO ✓' : 'MARCAR VISITA'}
                                </button>
                              )}
                            </div>

                            <div className="text-[10px] text-muted-foreground space-y-0.5 pl-7">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate">📍 {loc.address || 'Ubicación GPS'}</span>
                                {distKm !== null && (
                                  <span className="font-mono font-black text-sky-600 dark:text-sky-400 shrink-0">
                                    {distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`}
                                  </span>
                                )}
                              </div>
                              {loc.sellerName && <div className="text-indigo-600 dark:text-indigo-400 font-semibold">👤 {loc.sellerName}</div>}
                              {loc.notes && <div className="italic text-foreground/80">“{loc.notes}”</div>}
                            </div>

                            <div className="flex items-center justify-between pt-1.5 pl-7 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-1.5">
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                  onClick={() => window.open(`https://www.google.com/maps/dir/?api=1${originParam}&destination=${loc.lat},${loc.lng}&travelmode=driving`, '_blank')}
                                  className="h-6 px-2 text-[9.5px] font-bold text-blue-600 dark:text-blue-400 rounded-lg flex items-center gap-1"
                                >
                                  <Navigation size={10} /> Maps
                                </Button>
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                  onClick={() => window.open(`https://waze.com/ul?ll=${loc.lat},${loc.lng}&navigate=yes`, '_blank')}
                                  className="h-6 px-2 text-[9.5px] font-bold text-sky-600 dark:text-sky-400 rounded-lg flex items-center gap-1"
                                >
                                  <Car size={10} /> Waze
                                </Button>
                                {loc.phone && (
                                  <Button
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                    onClick={() => window.open(`https://wa.me/${loc.phone!.replace(/[^0-9]/g, '')}`, '_blank')}
                                    className="h-6 px-2 text-[9.5px] font-bold text-emerald-600 rounded-lg"
                                    title="WhatsApp"
                                  >
                                    <Phone size={10} />
                                  </Button>
                                )}
                              </div>
                              <Button
                                size="sm"
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                  const next = sellerRouteStops.filter(l => l.id !== loc.id);
                                  persistSellerRouteStops(next);
                                  toast({ title: 'Parada Eliminada', description: `Se quitó "${loc.name}" de la ruta.` });
                                }}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-rose-500 rounded-lg"
                                title="Quitar de ruta"
                              >
                                <Trash2 size={12} />
                              </Button>
                            </div>
                          </div>
                          );
                        })}
                        {filteredStops.length === 0 && (
                          <div className="text-center py-10 text-xs text-muted-foreground">
                            No hay paradas asignadas. Haz clic en <strong>&quot;Agregar Parada de Cliente&quot;</strong> en el mapa para asignar clientes a esta ruta.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mapa Interactivo con Ruta Numerada y Polilínea */}
                    <div className="w-full lg:w-2/3 h-[420px] lg:h-full rounded-2xl overflow-hidden border border-border shadow-sm">
                      <CrmMap
                        locations={filteredStops}
                        routes={mapData.routes}
                        customers={customers}
                        branches={crmBranches}
                        sellers={crmSellers}
                        focusedLocationId={focusedStopId}
                        userLocation={userLocation}
                        originLabel={originLabel}
                        gpsLoading={gpsLoading}
                        onRequestGps={() => requestLiveGps(false)}
                        onSetManualOrigin={handleSetManualOrigin}
                        onToggleVisited={handleToggleStopVisited}
                        onAddLocation={(newLoc) => {
                          const next = [...sellerRouteStops, newLoc];
                          persistSellerRouteStops(next);
                          toast({
                            title: 'Parada Guardada en Ruta 📍',
                            description: `"${newLoc.name}" quedó guardado permanentemente en el mapa de vendedores.`
                          });
                        }}
                        onDeleteLocation={(locId) => {
                          const next = sellerRouteStops.filter(l => l.id !== locId);
                          persistSellerRouteStops(next);
                          toast({ title: 'Parada Eliminada', description: 'Se removió el punto del mapa de rutas.' });
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>

        {/* DIALOGO / MODAL: CREAR Y EDITAR OPORTUNIDAD */}
        <Dialog open={isOppModalOpen} onOpenChange={setIsOppModalOpen}>
          <DialogContent className="bg-card border-border text-foreground max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                <Sparkles className="text-amber-400" size={16} /> {oppForm.id ? 'Modificar Negocio' : 'Abrir Oportunidad Comercial'}
              </DialogTitle>
              <DialogDescription className="text-[10px] text-muted-foreground">Ingresa los datos para clasificar y cotizar este prospecto.</DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSaveOpportunity} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">Título del Negocio *</label>
                <Input 
                  value={oppForm.title}
                  onChange={e => setOppForm({...oppForm, title: e.target.value})}
                  placeholder="Ej: Lote de 50 licencias NexWay"
                  className="bg-background border-input h-10 rounded-xl text-xs focus:ring-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground">Cliente Asociado</label>
                  <Select 
                    value={oppForm.customer_id} 
                    onValueChange={val => setOppForm({...oppForm, customer_id: val})}
                  >
                    <SelectTrigger className="h-10 bg-background border-input rounded-xl text-xs text-foreground">
                      <SelectValue placeholder="Vincular cliente..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-xs text-popover-foreground">
                      <SelectItem value="none">Sin registrar (Prospecto)</SelectItem>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground">Contacto Directo</label>
                  <Input 
                    value={oppForm.contact_name}
                    onChange={e => setOppForm({...oppForm, contact_name: e.target.value})}
                    placeholder="Nombre del prospecto"
                    className="bg-background border-input h-10 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground">Valor Estimado ($ USD)</label>
                  <Input 
                    type="number"
                    value={oppForm.estimated_value}
                    onChange={e => setOppForm({...oppForm, estimated_value: e.target.value})}
                    placeholder="0.00"
                    className="bg-background border-input h-10 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground">SKU de Stock a Rotar</label>
                  <Select 
                    value={oppForm.suggested_sku} 
                    onValueChange={val => setOppForm({...oppForm, suggested_sku: val})}
                  >
                    <SelectTrigger className="h-10 bg-background border-input rounded-xl text-xs text-foreground">
                      <SelectValue placeholder="Vincular Stock..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-xs text-popover-foreground">
                      <SelectItem value="none">Ninguno</SelectItem>
                      {inventory.map(p => (
                        <SelectItem key={p.sku} value={p.sku}>{p.name} (${p.price})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground">Etapa Comercial</label>
                  <Select 
                    value={oppForm.stage} 
                    onValueChange={val => setOppForm({...oppForm, stage: val})}
                  >
                    <SelectTrigger className="h-10 bg-background border-input rounded-xl text-xs text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-xs text-popover-foreground">
                      {STAGES.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground">Prioridad</label>
                  <Select 
                    value={oppForm.priority} 
                    onValueChange={val => setOppForm({...oppForm, priority: val})}
                  >
                    <SelectTrigger className="h-10 bg-background border-input rounded-xl text-xs text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-xs text-popover-foreground">
                      <SelectItem value="BAJA">Baja 💤</SelectItem>
                      <SelectItem value="MEDIA">Media ⚡</SelectItem>
                      <SelectItem value="ALTA">Alta 🔥</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-foreground">Notas Adicionales</label>
                <Textarea 
                  value={oppForm.notes}
                  onChange={e => setOppForm({...oppForm, notes: e.target.value})}
                  placeholder="Detalla acuerdos, necesidades o comentarios del negocio..."
                  className="bg-background border-input rounded-xl text-xs min-h-[80px] text-foreground"
                />
              </div>

              <DialogFooter className="pt-4 border-t border-border/60">
                <Button type="button" variant="ghost" onClick={() => setIsOppModalOpen(false)} className="rounded-xl text-xs h-10 font-bold">Cancelar</Button>
                <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs h-10 font-black" disabled={savingOpp}>
                  {savingOpp ? <Loader2 className="animate-spin" size={14} /> : 'Guardar Negocio'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* DIALOGO / MODAL: FICHA DE CLIENTE 360° Y DETALLES */}
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="bg-card border-border text-foreground max-w-4xl rounded-2xl overflow-hidden p-0">
            {selectedOpp && (
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10">
                
                {/* Columna Izquierda: Ficha 360° del Contacto */}
                <div className="p-6 space-y-6 bg-muted/30">
                  <div>
                    <Badge className="bg-amber-500 text-slate-950 font-black text-[9px] uppercase tracking-wider mb-2.5">Oportunidad Activa</Badge>
                    <h3 className="text-base font-black text-foreground font-headline leading-snug">{selectedOpp.title}</h3>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono uppercase">ID: {selectedOpp.id.slice(0,8)}</p>
                  </div>

                  {/* Ficha 360° Cliente */}
                  <div className="space-y-4 pt-4 border-t border-border/60">
                    <h4 className="text-[9.5px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1"><Users size={12} className="text-indigo-400" /> Perfil Comercial 360°</h4>
                    
                    <div className="space-y-2.5 text-xs">
                      <div>
                        <span className="text-[9px] font-bold text-muted-foreground block uppercase">Contacto / Cliente</span>
                        <span className="font-bold text-foreground">{selectedOpp.contact_name || 'Prospecto sin registrar'}</span>
                      </div>

                      {selectedOpp.customer_id && (
                        <div className="bg-indigo-500/5 p-2 rounded-lg border border-indigo-500/10">
                          <span className="text-[8px] font-black text-indigo-400 block uppercase">Vínculo ERP</span>
                          <span className="text-[10.5px] font-bold text-slate-200 truncate block">
                            {customers.find(c => c.id === selectedOpp.customer_id)?.name || 'Cliente registrado'}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-4 text-foreground/80 font-medium">
                        <Phone size={12} className="text-slate-500 shrink-0" />
                        <span>{customers.find(c => c.id === selectedOpp.customer_id)?.phone || 'No registrado'}</span>
                      </div>

                      <div className="flex items-center gap-2 text-foreground/80 font-medium truncate">
                        <Mail size={12} className="text-slate-500 shrink-0" />
                        <span>{customers.find(c => c.id === selectedOpp.customer_id)?.email || 'No registrado'}</span>
                      </div>
                    </div>
                  </div>

                  {/* KPIs de Oportunidad */}
                  <div className="space-y-3 pt-4 border-t border-border/60 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-bold">Valor de Cierre:</span>
                      <span className="font-black text-emerald-400 font-mono">${selectedOpp.estimated_value?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-bold">Prioridad:</span>
                      <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold uppercase">{selectedOpp.priority}</Badge>
                    </div>
                    {selectedOpp.suggested_sku && (
                      <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 text-[10px] leading-relaxed text-slate-300 flex gap-2">
                        <AlertTriangle className="text-rose-400 shrink-0 mt-0.5" size={13} />
                        <span>
                          Este negocio está asociado a una campaña de rotación para liberar el stock de **SKU: {selectedOpp.suggested_sku}**.
                        </span>
                      </div>
                    )}

                    {/* Botón Acción ERP */}
                    <div className="pt-4 border-t border-border/60">
                      <Button
                        onClick={handleCreateQuotationERP}
                        disabled={isCreatingQuotation}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl h-10 gap-1.5 shadow-lg shadow-indigo-600/10"
                      >
                        {isCreatingQuotation ? (
                          <>
                            <Loader2 size={13} className="animate-spin" /> Generando...
                          </>
                        ) : (
                          <>
                            <FileText size={13} /> Crear Cotización en ERP
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Columna Centro: Historial de Interacciones */}
                <div className="p-6 space-y-6 md:col-span-2 flex flex-col h-[75vh]">
                  <div className="flex-1 flex flex-col min-h-0 space-y-5">
                    <div className="border-b border-border/60 pb-3 flex justify-between items-center">
                      <h4 className="text-xs font-black uppercase text-foreground tracking-wider flex items-center gap-2">
                        <MessageSquare size={14} className="text-indigo-400" /> Bitácora de Acciones
                      </h4>
                      <Badge className="bg-muted border-border text-muted-foreground font-bold text-[9px]">{interactions.length} INTERACCIONES</Badge>
                    </div>

                    {/* Lista de Acciones */}
                    <div className="flex-1 overflow-y-auto space-y-3.5 pr-2">
                      {interactions.map(item => (
                        <div key={item.id} className="p-3.5 rounded-xl bg-muted/30 border border-border/60 flex gap-3 items-start">
                          <div className={`p-1.5 rounded-lg text-xs ${
                            item.interaction_type === 'LLAMADA' ? 'bg-blue-500/10 text-blue-400' : item.interaction_type === 'REUNION' ? 'bg-orange-500/10 text-orange-400' : 'bg-slate-500/10 text-slate-400'
                          }`}>
                            {item.interaction_type === 'LLAMADA' ? <Phone size={12} /> : <MessageSquare size={12} />}
                          </div>
                          <div className="text-xs space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-foreground">{item.summary}</span>
                              <span className="text-[9px] text-muted-foreground font-mono">{new Date(item.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed">{item.detail}</p>
                            <span className="text-[8.5px] font-black uppercase text-indigo-400 tracking-wider font-mono block">Vendedor: {item.created_by}</span>
                          </div>
                        </div>
                      ))}
                      {interactions.length === 0 && (
                        <div className="py-12 text-center text-xs text-slate-500 italic">No hay historial registrado. Añade tu primera llamada o nota abajo.</div>
                      )}
                    </div>

                    {/* Agregar Interacción Form */}
                    <form onSubmit={handleAddInteraction} className="bg-muted/40 p-4 rounded-xl border border-border/60 space-y-3 shrink-0 text-xs">
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-black text-foreground uppercase tracking-wider text-[9.5px]">Añadir Nueva Acción</span>
                        <Select 
                          value={newInteraction.interaction_type} 
                          onValueChange={val => setNewInteraction({...newInteraction, interaction_type: val})}
                        >
                          <SelectTrigger className="h-7 w-28 bg-background border-input text-[10px] rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border text-[10px] text-popover-foreground">
                            <SelectItem value="LLAMADA">Llamada 📞</SelectItem>
                            <SelectItem value="REUNION">Reunión 🤝</SelectItem>
                            <SelectItem value="CORREO">Correo ✉️</SelectItem>
                            <SelectItem value="NOTA">Nota Rápida 📝</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Input 
                          value={newInteraction.summary}
                          onChange={e => setNewInteraction({...newInteraction, summary: e.target.value})}
                          placeholder="Resumen rápido de la acción (Ej: Llamó para pedir precio especial)"
                          className="h-8 bg-background border-input text-[11px] rounded-lg"
                          required
                        />
                        <Textarea 
                          value={newInteraction.detail}
                          onChange={e => setNewInteraction({...newInteraction, detail: e.target.value})}
                          placeholder="Detalle o acuerdos alcanzados durante el contacto..."
                          className="bg-background border-input rounded-lg text-[10.5px] min-h-[45px] p-2 text-foreground"
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[10px] h-8" disabled={savingInteraction}>
                          {savingInteraction ? <Loader2 className="animate-spin" size={12} /> : 'Registrar Bitácora'}
                        </Button>
                      </div>
                    </form>
                  </div>

                  {/* Sub-Sección: Agenda de Tareas */}
                  <div className="border-t border-border/60 pt-5 space-y-4 shrink-0">
                    <h4 className="text-xs font-black uppercase text-foreground tracking-wider flex items-center gap-2">
                      <CheckSquare size={14} className="text-amber-400" /> Tareas Pendientes y Agenda
                    </h4>

                    {/* Lista de Tareas */}
                    <div className="max-h-[160px] overflow-y-auto space-y-2.5 pr-1">
                      {tasks.map(tsk => (
                        <div key={tsk.id} className={`p-3 rounded-lg border flex items-center justify-between gap-3 text-xs ${
                          tsk.status === 'COMPLETADA' ? 'bg-emerald-500/5 border-emerald-500/10 opacity-60' : 'bg-muted/30 border-border/60'
                        }`}>
                          <div className="flex items-center gap-2.5">
                            {tsk.status === 'COMPLETADA' ? (
                              <CheckCircle2 className="text-emerald-500 shrink-0" size={14} />
                            ) : (
                              <Clock className="text-amber-500 shrink-0 animate-pulse" size={14} />
                            )}
                            <div>
                              <p className={`font-bold ${tsk.status === 'COMPLETADA' ? 'line-through text-slate-500' : 'text-white'}`}>{tsk.title}</p>
                              <span className="text-[8.5px] text-slate-400 font-mono">Vence: {new Date(tsk.due_date).toLocaleString()}</span>
                            </div>
                          </div>
                          {tsk.status === 'PENDIENTE' && (
                            <Button 
                              size="sm" 
                              onClick={() => handleCompleteTask(tsk.id)}
                              className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-bold text-[9px] h-6 px-2.5 rounded"
                            >
                              Completar
                            </Button>
                          )}
                        </div>
                      ))}
                      {tasks.length === 0 && (
                        <p className="text-[10px] text-slate-500 italic text-center py-2">No hay tareas comerciales pendientes.</p>
                      )}
                    </div>

                    {/* Programar Tarea Form */}
                    <form onSubmit={handleAddTask} className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-border/60 text-xs items-end">
                      <div className="space-y-1 sm:col-span-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Nueva Tarea Comercial</span>
                        <Input 
                          value={newTask.title}
                          onChange={e => setNewTask({...newTask, title: e.target.value})}
                          placeholder="Ej: Llamar para concretar firma"
                          className="h-8 bg-background border-input text-[11px] rounded-lg"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Fecha Límite</span>
                        <Input 
                          type="datetime-local"
                          value={newTask.due_date}
                          onChange={e => setNewTask({...newTask, due_date: e.target.value})}
                          className="h-8 bg-background border-input text-[10px] rounded-lg"
                          required
                        />
                      </div>
                      <Button type="submit" size="sm" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-[10px] h-8 w-full" disabled={savingTask}>
                        {savingTask ? <Loader2 className="animate-spin" size={12} /> : 'Agendar'}
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
    </div>
  );
}
