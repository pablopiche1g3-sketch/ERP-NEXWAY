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
import Link from 'next/link';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { ModeToggle } from '@/components/mode-toggle';

export default function Home() {
  const db = useFirestore();
  const configRef = useMemo(() => doc(db, 'system', 'module_config'), [db]);
  const { data: config } = useDoc<any>(configRef);

  // Valores por defecto si no hay configuración
  const modules = config || {
    billing: true,
    purchases: true,
    suppliers: true,
    quotations: true,
    transfers: true,
    customers: true,
    inventory: true,
    quedan: true,
    management: true,
    institutional: true,
    accounting: true,
    orders: true
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-12 lg:p-16">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start gap-4 mb-8 md:mb-12">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground font-headline mb-1 md:mb-2">Panel Principal</h1>
          <p className="text-muted-foreground text-sm md:text-lg">Bienvenido al centro de operaciones NexWay</p>
        </div>
        <ModeToggle />
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {modules.billing && (
          <Link href="/billing">
            <ModuleCard 
              icon={<ShoppingCart className="text-white" size={24} />}
              iconBg="bg-blue-600"
              title="Facturación"
              description="Ventas y Estado de Cuenta"
            />
          </Link>
        )}
        {modules.purchases && (
          <Link href="/purchases">
            <ModuleCard 
              icon={<Truck className="text-white" size={24} />}
              iconBg="bg-emerald-600"
              title="Registro de Compra"
              description="Entrada de mercadería"
            />
          </Link>
        )}
        {modules.accounting && (
          <Link href="/accounting">
            <ModuleCard 
              icon={<BarChart3 className="text-white" size={24} />}
              iconBg="bg-slate-900"
              title="Contabilidad"
              description="Resultados, P&L e IVA"
            />
          </Link>
        )}
        {modules.suppliers && (
          <Link href="/suppliers">
            <ModuleCard 
              icon={<Building2 className="text-white" size={24} />}
              iconBg="bg-emerald-800"
              title="Proveedores"
              description="Registro de suministrantes"
            />
          </Link>
        )}
        {modules.quedan && (
          <Link href="/quedan">
            <ModuleCard 
              icon={<CalendarClock className="text-white" size={24} />}
              iconBg="bg-purple-600"
              title="Gestión de Quedan"
              description="Programación de pagos"
            />
          </Link>
        )}
        {modules.quotations && (
          <Link href="/quotations">
            <ModuleCard 
              icon={<FileText className="text-white" size={24} />}
              iconBg="bg-orange-500"
              title="Cotización"
              description="Presupuestos para clientes"
            />
          </Link>
        )}
        {modules.transfers && (
          <Link href="/transfers">
            <ModuleCard 
              icon={<ArrowLeftRight className="text-white" size={24} />}
              iconBg="bg-indigo-600"
              title="Traslados"
              description="Movimiento entre bodegas"
            />
          </Link>
        )}
        {modules.orders && (
          <Link href="/orders">
            <ModuleCard 
              icon={<ClipboardList className="text-white" size={24} />}
              iconBg="bg-violet-600"
              title="Pedidos"
              description="Órdenes internas y proveedores"
            />
          </Link>
        )}
        {modules.customers && (
          <Link href="/customers">
            <ModuleCard 
              icon={<Users className="text-white" size={24} />}
              iconBg="bg-sky-500"
              title="Registro de Cliente"
              description="Contribuyentes y CF"
            />
          </Link>
        )}
        {modules.inventory && (
          <Link href="/inventory">
            <ModuleCard 
              icon={<Package className="text-white" size={24} />}
              iconBg="bg-rose-500"
              title="Inventario"
              description="Códigos y Stock"
            />
          </Link>
        )}
        {modules.institutional && (
          <Link href="/institutional">
            <ModuleCard 
              icon={<Building className="text-white" size={24} />}
              iconBg="bg-blue-400"
              title="Institucional"
              description="Licitaciones y Proyectos"
            />
          </Link>
        )}
        {modules.management && (
          <Link href="/management">
            <ModuleCard 
              icon={<ShieldCheck className="text-white" size={24} />}
              iconBg="bg-slate-700"
              title="Gerencia"
              description="Control de Permisos"
            />
          </Link>
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