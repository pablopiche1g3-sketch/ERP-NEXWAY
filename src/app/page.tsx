'use client';

import React, { useMemo } from 'react';
import { 
  ShoppingCart, 
  Truck, 
  FileText, 
  Users, 
  Package,
  ArrowLeftRight,
  Building2,
  ShieldCheck,
  CalendarClock,
  LayoutDashboard,
  Building,
  BarChart3,
  ClipboardList
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useFirestore, useDoc, useUser, getTenantName, doc, ROLE_PERMISSIONS } from '@/firebase';
import { ModeToggle } from '@/components/mode-toggle';
import { LogOut } from 'lucide-react';

export default function Home() {
  const db = useFirestore();
  const configRef = useMemo(() => doc(db, 'system', 'module_config'), [db]);
  const { data: config } = useDoc<any>(configRef);
  const { role, isAdmin } = useUser();
  const activeTenant = getTenantName();

  const modulesList = [
    { id: 'billing', title: 'Facturación', description: 'Ventas y Estado de Cuenta', path: '/billing', iconBg: 'bg-blue-600', icon: <ShoppingCart className="text-white" size={24} /> },
    { id: 'purchases', title: 'Registro de Compra', description: 'Entrada de mercadería', path: '/purchases', iconBg: 'bg-emerald-600', icon: <Truck className="text-white" size={24} /> },
    { id: 'accounting', title: 'Contabilidad', description: 'Resultados, P&L e IVA', path: '/accounting', iconBg: 'bg-slate-900', icon: <BarChart3 className="text-white" size={24} /> },
    { id: 'suppliers', title: 'Proveedores', description: 'Registro de suministrantes', path: '/suppliers', iconBg: 'bg-emerald-800', icon: <Building2 className="text-white" size={24} /> },
    { id: 'quedan', title: 'Gestión de Quedan', description: 'Programación de pagos', path: '/quedan', iconBg: 'bg-purple-600', icon: <CalendarClock className="text-white" size={24} /> },
    { id: 'quotations', title: 'Cotización', description: 'Presupuestos para clientes', path: '/quotations', iconBg: 'bg-orange-500', icon: <FileText className="text-white" size={24} /> },
    { id: 'transfers', title: 'Traslados', description: 'Movimiento entre bodegas', path: '/transfers', iconBg: 'bg-indigo-600', icon: <ArrowLeftRight className="text-white" size={24} /> },
    { id: 'orders', title: 'Pedidos', description: 'Órdenes internas y proveedores', path: '/orders', iconBg: 'bg-violet-600', icon: <ClipboardList className="text-white" size={24} /> },
    { id: 'customers', title: 'Registro de Cliente', description: 'Contribuyentes y CF', path: '/customers', iconBg: 'bg-sky-500', icon: <Users className="text-white" size={24} /> },
    { id: 'inventory', title: 'Inventario', description: 'Códigos y Stock', path: '/inventory', iconBg: 'bg-rose-500', icon: <Package className="text-white" size={24} /> },
    { id: 'institutional', title: 'Institucional', description: 'Licitaciones y Proyectos', path: '/institutional', iconBg: 'bg-blue-400', icon: <Building className="text-white" size={24} /> },
    { id: 'management', title: 'Gerencia', description: 'Control de Permisos', path: '/management', iconBg: 'bg-slate-700', icon: <ShieldCheck className="text-white" size={24} /> },
  ];

  // Valores por defecto si no hay configuración
  const activeModulesConfig = config || {
    billing: true,
    purchases: true,
    suppliers: true,
    quedan: true,
    quotations: true,
    transfers: true,
    customers: true,
    inventory: true,
    institutional: true,
    accounting: true,
    management: true,
    orders: true
  };

  const visibleModules = modulesList.filter((m) => {
    // 1. Verificar permisos por rol
    const userRole = role || 'pedidos';
    const isUserAdmin = userRole === 'admin' || userRole === 'gerencia';
    const hasRolePermission = isUserAdmin || (ROLE_PERMISSIONS[userRole] && ROLE_PERMISSIONS[userRole].includes(m.id));
    if (!hasRolePermission) return false;

    // 2. Verificar configuración de módulos activos en sistema
    const isModuleEnabled = activeModulesConfig[m.id] !== false;
    return isModuleEnabled;
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-12 lg:p-16">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start gap-4 mb-8 md:mb-12">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground font-headline mb-1 md:mb-2">Panel Principal</h1>
            <p className="text-muted-foreground text-sm md:text-lg">Bienvenido al centro de operaciones NexWay</p>
          </div>
          {activeTenant && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3.5 py-1.5 rounded-full text-amber-600 dark:text-amber-400 text-xs font-semibold shadow-sm animate-pulse h-fit mt-2 sm:mt-0">
              <span>Cliente Activo: <strong>{activeTenant.toUpperCase()}</strong></span>
              <button 
                onClick={() => {
                  window.localStorage.removeItem('nexway_tenant');
                  window.location.reload();
                }}
                className="ml-1 hover:text-amber-800 dark:hover:text-amber-200 transition-colors font-bold text-sm"
                title="Volver a base principal"
              >
                ✕
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={async () => {
              const { getAuth, signOut } = await import('firebase/auth');
              const auth = getAuth();
              await signOut(auth);
            }}
            title="Cerrar sesión"
          >
            <LogOut size={20} className="text-muted-foreground" />
          </Button>
          <ModeToggle />
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {visibleModules.map((m) => (
          <Link key={m.id} href={m.path}>
            <ModuleCard 
              icon={m.icon}
              iconBg={m.iconBg}
              title={m.title}
              description={m.description}
            />
          </Link>
        ))}
        {visibleModules.length === 0 && (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground text-sm">No tienes permisos para acceder a ningún módulo. Contacta a un administrador.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ModuleCard({ icon, iconBg, title, description }: { 
  icon: React.ReactNode, 
  iconBg: string, 
  title: string, 
  description: string 
}) {
  return (
    <Card className="border-none shadow-sm rounded-3xl hover:shadow-md transition-all duration-300 cursor-pointer group bg-card h-full overflow-hidden border-border/50">
      <CardContent className="p-6 md:p-8">
        <div className={`w-12 h-12 md:w-14 md:h-14 ${iconBg} rounded-2xl flex items-center justify-center mb-4 md:mb-6 shadow-lg group-hover:scale-105 transition-transform`}>
          {icon}
        </div>
        <div className="space-y-1">
          <h3 className="text-lg md:text-xl font-bold text-foreground">{title}</h3>
          <p className="text-muted-foreground text-xs md:text-sm">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}