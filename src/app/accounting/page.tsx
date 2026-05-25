'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { 
  BarChart3, 
  ArrowLeft, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Scale, 
  Calendar, 
  Download,
  FileText,
  Search,
  PieChart,
  Calculator,
  ArrowRightLeft,
  PlusCircle,
  Loader2,
  Trash2,
  Settings,
  Check,
  AlertCircle,
  BookOpen,
  Percent,
  Eye,
  FileSpreadsheet,
  TrendingUp as GainIcon,
  Activity,
  Briefcase
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useRouter } from 'next/navigation';

// Catálogo de Cuentas Estándar de El Salvador
const DEFAULT_CATALOG = [
  // 1 - ACTIVO
  { code: '1101', name: 'Efectivo y Equivalentes de Efectivo', group: 'Activo' },
  { code: '1102', name: 'Bancos e Instituciones Financieras', group: 'Activo' },
  { code: '1103', name: 'Cuentas por Cobrar Clientes', group: 'Activo' },
  { code: '1104', name: 'IVA Crédito Fiscal (13%)', group: 'Activo' },
  { code: '1105', name: 'Inventarios de Mercadería', group: 'Activo' },
  { code: '1201', name: 'Propiedad, Planta y Equipo', group: 'Activo' },
  // 2 - PASIVO
  { code: '2101', name: 'Proveedores Locales C/P', group: 'Pasivo' },
  { code: '2102', name: 'IVA Débito Fiscal (13%)', group: 'Pasivo' },
  { code: '2103', name: 'Retenciones de IVA por Pagar (1%)', group: 'Pasivo' },
  { code: '2104', name: 'Pago a Cuenta por Pagar', group: 'Pasivo' },
  { code: '2105', name: 'Retención Renta por Pagar', group: 'Pasivo' },
  // 3 - PATRIMONIO
  { code: '3101', name: 'Capital Social Capitalizado', group: 'Patrimonio' },
  { code: '3102', name: 'Reserva Legal Obligatoria', group: 'Patrimonio' },
  { code: '3103', name: 'Utilidades Acumuladas', group: 'Patrimonio' },
  // 4 - INGRESOS
  { code: '4101', name: 'Ventas de Mercadería Gravadas', group: 'Ingresos' },
  { code: '4102', name: 'Ventas de Mercadería Exentas', group: 'Ingresos' },
  { code: '4103', name: 'Otros Ingresos Operacionales', group: 'Ingresos' },
  // 5 - COSTOS
  { code: '5101', name: 'Costo de Ventas', group: 'Costos' },
  // 6 - GASTOS
  { code: '6101', name: 'Gastos de Administración', group: 'Gastos' },
  { code: '6102', name: 'Gastos de Venta y Distribución', group: 'Gastos' },
  { code: '6103', name: 'Sueldos y Prestaciones (Planilla)', group: 'Gastos' },
  { code: '6104', name: 'Servicios Básicos', group: 'Gastos' },
  { code: '6105', name: 'Arrendamientos y Alquileres', group: 'Gastos' },
];

