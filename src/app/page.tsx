
'use client';

import React from 'react';
import { 
  ShoppingCart, 
  Truck, 
  FileText, 
  ClipboardList, 
  Users, 
  Package,
  LogOut
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/firebase';
import Link from 'next/link';

export default function Home() {
  const auth = useAuth();

  const handleLogout = () => {
    auth.signOut().catch(console.error);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 md:p-12 lg:p-16">
      {/* Header Section */}
      <div className="max-w-6xl mx-auto flex justify-between items-start mb-12">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-headline mb-2">Panel Principal</h1>
          <p className="text-slate-500 text-lg">Bienvenido al centro de operaciones NexWay</p>
        </div>
        <Button 
          variant="ghost" 
          onClick={handleLogout}
          className="text-slate-400 hover:text-slate-600 font-medium flex items-center gap-2"
        >
          <LogOut size={18} />
          <span>Cerrar Sesión</span>
        </Button>
      </div>

      {/* Main Grid Modules */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/billing">
          <ModuleCard 
            icon={<ShoppingCart className="text-white" size={24} />}
            iconBg="bg-blue-600"
            title="Facturación"
            description="Generar DTE y facturas"
          />
        </Link>
        <Link href="/purchases">
          <ModuleCard 
            icon={<Truck className="text-white" size={24} />}
            iconBg="bg-emerald-600"
            title="Registro de Compra"
            description="Entrada de mercadería"
          />
        </Link>
        <Link href="/quotations">
          <ModuleCard 
            icon={<FileText className="text-white" size={24} />}
            iconBg="bg-orange-500"
            title="Cotización"
            description="Presupuestos para clientes"
          />
        </Link>
        <ModuleCard 
          icon={<ClipboardList className="text-white" size={24} />}
          iconBg="bg-purple-600"
          title="Orden de Compra"
          description="Gestión de pedidos"
        />
        <ModuleCard 
          icon={<Users className="text-white" size={24} />}
          iconBg="bg-sky-500"
          title="Registro de Cliente"
          description="Contribuyentes y CF"
        />
        <ModuleCard 
          icon={<Package className="text-white" size={24} />}
          iconBg="bg-rose-500"
          title="Inventario"
          description="Existencias y stock real"
        />
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
    <Card className="border-none shadow-sm rounded-3xl hover:shadow-md transition-all duration-300 cursor-pointer group bg-white h-full">
      <CardContent className="p-8">
        <div className={`w-14 h-14 ${iconBg} rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-${iconBg.split('-')[1]}-500/20 group-hover:scale-105 transition-transform`}>
          {icon}
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <p className="text-slate-400 text-sm">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
