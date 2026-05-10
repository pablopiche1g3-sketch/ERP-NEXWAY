
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Settings, 
  LogOut, 
  TrendingUp, 
  ShoppingCart, 
  Bell,
  Search,
  ChevronRight
} from 'lucide-react';
import { useUser, useAuth } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';

export default function Home() {
  const { user, loading } = useUser();
  const auth = useAuth();
  const router = useRouter();

  // Hemos eliminado la redirección forzosa al login para que el panel sea público por ahora.
  const handleLogout = () => {
    auth.signOut().catch(console.error);
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0a1120] text-slate-400 hidden lg:flex flex-col border-r border-slate-800">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">NexWay</span>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-1">
          <SidebarLink icon={<LayoutDashboard size={20} />} label="Dashboard" active />
          <SidebarLink icon={<Package size={20} />} label="Inventario" />
          <SidebarLink icon={<ShoppingCart size={20} />} label="Ventas" />
          <SidebarLink icon={<Users size={20} />} label="Usuarios" />
          <SidebarLink icon={<TrendingUp size={20} />} label="Reportes" />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <SidebarLink icon={<Settings size={20} />} label="Configuración" />
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-slate-800 hover:text-white rounded-xl transition-colors mt-1"
          >
            <LogOut size={20} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input 
                placeholder="Buscar en el sistema..." 
                className="pl-10 bg-slate-50 border-none rounded-xl focus-visible:ring-1 focus-visible:ring-blue-500 h-10 w-full"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative text-slate-500">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </Button>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900">{user?.displayName || "Admin Demo"}</p>
                <p className="text-xs text-slate-400">Administrador General</p>
              </div>
              <Avatar className="w-10 h-10 border-2 border-blue-500/20">
                <AvatarImage src={`https://picsum.photos/seed/admin/200`} />
                <AvatarFallback className="bg-blue-50 text-blue-600 font-bold">
                  A
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Dashboard Body */}
        <div className="p-8 space-y-8 overflow-auto">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 font-headline">Panel General</h2>
            <p className="text-slate-500">Bienvenido a NexWay ERP. Aquí tienes el resumen de hoy.</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              title="Ventas Totales" 
              value="$45,231.89" 
              change="+20.1% vs mes ant." 
              icon={<TrendingUp className="text-emerald-500" />}
            />
            <StatCard 
              title="Pedidos Nuevos" 
              value="156" 
              change="+12 desde ayer" 
              icon={<ShoppingCart className="text-blue-500" />}
            />
            <StatCard 
              title="Stock Bajo" 
              value="12 items" 
              change="Requiere atención" 
              icon={<Package className="text-amber-500" />}
              isWarning
            />
            <StatCard 
              title="Usuarios Activos" 
              value="2,350" 
              change="+18% este mes" 
              icon={<Users className="text-violet-500" />}
            />
          </div>

          {/* Tables Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 border-none shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 px-6 py-5">
                <CardTitle className="text-lg font-bold text-slate-900">Actividad Reciente</CardTitle>
                <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 font-bold">Ver Todo</Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="px-6 font-bold text-slate-500 text-xs">PRODUCTO</TableHead>
                      <TableHead className="font-bold text-slate-500 text-xs">CLIENTE</TableHead>
                      <TableHead className="font-bold text-slate-500 text-xs">ESTADO</TableHead>
                      <TableHead className="text-right px-6 font-bold text-slate-500 text-xs">MONTO</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <ActivityRow product="Laptop Dell XPS" client="Tech Soluciones" status="Completado" amount="$1,200.00" />
                    <ActivityRow product="Monitor LG 27'" client="Diseño Global" status="Pendiente" amount="$450.00" isPending />
                    <ActivityRow product="Teclado Mecánico" client="Juan Pérez" status="Enviado" amount="$89.00" />
                    <ActivityRow product="Mouse Gamer" client="Gaming Store" status="Cancelado" amount="$55.00" isCancelled />
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
              <CardHeader className="px-6 py-5 border-b border-slate-50">
                <CardTitle className="text-lg font-bold text-slate-900">Accesos Directos</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <ShortcutItem icon={<Package className="text-blue-600" />} label="Cargar Inventario" />
                <ShortcutItem icon={<ShoppingCart className="text-emerald-600" />} label="Nueva Venta" />
                <ShortcutItem icon={<Users className="text-amber-600" />} label="Gestionar Personal" />
                <div className="pt-4 mt-4 border-t border-slate-100">
                  <div className="bg-blue-600 rounded-2xl p-6 text-white relative overflow-hidden group">
                    <div className="relative z-10">
                      <p className="text-sm opacity-80 mb-1">Plan NexWay Plus</p>
                      <p className="text-xl font-bold mb-4">Mejora tu ERP hoy</p>
                      <Button className="bg-white text-blue-600 hover:bg-slate-50 font-bold rounded-xl h-10 w-full">Saber más</Button>
                    </div>
                    <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-500/20 rounded-full group-hover:scale-125 transition-transform duration-500"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function SidebarLink({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <button className={`
      flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-xl transition-all
      ${active 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
        : 'hover:bg-slate-800 hover:text-white text-slate-400'}
    `}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function StatCard({ title, value, change, icon, isWarning = false }: any) {
  return (
    <Card className="border-none shadow-sm rounded-2xl hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-slate-50 rounded-xl">
            {icon}
          </div>
          <Badge variant={isWarning ? "destructive" : "secondary"} className="rounded-lg text-[10px] font-bold">
            {change}
          </Badge>
        </div>
        <div>
          <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityRow({ product, client, status, amount, isPending = false, isCancelled = false }: any) {
  return (
    <TableRow className="hover:bg-slate-50/50 transition-colors border-slate-50">
      <TableCell className="px-6 py-4">
        <p className="font-bold text-slate-900 text-sm">{product}</p>
      </TableCell>
      <TableCell className="text-slate-500 text-sm">{client}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isPending ? 'bg-amber-500' : isCancelled ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
          <span className="text-sm text-slate-600">{status}</span>
        </div>
      </TableCell>
      <TableCell className="text-right px-6 font-bold text-slate-900">{amount}</TableCell>
    </TableRow>
  );
}

function ShortcutItem({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <button className="flex items-center justify-between w-full p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all group">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white rounded-lg shadow-sm">
          {icon}
        </div>
        <span className="text-sm font-bold text-slate-700">{label}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
    </button>
  );
}
