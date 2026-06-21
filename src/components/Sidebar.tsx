'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  ShoppingCart, 
  Truck, 
  BarChart3, 
  Building2, 
  CalendarClock, 
  FileText, 
  ArrowLeftRight, 
  ClipboardList, 
  Users, 
  Package, 
  Building, 
  ShieldCheck,
  LogOut,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { useUser, getTenantName, ROLE_PERMISSIONS } from '@/supabase/use-user';
import { Button } from '@/components/ui/button';
import { supabase } from '@/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SidebarItem {
  id: string;
  title: string;
  path: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user, role, isAdmin, permissions } = useUser();
  const activeTenant = getTenantName();

  const [branches, setBranches] = useState<any[]>([]);
  const [activeBranch, setActiveBranch] = useState<string>('');

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const { data } = await supabase.from('branches').select('*').order('name');
        if (data) {
          setBranches(data);
          
          const storedBranch = localStorage.getItem('active_branch_id');
          if (storedBranch && data.some((b: any) => b.id === storedBranch)) {
            setActiveBranch(storedBranch);
          } else {
            // Intentar obtener de perfil de usuario
            const { data: profile } = await supabase
              .from('profiles')
              .select('branch_id')
              .eq('id', user?.id)
              .maybeSingle();
            if (profile?.branch_id && data.some((b: any) => b.id === profile.branch_id)) {
              setActiveBranch(profile.branch_id);
              localStorage.setItem('active_branch_id', profile.branch_id);
              const name = data.find((b: any) => b.id === profile.branch_id)?.name || '';
              localStorage.setItem('active_branch_name', name);
            } else if (data.length > 0) {
              setActiveBranch(data[0].id);
              localStorage.setItem('active_branch_id', data[0].id);
              localStorage.setItem('active_branch_name', data[0].name);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching branches in sidebar:', err);
      }
    };
    if (user) fetchBranches();
  }, [user]);

  const handleBranchChange = (branchId: string) => {
    setActiveBranch(branchId);
    localStorage.setItem('active_branch_id', branchId);
    const branchName = branches.find((b: any) => b.id === branchId)?.name || '';
    localStorage.setItem('active_branch_name', branchName);
    window.dispatchEvent(new Event('branchChanged'));
  };

  const menuItems: SidebarItem[] = [
    { id: 'billing', title: 'Facturación', path: '/billing', icon: <ShoppingCart size={18} /> },
    { id: 'purchases', title: 'Registro de Compra', path: '/purchases', icon: <Truck size={18} /> },
    { id: 'customers', title: 'Registro de Cliente', path: '/customers', icon: <Users size={18} /> },
    { id: 'accounting', title: 'Contabilidad', path: '/accounting', icon: <BarChart3 size={18} /> },
    { id: 'suppliers', title: 'Proveedores', path: '/suppliers', icon: <Building2 size={18} /> },
    { id: 'quedan', title: 'Gestión de Quedan', path: '/quedan', icon: <CalendarClock size={18} /> },
    { id: 'quotations', title: 'Cotización', path: '/quotations', icon: <FileText size={18} /> },
    { id: 'transfers', title: 'Traslados', path: '/transfers', icon: <ArrowLeftRight size={18} /> },
    { id: 'orders', title: 'Pedidos', path: '/orders', icon: <ClipboardList size={18} /> },
    { id: 'inventory', title: 'Inventario', path: '/inventory', icon: <Package size={18} /> },
    { id: 'institutional', title: 'Institucional', path: '/institutional', icon: <Building size={18} /> },
    { id: 'management', title: 'Gerencia', path: '/management', icon: <ShieldCheck size={18} /> },
  ];

  // Permissions checking helper
  const filteredMenuItems = menuItems.filter(item => {
    // If admin or gerencia, show everything
    if (isAdmin || role === 'gerencia') return true;
    
    if (permissions && Array.isArray(permissions.modules)) {
      return permissions.modules.includes(item.id);
    }
    
    const safeRole = role ? role.toLowerCase().trim() : 'pedidos';
    const allowed = ROLE_PERMISSIONS[safeRole] || ROLE_PERMISSIONS['pedidos'];
    return allowed.includes(item.id);
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrador',
    gerencia: 'Gerencia',
    encargado: 'Encargado',
    sub_encargado: 'Sub Encargado',
    cajero: 'Cajero',
    vendedor: 'Vendedor',
    bodeguero: 'Bodeguero',
    motociclista: 'Motociclista',
    pedidos: 'Pedidos',
  };

  return (
    <aside className={`bg-white/5 backdrop-blur-md text-slate-300 flex flex-col h-screen border-r border-white/10 select-none shrink-0 font-body transition-[width] duration-200 ease-in-out will-change-[width] ${
      isCollapsed ? 'w-20' : 'w-64'
    }`}>
      {/* Brand Header al Estilo Mockup */}
      {!isCollapsed ? (
        <>
          <div className="p-6 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-white text-lg tracking-wider shadow-md shadow-indigo-500/10 font-headline relative group-hover:scale-105 transition-transform duration-200">
                <div className="w-4 h-4 rounded-full border-2 border-white/95 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/95 animate-pulse"></div>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black text-white tracking-wide font-headline">NexWay ERP</span>
                {activeTenant && (
                  <span className="text-[9px] font-black uppercase text-indigo-400 tracking-widest mt-0.5">
                    {activeTenant}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-8 w-8 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 active:scale-95 transition-colors"
              title="Colapsar menú"
            >
              <ChevronLeft size={16} />
            </Button>
          </div>
          <div className="px-6 py-3 border-b border-white/10 space-y-1.5 animate-in fade-in duration-200 shrink-0">
            <div className="text-[9px] font-black uppercase text-indigo-400/80 tracking-widest px-0.5">
              Sucursal Activa
            </div>
            <Select value={activeBranch} onValueChange={handleBranchChange}>
              <SelectTrigger className="h-9 w-full bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold text-slate-200 flex items-center justify-between transition-colors focus:ring-0 focus:ring-offset-0">
                <div className="flex items-center gap-2 truncate">
                  <Building size={14} className="text-indigo-400 shrink-0" />
                  <SelectValue placeholder="Seleccionar sucursal..." />
                </div>
              </SelectTrigger>
              <SelectContent className="dark:bg-[#09090b] dark:border-white/10 rounded-xl shadow-2xl">
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id} className="text-xs font-semibold focus:bg-white/10 focus:text-white">{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      ) : (
        <>
          <div className="p-4 flex flex-col items-center border-b border-white/10 gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-white text-lg tracking-wider shadow-md shadow-indigo-500/10 font-headline">
              <div className="w-4 h-4 rounded-full border-2 border-white/95 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white/95"></div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-7 w-7 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 active:scale-95 transition-colors"
              title="Expandir menú"
            >
              <ChevronRight size={15} />
            </Button>
          </div>
          <div className="py-2.5 border-b border-white/10 flex justify-center text-indigo-400 animate-in fade-in duration-200 shrink-0" title={branches.find(b => b.id === activeBranch)?.name || 'Sucursal'}>
            <Building size={18} />
          </div>
        </>
      )}

      {/* Main Navigation Links */}
      <nav className={`flex-1 overflow-y-auto px-4 py-6 space-y-1.5 no-scrollbar ${isCollapsed ? 'px-3' : 'px-4'}`}>
        {!isCollapsed && (
          <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-3 mb-3">
            Módulos
          </div>
        )}
        <Link 
          href="/" 
          title={isCollapsed ? "Inicio" : undefined}
          className={`flex items-center rounded-xl text-xs font-semibold tracking-wide transition-colors duration-200 group ${
            isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
          } ${
            pathname === '/' 
              ? 'bg-indigo-500/25 border border-indigo-500/30 text-white' 
              : 'hover:bg-white/10 bg-transparent hover:text-white text-slate-400'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className={pathname === '/' ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors'}>
              <Building size={18} />
            </span>
            {!isCollapsed && <span>Inicio</span>}
          </div>
          {!isCollapsed && pathname !== '/' && (
            <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 translate-x-[-4px] group-hover:translate-x-0" />
          )}
        </Link>

        {filteredMenuItems.map((item) => {
          const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
          return (
            <Link 
              key={item.id}
              href={item.path} 
              title={isCollapsed ? item.title : undefined}
              className={`flex items-center rounded-xl text-xs font-semibold tracking-wide transition-colors duration-200 group ${
                isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
              } ${
                isActive 
                  ? 'bg-indigo-500/25 border border-indigo-500/30 text-white' 
                  : 'hover:bg-white/10 bg-transparent hover:text-white text-slate-400'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors'}>
                  {item.icon}
                </span>
                {!isCollapsed && <span className="truncate">{item.title}</span>}
              </div>
              
              {!isCollapsed && !isActive && (
                <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-all text-slate-400 translate-x-[-4px] group-hover:translate-x-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Profile Card / Sign Out */}
      {isCollapsed ? (
        <div className="p-3 flex flex-col items-center gap-3 bg-black/20 border-t border-white/10">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center font-black uppercase text-xs border border-indigo-500/10" title={user?.email || 'Usuario'}>
            {user?.email?.slice(0, 2) || 'US'}
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleSignOut}
            className="h-8 w-8 text-slate-400 hover:text-rose-450 hover:bg-rose-500/10 rounded-xl shrink-0"
            title="Cerrar sesión"
          >
            <LogOut size={15} />
          </Button>
        </div>
      ) : (
        <div className="p-4 bg-black/20 border-t border-white/10 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center font-black uppercase text-xs border border-indigo-500/10">
              {user?.email?.slice(0, 2) || 'US'}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-white truncate leading-tight select-all">
                {user?.email?.split('@')[0] || 'Usuario'}
              </span>
              <span className="text-[9px] font-black uppercase text-slate-400 mt-0.5 truncate tracking-wider">
                {ROLE_LABELS[role || ''] || 'Personal'}
              </span>
            </div>
          </div>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleSignOut}
            className="h-8 w-8 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl shrink-0"
            title="Cerrar sesión"
          >
            <LogOut size={15} />
          </Button>
        </div>
      )}
    </aside>
  );
}