export default function AccountingPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  // Data Fetching
  const salesRef = useMemo(() => collection(db, 'sales'), [db]);
  const expensesRef = useMemo(() => collection(db, 'expenses'), [db]);
  const journalRef = useMemo(() => collection(db, 'journal'), [db]);
  const purchasesRef = useMemo(() => collection(db, 'purchases'), [db]);
  const inventoryRef = useMemo(() => collection(db, 'inventory'), [db]);

  // Colecciones del Módulo Institucional / Proyectos (Ventas, Compras y Expedientes)
  const instSalesRef = useMemo(() => collection(db, 'institutional_sales'), [db]);
  const instPurchasesRef = useMemo(() => collection(db, 'institutional_purchases'), [db]);
  const instProjectsRef = useMemo(() => collection(db, 'institutional_projects'), [db]);

  const { data: sales, loading: loadingSales } = useCollection<any>(salesRef);
  const { data: expenses, loading: loadingExpenses } = useCollection<any>(expensesRef);
  const { data: journal, loading: loadingJournal } = useCollection<any>(journalRef);
  const { data: purchases, loading: loadingPurchases } = useCollection<any>(purchasesRef);
  const { data: inventory } = useCollection<any>(inventoryRef);

  const { data: instSales } = useCollection<any>(instSalesRef);
  const { data: instPurchases } = useCollection<any>(instPurchasesRef);
  const { data: instProjects } = useCollection<any>(instProjectsRef);

  // Ajustes de Contabilidad Modular
  const [settings, setSettings] = useState({
    taxProfile: 'Normal', // Normal, Gran Contribuyente, Exento
    accountingLevel: 'Simplificado', // Simplificado, Avanzado
    ivaRate: 13,
    pagoCuentaRate: 1.75
  });

  const [activeSubTab, setActiveSubTab] = useState<'movimientos' | 'catalogo'>('movimientos');
  const [activeTaxTab, setActiveTaxTab] = useState<'vcf' | 'vc' | 'compras'>('vcf');
  const [activeFormTab, setActiveFormTab] = useState<'f07' | 'f14'>('f07');
  const [rentabilidadSubTab, setRentabilidadSubTab] = useState<'productos' | 'licitaciones'>('productos');
  
  // Filtro de fechas para Libros de IVA (Mes y Año actual)
  const [filterMonth, setFilterMonth] = useState<string>((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());

  // Búsqueda en rentabilidad
  const [rentabilidadSearch, setRentabilidadSearch] = useState('');

  // Selector de canal contable (Estándar vs. Institucional vs. Consolidado)
  const [selectedChannel, setSelectedChannel] = useState<'consolidado' | 'estandar' | 'institucional'>('consolidado');

  useEffect(() => {
    const saved = localStorage.getItem('nexway_accounting_settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error("Error cargando configuraciones contables", e);
      }
    }
  }, []);

  const handleSaveSettings = (newSettings: typeof settings) => {
    setSettings(newSettings);
    localStorage.setItem('nexway_accounting_settings', JSON.stringify(newSettings));
    toast({ title: "Configuración Actualizada", description: "Los parámetros contables han sido guardados." });
  };

  // Modales
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);
  const [selectedAdvEntry, setSelectedAdvEntry] = useState<any>(null);

  // Estado para Nuevo Asiento Simple
  const [newEntry, setNewEntry] = useState({
    description: '',
    amount: '',
    type: 'Egreso',
    account: 'Gastos de Administración'
  });

  // Estado para Nuevo Asiento Avanzado (Doble Entrada)
  const [advDescription, setAdvDescription] = useState('');
  const [advDate, setAdvDate] = useState(new Date().toISOString().split('T')[0]);
  const [advLines, setAdvLines] = useState<Array<{ accountCode: string; debit: string; credit: string }>>([
    { accountCode: '1101', debit: '0.00', credit: '0.00' },
    { accountCode: '4101', debit: '0.00', credit: '0.00' }
  ]);

  // Cálculos Avanzados de Doble Entrada
  const totalDebitLines = useMemo(() => 
    advLines.reduce((acc, l) => acc + (parseFloat(l.debit) || 0), 0)
  , [advLines]);

  const totalCreditLines = useMemo(() => 
    advLines.reduce((acc, l) => acc + (parseFloat(l.credit) || 0), 0)
  , [advLines]);

  const isBalanced = useMemo(() => 
    Math.abs(totalDebitLines - totalCreditLines) < 0.01 && totalDebitLines > 0
  , [totalDebitLines, totalCreditLines]);

  const balanceDifference = useMemo(() => 
    totalDebitLines - totalCreditLines
  , [totalDebitLines, totalCreditLines]);

  // Manejo de Líneas en Modal Avanzado
  const handleAddLine = () => {
    setAdvLines([...advLines, { accountCode: '6101', debit: '0.00', credit: '0.00' }]);
  };

  const handleRemoveLine = (idx: number) => {
    if (advLines.length <= 2) return;
    setAdvLines(advLines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: 'accountCode' | 'debit' | 'credit', val: string) => {
    setAdvLines(advLines.map((line, i) => {
      if (i !== idx) return line;
      return { ...line, [field]: val };
    }));
  };

  // --- INTEGRACIÓN DE INGRESOS Y EGRESOS POR CANAL (ESTÁNDAR vs INSTITUCIONAL vs CONSOLIDADO) ---
  
  // Suma de ventas filtrada por canal
  const totalSales = useMemo(() => {
    const stdSales = sales?.filter(s => s.status !== 'CANCELADA').reduce((acc, s) => acc + (s.total || 0), 0) || 0;
    const instSalesSum = instSales?.filter(s => s.status !== 'CANCELADA').reduce((acc, s) => acc + (s.total || 0), 0) || 0;
    if (selectedChannel === 'estandar') return stdSales;
    if (selectedChannel === 'institucional') return instSalesSum;
    return stdSales + instSalesSum;
  }, [sales, instSales, selectedChannel]);

  // Suma de gastos/costos filtrada por canal
  const totalExpensesSimplificado = useMemo(() => {
    const cashExpenses = expenses?.reduce((acc, e) => acc + (e.amount || 0), 0) || 0;
    const purchaseExpenses = purchases?.filter(p => p.status === 'CERRADA').reduce((acc, p) => acc + (p.total || 0), 0) || 0;
    const instPurchExpenses = instPurchases?.reduce((acc, p) => acc + (p.total || 0), 0) || 0;
    const manualExpenses = journal?.filter(j => j.type === 'Egreso').reduce((acc, j) => acc + (j.amount || 0), 0) || 0;

    if (selectedChannel === 'estandar') {
      return cashExpenses + purchaseExpenses + manualExpenses;
    }
    if (selectedChannel === 'institucional') {
      return instPurchExpenses;
    }
    return cashExpenses + purchaseExpenses + instPurchExpenses + manualExpenses;
  }, [expenses, purchases, instPurchases, journal, selectedChannel]);

  const totalManualIncome = useMemo(() => {
    if (selectedChannel === 'institucional') return 0;
    return journal?.filter(j => j.type === 'Ingreso').reduce((acc, j) => acc + (j.amount || 0), 0) || 0;
  }, [journal, selectedChannel]);

  // Sumas de Contabilidad Avanzada desde el Libro Diario
  const totalAdvancedIncome = useMemo(() => {
    let sum = 0;
    journal?.filter(j => j.type === 'Avanzado').forEach(j => {
      j.lines?.forEach((l: any) => {
        if (l.accountCode?.startsWith('4')) {
          sum += (l.credit || 0) - (l.debit || 0);
        }
      });
    });
    return sum;
  }, [journal]);

  const totalAdvancedExpenses = useMemo(() => {
    let sum = 0;
    journal?.filter(j => j.type === 'Avanzado').forEach(j => {
      j.lines?.forEach((l: any) => {
        if (l.accountCode?.startsWith('5') || l.accountCode?.startsWith('6')) {
          sum += (l.debit || 0) - (l.credit || 0);
        }
      });
    });
    return sum;
  }, [journal]);

  // Selección de Indicadores según Nivel de Configuración
  const activeIncome = useMemo(() => {
    if (settings.accountingLevel === 'Avanzado') {
      if (selectedChannel !== 'consolidado') {
        return totalSales + totalManualIncome;
      }
      return totalAdvancedIncome > 0 ? totalAdvancedIncome : (totalSales + totalManualIncome);
    }
    return totalSales + totalManualIncome;
  }, [settings.accountingLevel, totalAdvancedIncome, totalSales, totalManualIncome, selectedChannel]);

  const activeExpenses = useMemo(() => {
    if (settings.accountingLevel === 'Avanzado') {
      if (selectedChannel !== 'consolidado') {
        return totalExpensesSimplificado;
      }
      return totalAdvancedExpenses > 0 ? totalAdvancedExpenses : totalExpensesSimplificado;
    }
    return totalExpensesSimplificado;
  }, [settings.accountingLevel, totalAdvancedExpenses, totalExpensesSimplificado, selectedChannel]);

  const grossProfit = activeIncome - activeExpenses;

  // --- CÁLCULO DE GANANCIAS POR COSTO DE PRODUCTO (GANADO O PERDIDO) ---
  
  const productProfitability = useMemo(() => {
    if (!inventory) return [];
    
    // Diccionario temporal para consolidar estadísticas por producto
    const stats: Record<string, {
      sku: string;
      name: string;
      category: string;
      qtySold: number;
      revenue: number;
      qtyPurchased: number;
      totalCost: number;
    }> = {};

    // Inicializar diccionario con productos maestros
    inventory.forEach(p => {
      stats[p.sku] = {
        sku: p.sku,
        name: p.name,
        category: p.category || 'General',
        qtySold: 0,
        revenue: 0,
        qtyPurchased: 0,
        totalCost: 0
      };
    });

    // 1. Sumar ventas de caja estándar (solo si consolidado o estandar)
    if (selectedChannel === 'consolidado' || selectedChannel === 'estandar') {
      sales?.forEach(s => {
        if (s.status === 'CANCELADA') return;
        s.items?.forEach((item: any) => {
          const sku = (item.sku || '').toUpperCase();
          if (sku && stats[sku]) {
            stats[sku].qtySold += item.quantity || 0;
            stats[sku].revenue += (item.price * item.quantity) || 0;
          }
        });
      });
    }

    // 2. Sumar ventas del canal Institucional/Proyectos (solo si consolidado o institucional)
    if (selectedChannel === 'consolidado' || selectedChannel === 'institucional') {
      instSales?.forEach(s => {
        if (s.status === 'CANCELADA') return;
        s.cartItems?.forEach((item: any) => {
          const sku = (item.sku || '').toUpperCase();
          if (sku && stats[sku]) {
            stats[sku].qtySold += item.quantity || 0;
            stats[sku].revenue += (item.price * item.quantity) || 0;
          }
        });
      });
    }

    // 3. Sumar costos de Compras Estándar (solo si consolidado o estandar)
    if (selectedChannel === 'consolidado' || selectedChannel === 'estandar') {
      purchases?.forEach(p => {
        if (p.status !== 'CERRADA') return;
        p.items?.forEach((item: any) => {
          const sku = (item.sku || '').toUpperCase();
          if (sku && stats[sku]) {
            stats[sku].qtyPurchased += item.quantity || 0;
            stats[sku].totalCost += (item.cost * item.quantity) || 0;
          }
        });
      });
    }

    // 4. Sumar costos de Compras Institucionales/Proyectos (solo si consolidado o institucional)
    if (selectedChannel === 'consolidado' || selectedChannel === 'institucional') {
      instPurchases?.forEach(p => {
        p.items?.forEach((item: any) => {
          // En compras institucionales, 'item.name' puede ser el SKU o el Nombre del producto.
          const matched = inventory.find(inv => inv.sku === item.name || inv.name === item.name);
          const sku = matched ? matched.sku : item.name?.toUpperCase();
          if (sku && stats[sku]) {
            stats[sku].qtyPurchased += item.quantity || 0;
            stats[sku].totalCost += (item.price * item.quantity) || 0; // 'price' en compras de proyectos representa el costo
          }
        });
      });
    }

    // 5. Formatear y calcular utilidades por producto (Gano/Perdió)
    return Object.values(stats)
      .filter(p => p.qtySold > 0) // Solo mostrar productos que han registrado ventas
      .map(p => {
        const avgSellingPrice = p.revenue / p.qtySold;
        
        // Costo promedio de compra. Si no hay compras registradas en Firestore, usar estimación razonable (60% del precio de venta maestro)
        const masterProduct = inventory.find(inv => inv.sku === p.sku);
        const fallbackCost = masterProduct ? (masterProduct.price * 0.6) : 0;
        const avgCost = p.qtyPurchased > 0 ? (p.totalCost / p.qtyPurchased) : fallbackCost;

        const profitPerUnit = avgSellingPrice - avgCost;
        const totalProfit = p.qtySold * profitPerUnit;

        return {
          sku: p.sku,
          name: p.name,
          category: p.category,
          qtySold: p.qtySold,
          revenue: p.revenue,
          avgSellingPrice,
          avgCost,
          profitPerUnit,
          totalProfit
        };
      });
  }, [inventory, sales, instSales, purchases, instPurchases, selectedChannel]);

  // Filtrado de la tabla de rentabilidad por búsqueda de texto
  const filteredProductProfitability = useMemo(() => {
    return productProfitability.filter(p => 
      p.sku.toLowerCase().includes(rentabilidadSearch.toLowerCase()) ||
      p.name.toLowerCase().includes(rentabilidadSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(rentabilidadSearch.toLowerCase())
    );
  }, [productProfitability, rentabilidadSearch]);

  // --- RENTABILIDAD POR PROYECTO DE LICITACIÓN ---
  
  const projectMargins = useMemo(() => {
    if (!instProjects) return [];
    return instProjects.map(p => {
      const budget = p.totalBudget || 0;
      
      // Sumar los costos reales cargados a este proyecto en compras institucionales
      const directCosts = instPurchases
        ?.filter(purch => purch.projectId === p.id)
        .reduce((acc, purch) => acc + (purch.total || 0), 0) || 0;

      const netProfit = budget - directCosts;
      const roi = directCosts > 0 ? (netProfit / directCosts) * 100 : 0;

      return {
        id: p.id,
        name: p.name,
        customerName: p.customerName || 'Cliente Institucional',
        budget,
        directCosts,
        netProfit,
        roi,
        status: p.status
      };
    });
  }, [instProjects, instPurchases]);

  // --- BASE DE DATOS Y FLUJOS CONTABLES GENERALES ---

  const handleAddJournalEntry = async () => {
    if (!newEntry.description || !newEntry.amount) return;
    try {
      await addDoc(journalRef, {
        ...newEntry,
        amount: parseFloat(newEntry.amount),
        timestamp: new Date().toISOString(),
        type: newEntry.type
      });
      toast({ title: "Asiento Registrado", description: "Movimiento simple guardado." });
      setNewEntry({ description: '', amount: '', type: 'Egreso', account: 'Gastos de Administración' });
      setIsJournalModalOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar." });
    }
  };

  const handleAddAdvancedEntry = async () => {
    if (!isBalanced) {
      toast({ variant: "destructive", title: "Asiento Descuadrado", description: "El debe y el haber deben ser iguales." });
      return;
    }
    try {
      const formattedLines = advLines.map(l => {
        const cat = DEFAULT_CATALOG.find(c => c.code === l.accountCode);
        return {
          accountCode: l.accountCode,
          accountName: cat ? cat.name : 'Cuenta Desconocida',
          group: cat ? cat.group : 'Gastos',
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0
        };
      });

      await addDoc(journalRef, {
        description: advDescription || 'Partida Contable Diaria',
        timestamp: new Date(advDate).toISOString(),
        type: 'Avanzado',
        lines: formattedLines,
        amount: totalDebitLines
      });

      toast({ title: "Asiento Cuadrado Registrado", description: "Partida de doble entrada formalizada con éxito." });
      setAdvDescription('');
      setAdvLines([
        { accountCode: '1101', debit: '0.00', credit: '0.00' },
        { accountCode: '4101', debit: '0.00', credit: '0.00' }
      ]);
      setIsAdvancedModalOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar el asiento avanzado." });
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'journal', id));
      toast({ title: "Registro Removido", description: "El asiento ha sido eliminado." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar." });
    }
  };

  // --- REPORTES FISCALES ---

  const filteredSalesCF = useMemo(() => {
    if (!sales) return [];
    return sales.filter(s => {
      if (s.status === 'CANCELADA') return false;
      if (s.docType !== 'CF') return false;
      const saleDate = new Date(s.timestamp);
      const saleMonth = (saleDate.getMonth() + 1).toString().padStart(2, '0');
      const saleYear = saleDate.getFullYear().toString();
      return saleMonth === filterMonth && saleYear === filterYear;
    });
  }, [sales, filterMonth, filterYear]);

  const filteredSalesCCF = useMemo(() => {
    if (!sales) return [];
    return sales.filter(s => {
      if (s.status === 'CANCELADA') return false;
      if (s.docType !== 'CCF') return false;
      const saleDate = new Date(s.timestamp);
      const saleMonth = (saleDate.getMonth() + 1).toString().padStart(2, '0');
      const saleYear = saleDate.getFullYear().toString();
      return saleMonth === filterMonth && saleYear === filterYear;
    });
  }, [sales, filterMonth, filterYear]);

  const filteredPurchases = useMemo(() => {
    if (!purchases) return [];
    return purchases.filter(p => {
      if (p.status !== 'CERRADA') return false;
      const purchaseDate = new Date(p.timestamp || p.date);
      const pMonth = (purchaseDate.getMonth() + 1).toString().padStart(2, '0');
      const pYear = purchaseDate.getFullYear().toString();
      return pMonth === filterMonth && pYear === filterYear;
    });
  }, [purchases, filterMonth, filterYear]);

  // IVA Libros
  const libVcfTotal = filteredSalesCF.reduce((acc, s) => acc + (s.total || 0), 0);
  const libVcfIVA = libVcfTotal - (libVcfTotal / (1 + settings.ivaRate / 100));
  const libVcfNeto = libVcfTotal / (1 + settings.ivaRate / 100);

  const libVcTotal = filteredSalesCCF.reduce((acc, s) => acc + (s.total || 0), 0);
  const libVcIVA = libVcTotal - (libVcTotal / (1 + settings.ivaRate / 100));
  const libVcNeto = libVcTotal / (1 + settings.ivaRate / 100);

  const libVcRetenido = useMemo(() => {
    return filteredSalesCCF.reduce((acc, s) => {
      const net = s.total / (1 + settings.ivaRate / 100);
      if (net >= 100 && (settings.taxProfile === 'Gran Contribuyente' || s.isGranContribuyente)) {
        return acc + (net * 0.01);
      }
      return acc;
    }, 0);
  }, [filteredSalesCCF, settings.taxProfile, settings.ivaRate]);

  const libComprasTotal = filteredPurchases.reduce((acc, p) => acc + (p.total || 0), 0);
  const libComprasIVA = libComprasTotal - (libComprasTotal / (1 + settings.ivaRate / 100));
  const libComprasNeto = libComprasTotal / (1 + settings.ivaRate / 100);
  const libComprasRetenido = useMemo(() => {
    return filteredPurchases.reduce((acc, p) => {
      const net = p.total / (1 + settings.ivaRate / 100);
      if (net >= 100 && settings.taxProfile === 'Gran Contribuyente') {
        return acc + (net * 0.01);
      }
      return acc;
    }, 0);
  }, [filteredPurchases, settings.taxProfile, settings.ivaRate]);

  const totalDebitFiscal = libVcfIVA + libVcIVA;
  const totalCreditFiscal = libComprasIVA;
  const f07TaxBalance = totalDebitFiscal - totalCreditFiscal;

  const f14PagoCuenta = activeIncome * (settings.pagoCuentaRate / 100);
  const f14Total = f14PagoCuenta + libVcRetenido;

  // Exportar anexo CSV
  const handleExportCSV = (type: 'vcf' | 'vc' | 'compras') => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let fileName = '';

    if (type === 'vcf') {
      fileName = `Libro_Ventas_Consumidor_${filterMonth}_${filterYear}.csv`;
      headers = ['No. Correlativo', 'Fecha', 'Documento', 'Cliente', 'Exento', 'Gravado Neto', 'IVA 13%', 'Total'];
      rows = filteredSalesCF.map((s, idx) => [
        (idx + 1).toString(),
        new Date(s.timestamp).toLocaleDateString(),
        s.id || 'N/A',
        s.customer || 'Consumidor Final',
        '0.00',
        (s.total / 1.13).toFixed(2),
        (s.total - (s.total / 1.13)).toFixed(2),
        s.total.toFixed(2)
      ]);
    } else if (type === 'vc') {
      fileName = `Libro_Ventas_Contribuyentes_${filterMonth}_${filterYear}.csv`;
      headers = ['No.', 'Fecha', 'Documento', 'Cliente', 'NRC', 'Gravado Neto', 'IVA 13%', 'IVA Retenido (1%)', 'Total'];
      rows = filteredSalesCCF.map((s, idx) => {
        const net = s.total / 1.13;
        const retention = net >= 100 ? (net * 0.01).toFixed(2) : '0.00';
        return [
          (idx + 1).toString(),
          new Date(s.timestamp).toLocaleDateString(),
          s.id || 'N/A',
          s.customer || 'Contribuyente',
          s.nrc || 'N/A',
          net.toFixed(2),
          (s.total - net).toFixed(2),
          retention,
          s.total.toFixed(2)
        ];
      });
    } else {
      fileName = `Libro_Compras_${filterMonth}_${filterYear}.csv`;
      headers = ['No.', 'Fecha', 'Proveedor', 'NRC', 'Compras Gravadas', 'IVA Crédito 13%', 'IVA Retenido Sufrido', 'Total'];
      rows = filteredPurchases.map((p, idx) => {
        const net = p.total / 1.13;
        const retention = net >= 100 && settings.taxProfile === 'Gran Contribuyente' ? (net * 0.01).toFixed(2) : '0.00';
        return [
          (idx + 1).toString(),
          new Date(p.timestamp || p.date).toLocaleDateString(),
          p.supplier || p.provider || 'Proveedor',
          p.nrc || 'N/A',
          net.toFixed(2),
          (p.total - net).toFixed(2),
          retention,
          p.total.toFixed(2)
        ];
      });
    }

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Libro Exportado", description: `Archivo guardado como ${fileName}` });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 transition-colors duration-300">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm border border-slate-100" onClick={() => router.push('/')}>
            <ArrowLeft className="text-slate-600" size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 font-headline tracking-tight">Finanzas & Contabilidad</h1>
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-[9px] font-bold border border-blue-100 px-2 h-5">
                {settings.accountingLevel === 'Avanzado' ? 'CONTABILIDAD COMPLETA' : 'CONTABILIDAD SIMPLIFICADA'}
              </Badge>
            </div>
            <p className="text-slate-500 text-xs md:text-sm">Control fiscal salvadoreño, libro diario parametrizable, rentabilidad de productos y licitaciones</p>
          </div>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          {settings.accountingLevel === 'Avanzado' ? (
            <Button className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs h-10 font-bold shadow-md shadow-blue-200" onClick={() => setIsAdvancedModalOpen(true)}>
              <Plus size={14} className="mr-1 md:mr-2" /> Nueva Partida Diario
            </Button>
          ) : (
            <Button className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs h-10 font-bold shadow-md shadow-blue-200" onClick={() => setIsJournalModalOpen(true)}>
              <Plus size={14} className="mr-1 md:mr-2" /> Nuevo Asiento Simple
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Selector de Canal / Vista Contable */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 gap-4 transition-all duration-300">
          <div className="space-y-1">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">Canal Contable de Evaluación</h3>
            <p className="text-xs text-slate-500 leading-none">Filtre y compare las ventas e inventarios por canal de distribución.</p>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl w-full sm:w-auto">
            <Button 
              variant={selectedChannel === 'consolidado' ? 'default' : 'ghost'} 
              size="sm" 
              className={`flex-1 sm:flex-none rounded-xl text-xs h-9 font-bold px-4 transition-all duration-200 ${
                selectedChannel === 'consolidado' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-950 dark:hover:text-white'
              }`} 
              onClick={() => setSelectedChannel('consolidado')}
            >
              Consolidado
            </Button>
            <Button 
              variant={selectedChannel === 'estandar' ? 'default' : 'ghost'} 
              size="sm" 
              className={`flex-1 sm:flex-none rounded-xl text-xs h-9 font-bold px-4 transition-all duration-200 ${
                selectedChannel === 'estandar' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-950 dark:hover:text-white'
              }`} 
              onClick={() => setSelectedChannel('estandar')}
            >
              Caja / Retail
            </Button>
            <Button 
              variant={selectedChannel === 'institucional' ? 'default' : 'ghost'} 
              size="sm" 
              className={`flex-1 sm:flex-none rounded-xl text-xs h-9 font-bold px-4 transition-all duration-200 ${
                selectedChannel === 'institucional' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-950 dark:hover:text-white'
              }`} 
              onClick={() => setSelectedChannel('institucional')}
            >
              Licitaciones / Proyectos
            </Button>
          </div>
        </div>

        {/* KPI Panel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <Card className="border-none shadow-sm rounded-3xl bg-white p-5">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={18} /></div>
              <Badge variant="outline" className="text-[9px] text-emerald-600 bg-emerald-50/50 border-emerald-100">Unificado</Badge>
            </div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Ingresos Totales (ERP+Inst.)</p>
            <p className="text-2xl font-black text-slate-900">${activeIncome.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
          </Card>

          <Card className="border-none shadow-sm rounded-3xl bg-white p-5">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl"><TrendingDown size={18} /></div>
              <Badge variant="outline" className="text-[9px] text-rose-600 bg-rose-50/50 border-rose-100">Consolidado</Badge>
            </div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Costos Totales (ERP+Inst.)</p>
            <p className="text-2xl font-black text-slate-900">${activeExpenses.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
          </Card>

          <Card className={`border-none shadow-sm rounded-3xl p-5 text-white ${grossProfit >= 0 ? 'bg-blue-600 shadow-lg shadow-blue-100' : 'bg-rose-600 shadow-lg shadow-rose-100'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-white/10 rounded-xl"><Scale size={18} /></div>
              <Badge variant="outline" className="text-[9px] text-white border-white/20 uppercase font-black">Utilidad</Badge>
            </div>
            <p className="text-[10px] font-black uppercase opacity-75 tracking-wider">Margen Neto Global</p>
            <p className="text-2xl font-black">${grossProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
          </Card>

          <Card className="border-none shadow-sm rounded-3xl bg-slate-900 p-5 text-white">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-white/10 rounded-xl"><Percent size={18} className="text-blue-400" /></div>
              <Badge variant="outline" className="text-[9px] text-blue-400 border-blue-800 bg-blue-950/20">{settings.ivaRate}% IVA</Badge>
            </div>
            <p className="text-[10px] font-black uppercase opacity-60 tracking-wider">Pago a Cuenta Est.</p>
            <p className="text-2xl font-black text-blue-400">${f14PagoCuenta.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
          </Card>
        </div>

        {/* MÓDULO PRINCIPAL CON PESTAÑAS */}
        <Tabs defaultValue="diario" className="space-y-6">
          <TabsList className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100 flex-wrap h-auto w-full justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="diario" className="rounded-xl px-5 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs md:text-sm">
              <FileText size={14} className="mr-2"/> Libro Diario
            </TabsTrigger>
            <TabsTrigger value="rentabilidad" className="rounded-xl px-5 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs md:text-sm">
              <PieChart size={14} className="mr-2"/> Rentabilidad & Márgenes
            </TabsTrigger>
            <TabsTrigger value="libros_iva" className="rounded-xl px-5 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs md:text-sm">
              <BookOpen size={14} className="mr-2"/> Libros de IVA
            </TabsTrigger>
            <TabsTrigger value="mh_forms" className="rounded-xl px-5 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs md:text-sm">
              <Calculator size={14} className="mr-2"/> Declaración MH
            </TabsTrigger>
            <TabsTrigger value="pnl" className="rounded-xl px-5 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs md:text-sm">
              <BarChart3 size={14} className="mr-2"/> P&L Resultados
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-xl px-5 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs md:text-sm">
              <Settings size={14} className="mr-2"/> Ajustes ERP
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: LIBRO DIARIO / CATÁLOGO */}
          <TabsContent value="diario" className="space-y-4 outline-none">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
                <Button variant={activeSubTab === 'movimientos' ? 'default' : 'ghost'} size="sm" className="rounded-lg text-xs h-8 font-bold" onClick={() => setActiveSubTab('movimientos')}>
                  Movimientos Contables
                </Button>
                <Button variant={activeSubTab === 'catalogo' ? 'default' : 'ghost'} size="sm" className="rounded-lg text-xs h-8 font-bold" onClick={() => setActiveSubTab('catalogo')}>
                  Catálogo de Cuentas Standard
                </Button>
              </div>

              {activeSubTab === 'movimientos' && (
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <Input placeholder="Buscar en el diario..." className="pl-9 h-9 text-xs bg-white rounded-xl border-slate-200" />
                </div>
              )}
            </div>

            {activeSubTab === 'movimientos' ? (
              <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden border border-slate-100">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/70 border-b border-slate-100">
                      <TableRow>
                        <TableHead className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Fecha</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Concepto / Cuenta</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tipo / Registro</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Debe</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Haber</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {journal?.length === 0 && sales?.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-16 text-slate-400 text-xs italic">No hay partidas ni movimientos contables registrados.</TableCell>
                        </TableRow>
                      )}
                      
                      {journal?.map((entry: any) => {
                        const isAdv = entry.type === 'Avanzado';
                        return (
                          <React.Fragment key={entry.id}>
                            <TableRow className="bg-white hover:bg-slate-50/50">
                              <TableCell className="px-6 py-4 text-xs font-medium text-slate-500 whitespace-nowrap">
                                {new Date(entry.timestamp).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="py-4">
                                <span className="font-bold text-xs text-slate-900 block">{entry.description}</span>
                                {isAdv && (
                                  <span className="text-[9px] text-blue-500 font-bold block mt-0.5">Partida Diario de Doble Entrada</span>
                                )}
                              </TableCell>
                              <TableCell className="py-4">
                                <Badge variant="outline" className={`text-[9px] font-black h-5 uppercase px-2 ${
                                  entry.type === 'Ingreso' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                  entry.type === 'Egreso' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                  'bg-indigo-50 text-indigo-600 border-indigo-100'
                                }`}>
                                  {isAdv ? 'Partida' : entry.type}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-4 font-black text-xs text-slate-900">
                                {!isAdv ? (entry.type === 'Ingreso' ? `$${entry.amount.toFixed(2)}` : '-') : `$${entry.amount.toFixed(2)}`}
                              </TableCell>
                              <TableCell className="py-4 font-black text-xs text-slate-900">
                                {!isAdv ? (entry.type === 'Egreso' ? `$${entry.amount.toFixed(2)}` : '-') : `$${entry.amount.toFixed(2)}`}
                              </TableCell>
                              <TableCell className="py-4 text-right px-6">
                                <div className="flex gap-1 justify-end">
                                  {isAdv && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-500" onClick={() => setSelectedAdvEntry(entry)}>
                                      <Eye size={13} />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-rose-600" onClick={() => handleDeleteEntry(entry.id)}>
                                    <Trash2 size={13} />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                        );
                      })}
                      
                      {settings.accountingLevel === 'Simplificado' && sales?.slice(0, 5).map((sale: any) => (
                        <TableRow key={sale.id} className="opacity-70 bg-slate-50/20">
                          <TableCell className="px-6 py-3 text-xs text-slate-400">{new Date(sale.timestamp).toLocaleDateString()}</TableCell>
                          <TableCell className="py-3">
                            <span className="text-xs italic text-slate-500 block">Venta DTE: {sale.customer}</span>
                            <span className="text-[9px] text-slate-400 font-bold block mt-0.5">Sincronizado de Ventas ({sale.docType})</span>
                          </TableCell>
                          <TableCell className="py-3"><Badge variant="outline" className="text-[8px] bg-blue-50 text-blue-600 border-blue-100 h-4">AUTOMÁTICO</Badge></TableCell>
                          <TableCell className="py-3 font-black text-xs text-emerald-600">+${sale.total.toFixed(2)}</TableCell>
                          <TableCell className="py-3 text-slate-400">-</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            ) : (
              // CATÁLOGO DE CUENTAS
              <Card className="border-none shadow-sm rounded-3xl bg-white p-6 border border-slate-100">
                <div className="mb-4">
                  <h3 className="font-bold text-slate-900 text-sm">Estructura del Catálogo de Cuentas</h3>
                  <p className="text-slate-500 text-xs">Cuentas contables organizadas según el esquema estándar del Ministerio de Hacienda de El Salvador.</p>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="w-32 text-[10px] font-black uppercase text-slate-400">Código</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400">Nombre de la Cuenta</TableHead>
                        <TableHead className="w-48 text-[10px] font-black uppercase text-slate-400">Rubro Contable</TableHead>
                        <TableHead className="w-32 text-center text-[10px] font-black uppercase text-slate-400">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {DEFAULT_CATALOG.map((acc) => (
                        <TableRow key={acc.code} className="hover:bg-slate-50/50">
                          <TableCell className="font-mono text-xs font-bold text-slate-600">{acc.code}</TableCell>
                          <TableCell className="text-xs font-semibold text-slate-900">{acc.name}</TableCell>
                          <TableCell>
                            <Badge className={`text-[8px] font-black uppercase h-5 ${
                              acc.group === 'Activo' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              acc.group === 'Pasivo' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                              acc.group === 'Patrimonio' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                              acc.group === 'Ingresos' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                              acc.group === 'Costos' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                              'bg-rose-50 text-rose-700 border-rose-100'
                            }`}>{acc.group}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-slate-100 text-slate-600 text-[8px] font-bold">Activa</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* TAB 2: NUEVA PESTAÑA - RENTABILIDAD & GANANCIAS POR COSTO DE PRODUCTO Y LICITACIONES */}
          <TabsContent value="rentabilidad" className="space-y-6 outline-none">
            <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit">
              <Button variant={rentabilidadSubTab === 'productos' ? 'default' : 'ghost'} size="sm" className="rounded-lg text-xs h-8 font-bold" onClick={() => setRentabilidadSubTab('productos')}>
                Rentabilidad por Producto (Ganado / Perdido)
              </Button>
              <Button variant={rentabilidadSubTab === 'licitaciones' ? 'default' : 'ghost'} size="sm" className="rounded-lg text-xs h-8 font-bold" onClick={() => setRentabilidadSubTab('licitaciones')}>
                Rentabilidad de Licitaciones (Proyectos Inst.)
              </Button>
            </div>

            {rentabilidadSubTab === 'productos' ? (
              // RENTABILIDAD POR PRODUCTO
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border">
                  <div>
                    <h3 className="font-black text-sm text-slate-900">Análisis de Ganancias por Costo de Suministro</h3>
                    <p className="text-xs text-slate-500">Muestra cuánto se vendió cada producto, su costo unitario estimado/real y el margen de ganancia o pérdida total.</p>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <Input 
                      placeholder="Filtrar por SKU o Nombre..." 
                      value={rentabilidadSearch}
                      onChange={e => setRentabilidadSearch(e.target.value)}
                      className="pl-9 h-9 text-xs bg-slate-50 border-none rounded-xl"
                    />
                  </div>
                </div>

                <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50/70 border-b">
                        <TableRow>
                          <TableHead className="px-6 text-[10px] font-black uppercase text-slate-400 tracking-wider">SKU</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Producto</TableHead>
                          <TableHead className="text-center text-[10px] font-black uppercase text-slate-400 tracking-wider">Cant. Vendida</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase text-slate-400 tracking-wider">P. Venta Prom.</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase text-slate-400 tracking-wider">Costo Prom.</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase text-slate-400 tracking-wider">Margen Un.</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase text-slate-400 tracking-wider">Rentabilidad Total</TableHead>
                          <TableHead className="text-center text-[10px] font-black uppercase text-slate-400 tracking-wider">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProductProfitability.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-16 text-slate-400 italic text-xs">
                              No hay productos con historial de facturación para evaluar.
                            </TableCell>
                          </TableRow>
                        ) : filteredProductProfitability.map((p) => {
                          const isProfit = p.totalProfit >= 0;
                          return (
                            <TableRow key={p.sku} className="hover:bg-slate-50/50">
                              <TableCell className="px-6 py-4 font-mono font-bold text-xs text-slate-600">{p.sku}</TableCell>
                              <TableCell className="py-4 font-semibold text-xs text-slate-900">{p.name}</TableCell>
                              <TableCell className="text-center py-4 font-bold text-xs text-slate-800">{p.qtySold} un.</TableCell>
                              <TableCell className="text-right py-4 font-bold text-xs text-slate-950">${p.avgSellingPrice.toFixed(2)}</TableCell>
                              <TableCell className="text-right py-4 font-bold text-xs text-slate-500">${p.avgCost.toFixed(2)}</TableCell>
                              <TableCell className={`text-right py-4 font-black text-xs ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {isProfit ? '+' : ''}${p.profitPerUnit.toFixed(2)}
                              </TableCell>
                              <TableCell className={`text-right py-4 font-black text-xs ${isProfit ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {isProfit ? '+' : ''}${p.totalProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                              </TableCell>
                              <TableCell className="text-center py-4">
                                <Badge className={`text-[8px] font-black uppercase h-5 ${
                                  isProfit 
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                                    : 'bg-rose-50 text-rose-600 border border-rose-200'
                                }`}>
                                  {isProfit ? 'GANANCIA ✅' : 'PÉRDIDA ❌'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </div>
            ) : (
              // RENTABILIDAD DE LICITACIONES
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="bg-white p-4 rounded-2xl border">
                  <h3 className="font-black text-sm text-slate-900">Análisis Consolidado de Proyectos Institucionales</h3>
                  <p className="text-xs text-slate-500">Muestra el monto total adjudicado (presupuesto), costos reales de suministros cargados y la ganancia neta líquida obtenida por Licitación.</p>
                </div>

                <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50/70">
                      <TableRow>
                        <TableHead className="px-6 text-[10px] font-black uppercase text-slate-400 tracking-wider">Proyecto / Expediente</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Cliente Corporativo</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase text-slate-400 tracking-wider">Monto Adjudicado</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase text-slate-400 tracking-wider">Costo de Suministros</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase text-slate-400 tracking-wider">Ganancia Neta</TableHead>
                        <TableHead className="text-center text-[10px] font-black uppercase text-slate-400 tracking-wider">Retorno (ROI)</TableHead>
                        <TableHead className="text-center text-[10px] font-black uppercase text-slate-400 tracking-wider">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectMargins.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-16 text-slate-400 italic text-xs">
                            No hay proyectos institucionales aperturados en el sistema.
                          </TableCell>
                        </TableRow>
                      ) : projectMargins.map((p) => {
                        const isProfit = p.netProfit >= 0;
                        return (
                          <TableRow key={p.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6 py-4">
                              <span className="font-bold text-xs text-slate-900 block">{p.name}</span>
                              <span className="text-[9px] text-slate-400 block font-mono">ID: {p.id?.slice(0, 8)}</span>
                            </TableCell>
                            <TableCell className="text-xs font-semibold text-slate-700">{p.customerName}</TableCell>
                            <TableCell className="text-right font-black text-xs text-slate-900">${p.budget.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                            <TableCell className="text-right font-bold text-xs text-rose-500">-${p.directCosts.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                            <TableCell className={`text-right font-black text-xs ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                              ${p.netProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </TableCell>
                            <TableCell className="text-center py-4 font-mono font-bold text-xs text-slate-700">
                              {p.roi.toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={p.status === 'FINALIZADO' ? 'bg-emerald-100 text-emerald-600 text-[8px]' : 'bg-blue-100 text-blue-600 text-[8px]'}>
                                {p.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* TAB 3: LIBROS DE IVA DEL EL SALVADOR */}
          <TabsContent value="libros_iva" className="space-y-6 outline-none">
            <Card className="p-5 bg-white border-none shadow-sm rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Filtrar Mes Fiscal</Label>
                  <div className="flex gap-2">
                    <Select value={filterMonth} onValueChange={setFilterMonth}>
                      <SelectTrigger className="w-32 h-9 text-xs rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString().padStart(2, '0')} className="text-xs">
                            {new Date(2026, i, 1).toLocaleString('es', { month: 'long' }).toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filterYear} onValueChange={setFilterYear}>
                      <SelectTrigger className="w-24 h-9 text-xs rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2025" className="text-xs">2025</SelectItem>
                        <SelectItem value="2026" className="text-xs">2026</SelectItem>
                        <SelectItem value="2027" className="text-xs">2027</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Button onClick={() => handleExportCSV(activeTaxTab)} className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-10 text-xs font-bold flex gap-2">
                <FileSpreadsheet size={14} /> Exportar Libro a CSV
              </Button>
            </Card>

            <div className="space-y-4">
              <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-full justify-start overflow-x-auto">
                <Button variant={activeTaxTab === 'vcf' ? 'default' : 'ghost'} size="sm" className="rounded-lg text-xs h-8 font-bold whitespace-nowrap" onClick={() => setActiveTaxTab('vcf')}>
                  Ventas a Consumidor Final (CF)
                </Button>
                <Button variant={activeTaxTab === 'vc' ? 'default' : 'ghost'} size="sm" className="rounded-lg text-xs h-8 font-bold whitespace-nowrap" onClick={() => setActiveTaxTab('vc')}>
                  Ventas a Contribuyentes (CCF)
                </Button>
                <Button variant={activeTaxTab === 'compras' ? 'default' : 'ghost'} size="sm" className="rounded-lg text-xs h-8 font-bold whitespace-nowrap" onClick={() => setActiveTaxTab('compras')}>
                  Libro de Compras
                </Button>
              </div>

              {activeTaxTab === 'vcf' && (
                <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden p-6">
                  <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <div>
                      <h3 className="font-bold text-sm">Libro de Ventas a Consumidor Final</h3>
                      <p className="text-xs text-slate-500">Muestra las ventas facturadas a Consumidores Finales (DTE Tipo 01 / CF).</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase text-slate-400">Total IVA Débito (13%)</p>
                      <p className="text-lg font-black text-emerald-600">${libVcfIVA.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="text-[9px] uppercase font-bold">No.</TableHead>
                          <TableHead className="text-[9px] uppercase font-bold">Fecha</TableHead>
                          <TableHead className="text-[9px] uppercase font-bold">Número de DTE</TableHead>
                          <TableHead className="text-[9px] uppercase font-bold">Cliente</TableHead>
                          <TableHead className="text-[9px] uppercase font-bold">Ventas Gravadas</TableHead>
                          <TableHead className="text-[9px] uppercase font-bold">IVA Débito (13%)</TableHead>
                          <TableHead className="text-right text-[9px] uppercase font-bold">Total Facturado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSalesCF.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-400 text-xs italic">No hay ventas CF registradas en este período.</TableCell></TableRow>
                        ) : filteredSalesCF.map((s, idx) => {
                          const net = s.total / 1.13;
                          const iva = s.total - net;
                          return (
                            <TableRow key={s.id} className="hover:bg-slate-50/50">
                              <TableCell className="text-xs">{idx + 1}</TableCell>
                              <TableCell className="text-xs">{new Date(s.timestamp).toLocaleDateString()}</TableCell>
                              <TableCell className="font-mono text-xs text-blue-600 font-bold">{s.id?.slice(0, 8)}...</TableCell>
                              <TableCell className="text-xs font-semibold">{s.customer}</TableCell>
                              <TableCell className="text-xs font-medium">${net.toFixed(2)}</TableCell>
                              <TableCell className="text-xs font-medium">${iva.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-black text-xs text-slate-900">${s.total.toFixed(2)}</TableCell>
                            </TableRow>
                          );
                        })}
                        {filteredSalesCF.length > 0 && (
                          <TableRow className="bg-slate-50 font-black">
                            <TableCell colSpan={4} className="text-right text-xs">TOTALES FISCALES:</TableCell>
                            <TableCell className="text-xs text-slate-900">${libVcfNeto.toFixed(2)}</TableCell>
                            <TableCell className="text-xs text-emerald-600">${libVcfIVA.toFixed(2)}</TableCell>
                            <TableCell className="text-right text-xs text-slate-900">${libVcfTotal.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}

              {activeTaxTab === 'vc' && (
                <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden p-6">
                  <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <div>
                      <h3 className="font-bold text-sm">Libro de Ventas a Contribuyentes</h3>
                      <p className="text-xs text-slate-500">Muestra las ventas facturadas con Comprobante de Crédito Fiscal (DTE Tipo 03 / CCF).</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase text-slate-400">Total IVA Débito (13%)</p>
                      <p className="text-lg font-black text-emerald-600">${libVcIVA.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="text-[9px] uppercase font-bold">No.</TableHead>
                          <TableHead className="text-[9px] uppercase font-bold">Fecha</TableHead>
                          <TableHead className="text-[9px] uppercase font-bold">Documento</TableHead>
                          <TableHead className="text-[9px] uppercase font-bold">Cliente</TableHead>
                          <TableHead className="text-[9px] uppercase font-bold">Monto Gravado</TableHead>
                          <TableHead className="text-[9px] uppercase font-bold">IVA 13%</TableHead>
                          <TableHead className="text-[9px] uppercase font-bold">Retención (1%)</TableHead>
                          <TableHead className="text-right text-[9px] uppercase font-bold">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSalesCCF.length === 0 ? (
                          <TableRow><TableCell colSpan={8} className="text-center py-12 text-slate-400 text-xs italic">No hay ventas de CCF en este período.</TableCell></TableRow>
                        ) : filteredSalesCCF.map((s, idx) => {
                          const net = s.total / 1.13;
                          const iva = s.total - net;
                          const hasRet = net >= 100 && (settings.taxProfile === 'Gran Contribuyente' || s.isGranContribuyente);
                          const ret = hasRet ? net * 0.01 : 0;
                          return (
                            <TableRow key={s.id} className="hover:bg-slate-50/50">
                              <TableCell className="text-xs">{idx + 1}</TableCell>
                              <TableCell className="text-xs">{new Date(s.timestamp).toLocaleDateString()}</TableCell>
                              <TableCell className="font-mono text-xs font-bold text-blue-600">{s.id?.slice(0, 8)}...</TableCell>
                              <TableCell className="text-xs">
                                <span className="font-semibold block">{s.customer}</span>
                                <span className="text-[9px] text-slate-400 block">NRC: {s.nrc || 'N/A'}</span>
                              </TableCell>
                              <TableCell className="text-xs">${net.toFixed(2)}</TableCell>
                              <TableCell className="text-xs">${iva.toFixed(2)}</TableCell>
                              <TableCell className="text-xs text-rose-600 font-bold">
                                {ret > 0 ? `-$${ret.toFixed(2)}` : '$0.00'}
                              </TableCell>
                              <TableCell className="text-right font-black text-xs text-slate-900">${(s.total - ret).toFixed(2)}</TableCell>
                            </TableRow>
                          );
                        })}
                        {filteredSalesCCF.length > 0 && (
                          <TableRow className="bg-slate-50 font-black">
                            <TableCell colSpan={4} className="text-right text-xs">TOTALES FISCALES:</TableCell>
                            <TableCell className="text-xs">${libVcNeto.toFixed(2)}</TableCell>
                            <TableCell className="text-xs text-emerald-600">${libVcIVA.toFixed(2)}</TableCell>
                            <TableCell className="text-xs text-rose-500">-${libVcRetenido.toFixed(2)}</TableCell>
                            <TableCell className="text-right text-xs text-slate-900">${(libVcTotal - libVcRetenido).toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}

              {activeTaxTab === 'compras' && (
                <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden p-6">
                  <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <div>
                      <h3 className="font-bold text-sm">Libro de Compras</h3>
                      <p className="text-xs text-slate-500">Muestra los gastos y costos deducibles de IVA ingresados por el ERP NexWay.</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase text-slate-400">Total IVA Crédito (13%)</p>
                      <p className="text-lg font-black text-rose-600">${libComprasIVA.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="text-[9px] uppercase font-bold">No.</TableHead>
                          <TableHead className="text-[9px] uppercase font-bold">Fecha</TableHead>
                          <TableHead className="text-[9px] uppercase font-bold">Proveedor</TableHead>
                          <TableHead className="text-[9px] uppercase font-bold">Monto Neto</TableHead>
                          <TableHead className="text-[9px] uppercase font-bold">IVA Crédito 13%</TableHead>
                          <TableHead className="text-[9px] uppercase font-bold">Retenido Sufrido</TableHead>
                          <TableHead className="text-right text-[9px] uppercase font-bold">Total Compra</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPurchases.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-400 text-xs italic">No hay compras registradas en este período.</TableCell></TableRow>
                        ) : filteredPurchases.map((p, idx) => {
                          const net = p.total / 1.13;
                          const iva = p.total - net;
                          const hasRet = net >= 100 && settings.taxProfile === 'Gran Contribuyente';
                          const ret = hasRet ? net * 0.01 : 0;
                          return (
                            <TableRow key={p.id} className="hover:bg-slate-50/50">
                              <TableCell className="text-xs">{idx + 1}</TableCell>
                              <TableCell className="text-xs">{new Date(p.timestamp || p.date).toLocaleDateString()}</TableCell>
                              <TableCell className="text-xs">
                                <span className="font-semibold block">{p.supplier || p.provider || 'Proveedor'}</span>
                                <span className="text-[9px] text-slate-400 block">NRC: {p.nrc || 'N/A'}</span>
                              </TableCell>
                              <TableCell className="text-xs">${net.toFixed(2)}</TableCell>
                              <TableCell className="text-xs">${iva.toFixed(2)}</TableCell>
                              <TableCell className="text-xs text-rose-600 font-bold">${ret.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-black text-xs text-slate-900">${(p.total - ret).toFixed(2)}</TableCell>
                            </TableRow>
                          );
                        })}
                        {filteredPurchases.length > 0 && (
                          <TableRow className="bg-slate-50 font-black">
                            <TableCell colSpan={3} className="text-right text-xs">TOTALES COMPRAS:</TableCell>
                            <TableCell className="text-xs">${libComprasNeto.toFixed(2)}</TableCell>
                            <TableCell className="text-xs text-rose-600">${libComprasIVA.toFixed(2)}</TableCell>
                            <TableCell className="text-xs text-rose-500">-${libComprasRetenido.toFixed(2)}</TableCell>
                            <TableCell className="text-right text-xs text-slate-900">${(libComprasTotal - libComprasRetenido).toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* TAB 4: FORMULARIOS DE HACIENDA */}
          <TabsContent value="mh_forms" className="space-y-6 outline-none">
            <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit">
              <Button variant={activeFormTab === 'f07' ? 'default' : 'ghost'} size="sm" className="rounded-lg text-xs h-8 font-bold" onClick={() => setActiveFormTab('f07')}>
                F07 - Declaración Mensual de IVA
              </Button>
              <Button variant={activeFormTab === 'f14' ? 'default' : 'ghost'} size="sm" className="rounded-lg text-xs h-8 font-bold" onClick={() => setActiveFormTab('f14')}>
                F14 - Pago a Cuenta y Retenciones
              </Button>
            </div>

            {activeFormTab === 'f07' ? (
              // FORMULARIO F07
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-none shadow-sm rounded-3xl bg-white p-6 md:p-8 space-y-6">
                  <div className="flex items-center justify-between border-b pb-4">
                    <h3 className="font-black text-slate-900 text-base">F07 - Impuesto al Valor Agregado (Esquema Mensual)</h3>
                    <Badge className="bg-blue-600 text-white font-bold text-[9px] uppercase px-3 h-6">Ministerio de Hacienda</Badge>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-3 bg-slate-50/50 rounded-xl space-y-3">
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest border-b pb-1">Sección A: Débito Fiscal (Tus Ventas)</p>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-semibold">Ventas Gravadas a Consumidores Finales (CF)</span>
                        <span className="font-bold text-slate-900">${libVcfNeto.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-semibold">Ventas Gravadas a Contribuyentes (CCF)</span>
                        <span className="font-bold text-slate-900">${libVcNeto.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-bold border-t pt-2 text-slate-800">
                        <span>Total Débito Fiscal Generado (13%):</span>
                        <span className="text-emerald-600">${totalDebitFiscal.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50/50 rounded-xl space-y-3">
                      <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest border-b pb-1">Sección B: Crédito Fiscal (Tus Compras)</p>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-semibold">Compras Internas Gravadas del Período</span>
                        <span className="font-bold text-slate-900">${libComprasNeto.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-bold border-t pt-2 text-slate-800">
                        <span>Total Crédito Fiscal Deducible (13%):</span>
                        <span className="text-rose-600">${totalCreditFiscal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </Card>

                <div className="space-y-4">
                  <Card className="border-none shadow-xl rounded-3xl bg-slate-900 text-white p-6 relative overflow-hidden">
                    <div className="relative z-10 space-y-4">
                      <p className="text-[9px] font-black uppercase text-blue-400 tracking-wider">Resultado del Período</p>
                      <h2 className="text-3xl font-black">
                        {f07TaxBalance >= 0 ? `$${f07TaxBalance.toFixed(2)}` : `$${Math.abs(f07TaxBalance).toFixed(2)}`}
                      </h2>
                      <p className="text-xs text-white/60 leading-relaxed">
                        {f07TaxBalance >= 0 
                          ? 'Monto estimado a transferir al Ministerio de Hacienda por concepto de Débito Fiscal neto.' 
                          : 'Tienes un saldo remanente a tu favor de IVA Crédito Fiscal aplicable al siguiente período.'}
                      </p>
                      <div className="pt-4">
                        <Badge className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${f07TaxBalance >= 0 ? 'bg-amber-500 text-slate-900' : 'bg-blue-500 text-white'}`}>
                          {f07TaxBalance >= 0 ? 'IMPUESTO A PAGAR F07' : 'REMANENTE DE CRÉDITO'}
                        </Badge>
                      </div>
                    </div>
                    <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3" />
                  </Card>

                  <div className="bg-amber-50 border border-amber-100 p-5 rounded-3xl flex gap-3 text-amber-800">
                    <AlertCircle className="flex-shrink-0 text-amber-600" size={16} />
                    <div className="space-y-1 text-xs">
                      <p className="font-bold">Recordatorio Tributario</p>
                      <p className="leading-relaxed opacity-90">La declaración F07 del IVA debe presentarse ante el Ministerio de Hacienda a más tardar los primeros 10 días hábiles del mes siguiente.</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // FORMULARIO F14
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-none shadow-sm rounded-3xl bg-white p-6 md:p-8 space-y-6">
                  <div className="flex items-center justify-between border-b pb-4">
                    <h3 className="font-black text-slate-900 text-base">F14 - Declaración de Pago a Cuenta y Retenciones de Renta</h3>
                    <Badge className="bg-blue-600 text-white font-bold text-[9px] uppercase px-3 h-6">Ministerio de Hacienda</Badge>
                  </div>

                  <div className="space-y-4">
                    <div className="p-3 bg-slate-50/50 rounded-xl space-y-3">
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b pb-1">Sección A: Pago a Cuenta del Impuesto sobre la Renta</p>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-semibold">Base de Ingresos Operativos del ERP</span>
                        <span className="font-bold text-slate-900">${activeIncome.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-semibold">Tasa del Pago a Cuenta Mensual</span>
                        <span className="font-bold text-slate-900">{settings.pagoCuentaRate}%</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-bold border-t pt-2 text-slate-800">
                        <span>Pago a Cuenta Sugerido:</span>
                        <span className="text-blue-600">${f14PagoCuenta.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50/50 rounded-xl space-y-3">
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b pb-1">Sección B: Retenciones Sufridas del 1% (Grandes Contribuyentes)</p>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-semibold">IVA Retenido por Terceros en tus ventas CCF</span>
                        <span className="font-bold text-rose-600">-${libVcRetenido.toFixed(2)}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-normal">
                        * Este monto fue retenido por tus clientes calificados como Grandes Contribuyentes y es acreditable para tu pago mensual.
                      </p>
                    </div>
                  </div>
                </Card>

                <div className="space-y-4">
                  <Card className="border-none shadow-xl rounded-3xl bg-slate-900 text-white p-6 relative overflow-hidden">
                    <div className="relative z-10 space-y-4">
                      <p className="text-[9px] font-black uppercase text-blue-400 tracking-wider">Total a Declarar en F14</p>
                      <h2 className="text-3xl font-black">
                        ${Math.max(0, f14Total).toFixed(2)}
                      </h2>
                      <p className="text-xs text-white/60 leading-relaxed">
                        Monto del Pago a Cuenta acumulado del mes restando las retenciones sufridas.
                      </p>
                      <div className="pt-4">
                        <Badge className="text-[10px] font-black px-3 py-1 rounded-full uppercase bg-blue-600 text-white">
                          PAGO A CUENTA RENTA F14
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 5: ESTADO DE RESULTADOS (P&L) */}
          <TabsContent value="pnl" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
              <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden p-6 md:p-8 space-y-6">
                <h3 className="text-lg md:text-xl font-bold border-b pb-4">Estructura de Pérdidas y Ganancias (P&L)</h3>
                <div className="space-y-4 md:space-y-6">
                  <div className="flex justify-between items-center text-xs md:text-sm">
                    <span className="text-slate-500 font-bold uppercase text-[9px] md:text-[10px]">Ingresos de Operación (Ventas + Proyectos)</span>
                    <span className="font-black text-emerald-600">${totalSales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs md:text-sm">
                    <span className="text-slate-500 font-bold uppercase text-[9px] md:text-[10px]">Ingresos Manuales / Ajustes</span>
                    <span className="font-black text-emerald-600">${totalManualIncome.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs md:text-sm border-t pt-4">
                    <span className="text-slate-900 font-black uppercase text-[10px] md:text-xs">Venta Bruta Total</span>
                    <span className="font-black text-emerald-700 text-base md:text-lg">${activeIncome.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs md:text-sm pt-2">
                    <span className="text-slate-500 font-bold uppercase text-[9px] md:text-[10px]">Costos Totales (Compras + Suministros Proy.)</span>
                    <span className="font-black text-rose-500">-${activeExpenses.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between items-center text-lg md:text-xl font-black border-t border-slate-900 pt-4 md:pt-6 mt-4">
                    <span className="uppercase text-[10px] md:text-sm tracking-tight font-black text-slate-800">UTILIDAD ESTIMADA</span>
                    <span className={grossProfit >= 0 ? 'text-blue-600' : 'text-rose-600'}>
                      ${grossProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </span>
                  </div>
                </div>
              </Card>

              <div className="space-y-4 md:space-y-6">
                <Card className="border-none shadow-sm rounded-3xl bg-slate-900 text-white p-6 md:p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-white/10 rounded-2xl"><PieChart size={20} /></div>
                    <div>
                      <h4 className="font-bold text-sm md:text-base">Análisis de Rentabilidad</h4>
                      <p className="text-white/60 text-[10px] md:text-xs">Margen sobre las ventas brutas registradas</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] md:text-xs mb-1">
                      <span>Margen de Utilidad Bruta</span>
                      <span className="font-bold">{((grossProfit / (activeIncome || 1)) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-400 transition-all duration-1000" 
                        style={{ width: `${Math.min(100, Math.max(0, (grossProfit / (activeIncome || 1)) * 100))}%` }} 
                      />
                    </div>
                  </div>
                </Card>

                <div className="bg-blue-50 border border-blue-100 p-5 rounded-3xl flex items-start gap-4">
                  <div className="p-2 bg-blue-600 text-white rounded-xl flex-shrink-0"><TrendingUp size={18} /></div>
                  <div className="space-y-1">
                    <h4 className="text-xs md:text-sm font-bold text-blue-900">Análisis NexWay Contable</h4>
                    <p className="text-[10px] md:text-xs text-blue-700 leading-relaxed">
                      El margen neto está operando en rango saludable. Recuerda registrar tus amortizaciones y depreciaciones trimestralmente para mayor precisión.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 6: AJUSTES CONTABLES DEL ERP CLIENTE */}
          <TabsContent value="settings" className="outline-none">
            <Card className="border-none shadow-sm rounded-3xl bg-white p-6 md:p-8 space-y-8">
              <div>
                <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <Settings size={18} className="text-blue-600" /> Parámetros y Activación Modular (Licencia de Cliente)
                </h3>
                <p className="text-slate-500 text-xs mt-1">Personaliza las funciones del sistema según los requerimientos y el perfil comercial contratado por el cliente final.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-6">
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div className="space-y-1 max-w-[75%]">
                      <Label className="font-bold text-xs text-slate-900 block">Nivel de Contabilidad (Doble Entrada)</Label>
                      <span className="text-[10px] text-slate-500 block leading-normal">
                        Activa el Libro Diario profesional con registros de partidas con Debe y Haber balanceados. Si se desactiva, opera en modo simplificado de ingresos/egresos.
                      </span>
                    </div>
                    <Switch 
                      id="accountingLevel"
                      checked={settings.accountingLevel === 'Avanzado'} 
                      onCheckedChange={(checked) => handleSaveSettings({
                        ...settings,
                        accountingLevel: checked ? 'Avanzado' : 'Simplificado'
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div className="space-y-1 max-w-[75%]">
                      <Label className="font-bold text-xs text-slate-900 block">Clasificación: Gran Contribuyente</Label>
                      <span className="text-[10px] text-slate-500 block leading-normal">
                        Habilita la aplicación automática de la retención del 1% de IVA en compras y ventas de acuerdo a las leyes del Ministerio de Hacienda de El Salvador.
                      </span>
                    </div>
                    <Switch 
                      id="taxProfile"
                      checked={settings.taxProfile === 'Gran Contribuyente'} 
                      onCheckedChange={(checked) => handleSaveSettings({
                        ...settings,
                        taxProfile: checked ? 'Gran Contribuyente' : 'Normal'
                      })}
                    />
                  </div>
                </div>

                <div className="space-y-4 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                  <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider mb-2">Tasas Tributarias Configurables</h4>
                  
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Porcentaje del IVA Local (%)</Label>
                    <div className="flex gap-2">
                      <Input 
                        type="number"
                        value={settings.ivaRate} 
                        onChange={(e) => setSettings({ ...settings, ivaRate: parseFloat(e.target.value) || 0 })}
                        className="h-10 text-xs rounded-xl bg-white w-24 font-black"
                      />
                      <Button variant="secondary" size="sm" onClick={() => handleSaveSettings(settings)} className="rounded-xl text-[10px] font-bold h-10 px-4">
                        Actualizar
                      </Button>
                    </div>
                    <p className="text-[9px] text-slate-400">Por defecto es 13% en El Salvador.</p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Tasa Mensual de Pago a Cuenta (%)</Label>
                    <div className="flex gap-2">
                      <Input 
                        type="number"
                        step="0.01"
                        value={settings.pagoCuentaRate} 
                        onChange={(e) => setSettings({ ...settings, pagoCuentaRate: parseFloat(e.target.value) || 0 })}
                        className="h-10 text-xs rounded-xl bg-white w-24 font-black"
                      />
                      <Button variant="secondary" size="sm" onClick={() => handleSaveSettings(settings)} className="rounded-xl text-[10px] font-bold h-10 px-4">
                        Actualizar
                      </Button>
                    </div>
                    <p className="text-[9px] text-slate-400">Por defecto es 1.75% de los ingresos operacionales.</p>
                  </div>
                </div>

              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* --- MODAL NUEVO ASIENTO SIMPLE --- */}
      <Dialog open={isJournalModalOpen} onOpenChange={setIsJournalModalOpen}>
        <DialogContent className="rounded-2xl max-w-[90vw] md:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
               <PlusCircle className="text-blue-600" /> Nuevo Movimiento Simple
            </DialogTitle>
            <DialogDescription className="text-xs">Registre cobros directos, planilla, servicios o caja chica.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
               <Label className="text-[10px] font-bold uppercase text-slate-400">Descripción del Movimiento</Label>
               <Input 
                 placeholder="Ej. Pago de Internet corporativo..." 
                 value={newEntry.description} 
                 onChange={e => setNewEntry({...newEntry, description: e.target.value})}
                 className="rounded-xl text-xs"
               />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                 <Label className="text-[10px] font-bold uppercase text-slate-400">Monto ($)</Label>
                 <Input 
                   type="number" 
                   placeholder="0.00" 
                   value={newEntry.amount} 
                   onChange={e => setNewEntry({...newEntry, amount: e.target.value})}
                   className="rounded-xl font-bold text-xs"
                 />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-bold uppercase text-slate-400">Tipo de Flujo</Label>
                 <Select value={newEntry.type} onValueChange={(v) => setNewEntry({...newEntry, type: v})}>
                    <SelectTrigger className="h-10 rounded-xl text-xs">
                       <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="Ingreso" className="text-xs">Ingreso</SelectItem>
                       <SelectItem value="Egreso" className="text-xs">Egreso</SelectItem>
                    </SelectContent>
                 </Select>
              </div>
            </div>
            <div className="space-y-2">
               <Label className="text-[10px] font-bold uppercase text-slate-400">Cuenta de Clasificación</Label>
               <Select value={newEntry.account} onValueChange={(v) => setNewEntry({...newEntry, account: v})}>
                  <SelectTrigger className="h-10 rounded-xl text-xs">
                     <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="Gastos de Administración" className="text-xs">Gastos de Administración</SelectItem>
                     <SelectItem value="Sueldos y Prestaciones (Planilla)" className="text-xs">Sueldos y Prestaciones (Planilla)</SelectItem>
                     <SelectItem value="Servicios Básicos" className="text-xs">Servicios Básicos</SelectItem>
                     <SelectItem value="Arrendamientos y Alquileres" className="text-xs">Arrendamientos y Alquileres</SelectItem>
                  </SelectContent>
               </Select>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl shadow-md text-xs" onClick={handleAddJournalEntry}>
               REGISTRAR MOVIMIENTO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- MODAL NUEVO ASIENTO AVANZADO (DOBLE ENTRADA) --- */}
      <Dialog open={isAdvancedModalOpen} onOpenChange={setIsAdvancedModalOpen}>
        <DialogContent className="rounded-3xl max-w-[95vw] md:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-slate-900">
               <ArrowRightLeft className="text-blue-600" size={18} /> Partida Contable de Doble Entrada
            </DialogTitle>
            <DialogDescription className="text-xs">
               Ingrese el concepto, fecha y los cargos y abonos correspondientes. Recuerde que el asiento debe estar cuadrado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Concepto General de la Partida</Label>
                <Input 
                  placeholder="Ej. Registro de costo de venta y salida de almacén..." 
                  value={advDescription} 
                  onChange={e => setAdvDescription(e.target.value)}
                  className="rounded-xl text-xs h-9 border-slate-200 bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Fecha</Label>
                <Input 
                  type="date" 
                  value={advDate} 
                  onChange={e => setAdvDate(e.target.value)}
                  className="rounded-xl text-xs h-9 border-slate-200 bg-white font-bold"
                />
              </div>
            </div>

            <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50">
              <div className="max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader className="bg-slate-100">
                    <TableRow className="h-8">
                      <TableHead className="text-[9px] uppercase font-bold py-1">Cuenta Contable</TableHead>
                      <TableHead className="w-24 text-[9px] uppercase font-bold py-1">Cargo (Debe)</TableHead>
                      <TableHead className="w-24 text-[9px] uppercase font-bold py-1">Abono (Haber)</TableHead>
                      <TableHead className="w-10 py-1"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {advLines.map((line, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-100/30">
                        <TableCell className="p-1">
                          <Select 
                            value={line.accountCode} 
                            onValueChange={(v) => handleLineChange(idx, 'accountCode', v)}
                          >
                            <SelectTrigger className="h-8 text-[11px] rounded-lg bg-white border-slate-200">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DEFAULT_CATALOG.map(c => (
                                <SelectItem key={c.code} value={c.code} className="text-[11px]">
                                  {c.code} - {c.name} ({c.group})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="p-1">
                          <Input 
                            type="number"
                            placeholder="0.00"
                            value={line.debit}
                            onChange={(e) => handleLineChange(idx, 'debit', e.target.value)}
                            onFocus={e => e.target.select()}
                            className="h-8 w-24 text-right text-[11px] font-mono font-bold bg-white border-slate-200 rounded-lg"
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input 
                            type="number"
                            placeholder="0.00"
                            value={line.credit}
                            onChange={(e) => handleLineChange(idx, 'credit', e.target.value)}
                            onFocus={e => e.target.select()}
                            className="h-8 w-24 text-right text-[11px] font-mono font-bold bg-white border-slate-200 rounded-lg"
                          />
                        </TableCell>
                        <TableCell className="p-1 text-center">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-slate-400 hover:text-rose-500 rounded-md"
                            onClick={() => handleRemoveLine(idx)}
                            disabled={advLines.length <= 2}
                          >
                            <Trash2 size={12} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="p-2 bg-slate-50 border-t border-slate-100">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-lg h-7 text-[10px] font-bold border-slate-200 bg-white" 
                  onClick={handleAddLine}
                >
                  <Plus size={10} className="mr-1" /> Añadir Cuenta
                </Button>
              </div>
            </div>

            <div className="flex justify-between items-center p-3 rounded-2xl border text-xs font-bold bg-white">
              <div className="flex gap-4">
                <div>
                  <span className="text-[9px] uppercase text-slate-400 block">Total Debe</span>
                  <span className="text-slate-900">${totalDebitLines.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase text-slate-400 block">Total Haber</span>
                  <span className="text-slate-900">${totalCreditLines.toFixed(2)}</span>
                </div>
              </div>
              <div className="text-right">
                {isBalanced ? (
                  <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold flex gap-1 h-6">
                    <Check size={12} /> Asiento Cuadrado
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="font-bold flex gap-1 h-6">
                    <AlertCircle size={12} /> Descuadrado (${Math.abs(balanceDifference).toFixed(2)})
                  </Badge>
                )}
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black h-12 rounded-xl text-xs" 
              onClick={handleAddAdvancedEntry}
              disabled={!isBalanced}
            >
              REGISTRAR PARTIDA CONTABLE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG DETALLE PARTIDA AVANZADA --- */}
      <Dialog open={selectedAdvEntry !== null} onOpenChange={() => setSelectedAdvEntry(null)}>
        {selectedAdvEntry && (
          <DialogContent className="rounded-3xl max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-black text-slate-900 flex gap-2">
                <FileText className="text-blue-600" /> Detalle de Partida
              </DialogTitle>
              <DialogDescription className="text-xs">
                Asiento registrado el {new Date(selectedAdvEntry.timestamp).toLocaleDateString()} a las {new Date(selectedAdvEntry.timestamp).toLocaleTimeString()}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="bg-slate-50 p-3 rounded-2xl border">
                <span className="text-[9px] font-bold uppercase text-slate-400 block">Concepto</span>
                <span className="text-xs font-semibold text-slate-800">{selectedAdvEntry.description}</span>
              </div>

              <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="h-8">
                      <TableHead className="text-[9px] uppercase font-bold py-1">Cuenta</TableHead>
                      <TableHead className="w-20 text-[9px] uppercase font-bold py-1">Debe</TableHead>
                      <TableHead className="w-20 text-[9px] uppercase font-bold py-1">Haber</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedAdvEntry.lines?.map((l: any, i: number) => (
                      <TableRow key={i} className="hover:bg-slate-50/50">
                        <TableCell className="py-2">
                          <span className="font-mono text-[10px] font-bold text-slate-500 block">{l.accountCode}</span>
                          <span className="text-[10px] font-medium text-slate-800 block">{l.accountName}</span>
                        </TableCell>
                        <TableCell className="py-2 text-[10px] font-mono font-bold text-right">
                          {l.debit > 0 ? `$${l.debit.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell className="py-2 text-[10px] font-mono font-bold text-right">
                          {l.credit > 0 ? `$${l.credit.toFixed(2)}` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-100 font-bold border-t">
                      <TableCell className="text-[10px] uppercase font-black">Totales Partida:</TableCell>
                      <TableCell className="text-[10px] font-mono text-right text-slate-900">${selectedAdvEntry.amount?.toFixed(2)}</TableCell>
                      <TableCell className="text-[10px] font-mono text-right text-slate-900">${selectedAdvEntry.amount?.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setSelectedAdvEntry(null)} className="w-full bg-slate-900 text-white font-bold h-10 rounded-xl text-xs">
                Cerrar Vista
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}