'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Command, 
  ShoppingCart, 
  Package, 
  Scissors, 
  Factory, 
  Printer, 
  Users, 
  CreditCard, 
  DollarSign, 
  FileText, 
  Building2, 
  ArrowRightLeft, 
  History, 
  FileSpreadsheet, 
  Layers, 
  Sparkles, 
  ShieldCheck, 
  X,
  Plus
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface CommandItem {
  id: string;
  category: 'Ventas & POS' | 'Logística & Inventario' | 'Finanzas & Contabilidad' | 'Gestión & Ajustes' | 'Acciones Rápidas';
  title: string;
  description: string;
  icon: any;
  href?: string;
  action?: () => void;
  shortcut?: string;
}

export function GlobalCommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Escuchar tecla Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const COMMANDS: CommandItem[] = [
    // Acciones Rápidas
    {
      id: 'act-pos',
      category: 'Acciones Rápidas',
      title: 'Nueva Venta en Punto de Venta (POS)',
      description: 'Abrir caja y facturación rápida con DTE',
      icon: ShoppingCart,
      href: '/pos',
      shortcut: 'Alt + V'
    },
    {
      id: 'act-frac',
      category: 'Acciones Rápidas',
      title: 'Fraccionar Producto a Granel',
      description: 'Dividir tambores/barriles en unidades menores o consumo de producción',
      icon: Scissors,
      href: '/logistica?tab=fraccionamiento',
      shortcut: 'Alt + F'
    },
    {
      id: 'act-designer',
      category: 'Acciones Rápidas',
      title: 'Diseñador de Impresión & Tickets (Python)',
      description: 'Modificar formato de tiras térmicas 80mm/58mm o DTEs Carta A4',
      icon: Printer,
      href: '/management?tab=print-designer',
      shortcut: 'Alt + P'
    },

    // Logística
    {
      id: 'log-inv',
      category: 'Logística & Inventario',
      title: 'Catálogo de Inventario & Precios',
      description: 'Existencias, costos promedio, precios y proveedores',
      icon: Package,
      href: '/logistica?tab=inventario'
    },
    {
      id: 'log-kardex',
      category: 'Logística & Inventario',
      title: 'Kardex Valorizado & Movimientos',
      description: 'Historial de entradas, salidas y valorización de inventario',
      icon: FileSpreadsheet,
      href: '/logistica?tab=kardex'
    },
    {
      id: 'log-transfers',
      category: 'Logística & Inventario',
      title: 'Traslados entre Bodegas & Sucursales',
      description: 'Movimiento y despacho de stock interno',
      icon: ArrowRightLeft,
      href: '/logistica?tab=traslados'
    },
    {
      id: 'log-bom',
      category: 'Logística & Inventario',
      title: 'Centro de Producción & Fórmulas (BOM)',
      description: 'Ensambles industriales y transformación de materias primas',
      icon: Factory,
      href: '/logistica?tab=produccion'
    },

    // Ventas
    {
      id: 'ven-dte',
      category: 'Ventas & POS',
      title: 'Emisión & Historial DTE El Salvador',
      description: 'Facturas de Consumidor Final (01), Crédito Fiscal (03) y anulaciones',
      icon: FileText,
      href: '/pos'
    },
    {
      id: 'ven-crm',
      category: 'Ventas & POS',
      title: 'Clientes, Cartera & CRM',
      description: 'Directorio de clientes, límites de crédito y seguimiento comercial',
      icon: Users,
      href: '/crm'
    },

    // Finanzas
    {
      id: 'fin-cxp',
      category: 'Finanzas & Contabilidad',
      title: 'Cuentas por Pagar (CxP) & Proveedores',
      description: 'Registro de compras, gastos y emisión de Quedan',
      icon: CreditCard,
      href: '/cxp'
    },
    {
      id: 'fin-cxc',
      category: 'Finanzas & Contabilidad',
      title: 'Cuentas por Cobrar (CxC) & Abonos',
      description: 'Saldos de clientes, estados de cuenta y cobros',
      icon: DollarSign,
      href: '/cxc'
    },

    // Gestión
    {
      id: 'ges-users',
      category: 'Gestión & Ajustes',
      title: 'Usuarios, Roles y Permisos',
      description: 'Control de acceso a pestañas y operadores del sistema',
      icon: ShieldCheck,
      href: '/management?tab=usuarios'
    },
    {
      id: 'ges-branch',
      category: 'Gestión & Ajustes',
      title: 'Sucursales, Bodegas y Cajas',
      description: 'Configuración de establecimientos comerciales',
      icon: Building2,
      href: '/management?tab=sucursales'
    }
  ];

  const filteredCommands = COMMANDS.filter(cmd => {
    const term = search.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(term) ||
      cmd.description.toLowerCase().includes(term) ||
      cmd.category.toLowerCase().includes(term)
    );
  });

  const handleSelect = (item: CommandItem) => {
    setOpen(false);
    setSearch('');
    if (item.action) {
      item.action();
    } else if (item.href) {
      router.push(item.href);
    }
  };

  const categories = Array.from(new Set(filteredCommands.map(c => c.category)));

  return (
    <>
      {/* Botón Flotante / Acceso Rápido en Esquina Inferior */}
      <div 
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-40 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 text-slate-300 hover:text-white border border-slate-700/80 shadow-lg backdrop-blur-md cursor-pointer transition-all hover:scale-105 group text-xs"
        title="Presiona Ctrl+K para buscar en cualquier momento"
      >
        <Command className="h-3.5 w-3.5 text-indigo-400 group-hover:text-indigo-300" />
        <span className="font-medium">Comandos</span>
        <kbd className="px-1.5 py-0.5 text-[10px] rounded bg-slate-800 border border-slate-700 font-mono text-slate-400">
          Ctrl + K
        </kbd>
      </div>

      {/* Modal Command Palette */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-slate-950 border-slate-800 shadow-2xl">
          <div className="p-3 border-b border-slate-800 flex items-center gap-3 bg-slate-900/60">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <Input 
              value={search}
              onChange={e => { setSearch(e.target.value); setSelectedIndex(0); }}
              placeholder="Escribe para buscar un módulo, acción rápida o función..."
              className="h-9 border-none bg-transparent focus-visible:ring-0 text-sm text-slate-100 placeholder:text-slate-500"
              autoFocus
            />
            <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] rounded bg-slate-800 border border-slate-700 font-mono text-slate-400">
              ESC
            </kbd>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2 space-y-4">
            {filteredCommands.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                No se encontraron comandos ni módulos para "{search}".
              </div>
            ) : (
              categories.map(cat => {
                const items = filteredCommands.filter(c => c.category === cat);
                return (
                  <div key={cat} className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 py-1">
                      {cat}
                    </div>
                    <div className="space-y-1">
                      {items.map(item => {
                        const Icon = item.icon;
                        return (
                          <div 
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            className="p-2.5 rounded-lg border border-transparent hover:border-indigo-500/40 hover:bg-slate-900/80 cursor-pointer flex items-center justify-between transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-md bg-slate-900 text-slate-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-400 border border-slate-800 transition-colors">
                                <Icon className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300">
                                  {item.title}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {item.description}
                                </div>
                              </div>
                            </div>

                            {item.shortcut && (
                              <kbd className="px-1.5 py-0.5 text-[10px] rounded bg-slate-900 border border-slate-800 font-mono text-slate-400">
                                {item.shortcut}
                              </kbd>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-2 border-t border-slate-800/80 bg-slate-900/30 flex items-center justify-between text-[11px] text-slate-500 px-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-indigo-400" />
              <span>NEXWAY ERP Global Navigation</span>
            </div>
            <div className="flex items-center gap-3">
              <span>Navegar con teclado</span>
              <span>•</span>
              <span>Enter para seleccionar</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
