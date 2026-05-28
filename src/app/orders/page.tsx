'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  ClipboardList, 
  ArrowLeft, 
  Search, 
  Plus, 
  Trash2, 
  Warehouse, 
  Truck, 
  Building2, 
  CheckCircle2, 
  Loader2, 
  Printer, 
  DollarSign, 
  Clock, 
  User, 
  ArrowRight,
  Info,
  Calendar,
  Eye,
  AlertTriangle,
  BadgeAlert,
  FileSpreadsheet,
  UploadCloud,
  Lock,
  Unlock,
  Mail,
  LogOut
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirestore, useCollection, useUser, getTenantName, collection, doc } from '@/firebase';
import { addDoc, updateDoc, query, where, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRouter } from 'next/navigation';
import { ModeToggle } from '@/components/mode-toggle';
import * as XLSX from 'xlsx';

interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  cost?: number;
  quoteNumber?: string;
}

export default function OrdersPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'interno' | 'externo' | 'cargar-codigos'>('interno');
  const [loading, setLoading] = useState(false);

  // Consultas Estables de Colecciones
  const inventoryQuery = useMemo(() => collection(db, 'inventory'), [db]);
  const warehousesQuery = useMemo(() => collection(db, 'warehouses'), [db]);
  const suppliersQuery = useMemo(() => collection(db, 'suppliers'), [db]);
  const internalOrdersQuery = useMemo(() => collection(db, 'internal_orders'), [db]);
  const supplierOrdersQuery = useMemo(() => collection(db, 'supplier_orders'), [db]);

  const { data: inventory, loading: loadingInv } = useCollection<any>(inventoryQuery);
  const { data: warehouses } = useCollection<any>(warehousesQuery);
  const { data: suppliers } = useCollection<any>(suppliersQuery);
  const { data: internalOrders } = useCollection<any>(internalOrdersQuery);
  const { data: supplierOrders } = useCollection<any>(supplierOrdersQuery);

  // --- BULK CODES UPLOAD STATES ---
  const [bulkCodes, setBulkCodes] = useState<{ sku: string; name: string }[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // --- PEDIDOS INTERNOS STATES ---
  const [intSourceWh, setIntSourceWh] = useState('');
  const [intDestWh, setIntDestWh] = useState('');
  const [intRequestedBy, setIntRequestedBy] = useState('');
  const [intItems, setIntItems] = useState<OrderItem[]>([]);
  const [intSearchTerm, setIntSearchTerm] = useState('');
  const [intItemQty, setIntItemQty] = useState<number | string>(1);
  const [intItemSku, setIntItemSku] = useState('');
  const [intItemName, setIntItemName] = useState('');
  const [intIsManual, setIntIsManual] = useState(false);
  const [internalSearchFilter, setInternalSearchFilter] = useState('');

  // --- PEDIDOS EXTERNOS STATES ---
  const [extSupplier, setExtSupplier] = useState('');
  const [extDestWh, setExtDestWh] = useState('');
  const [extRequestedBy, setExtRequestedBy] = useState('');
  const [extItems, setExtItems] = useState<OrderItem[]>([]);
  const [extSearchTerm, setExtSearchTerm] = useState('');
  const [extItemQty, setExtItemQty] = useState<number | string>(1);
  const [extItemCost, setExtItemCost] = useState<number | string>('');
  const [extItemSku, setExtItemSku] = useState('');
  const [extItemName, setExtItemName] = useState('');
  const [extIsManual, setExtIsManual] = useState(false);
  const [extSupplierEmail, setExtSupplierEmail] = useState('');
  const [extFromEmail, setExtFromEmail] = useState('pablopiche1g3@gmail.com');
  const [extAuthorizedBy, setExtAuthorizedBy] = useState('JULIO NEFTALI CAÑAS ZELAYA');
  const [extDigitizedBy, setExtDigitizedBy] = useState('RENE LANGLOIS 74503973');
  const [extSupplierPhone, setExtSupplierPhone] = useState('');
  const [extConfigLocked, setExtConfigLocked] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const { isAdmin } = useUser();
  const activeTenant = getTenantName();
  const [extItemQuote, setExtItemQuote] = useState('');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [externalSearchFilter, setExternalSearchFilter] = useState('');

  // Persistir metadatos bloqueados localmente y verificar vista independiente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const locked = localStorage.getItem('nexway_extConfigLocked') === 'true';
      setExtConfigLocked(locked);
      
      const savedSupplierEmail = localStorage.getItem('nexway_extSupplierEmail');
      const savedFromEmail = localStorage.getItem('nexway_extFromEmail');
      const savedAuthorizedBy = localStorage.getItem('nexway_extAuthorizedBy');
      const savedDigitizedBy = localStorage.getItem('nexway_extDigitizedBy');
      const savedSupplierPhone = localStorage.getItem('nexway_extSupplierPhone');

      if (savedSupplierEmail) setExtSupplierEmail(savedSupplierEmail);
      if (savedFromEmail) setExtFromEmail(savedFromEmail);
      if (savedAuthorizedBy) setExtAuthorizedBy(savedAuthorizedBy);
      if (savedDigitizedBy) setExtDigitizedBy(savedDigitizedBy);
      if (savedSupplierPhone) setExtSupplierPhone(savedSupplierPhone);

      // Verificar si es vista independiente (shared / standalone)
      const params = new URLSearchParams(window.location.search);
      if (params.get('shared') === 'true' || params.get('standalone') === 'true') {
        setIsStandalone(true);
      }
    }
  }, []);

  const toggleLockConfig = () => {
    if (extConfigLocked) {
      localStorage.removeItem('nexway_extConfigLocked');
      setExtConfigLocked(false);
      toast({ title: "Configuración Desbloqueada", description: "Los campos ahora pueden editarse libremente." });
    } else {
      localStorage.setItem('nexway_extConfigLocked', 'true');
      localStorage.setItem('nexway_extSupplierEmail', extSupplierEmail);
      localStorage.setItem('nexway_extFromEmail', extFromEmail);
      localStorage.setItem('nexway_extAuthorizedBy', extAuthorizedBy);
      localStorage.setItem('nexway_extDigitizedBy', extDigitizedBy);
      localStorage.setItem('nexway_extSupplierPhone', extSupplierPhone);
      setExtConfigLocked(true);
      toast({ title: "Configuración Fijada", description: "Los datos de envío, firmas y teléfono se han guardado permanentemente." });
    }
  };

  // Modal de Vista Previa / Impresión
  const [selectedOrderForPreview, setSelectedOrderForPreview] = useState<any>(null);
  const [previewType, setPreviewType] = useState<'interno' | 'externo'>('interno');

  // --- LOGICA DE ENVIO DE CORREO CLIENTE ---
  const handleSendEmailClient = (order: any) => {
    try {
      const emails = order.supplierEmail || 'sac.es2@swdeca.com';
      const subject = encodeURIComponent(`Pedido de Suministros NexWay - ${order.code}`);
      const body = encodeURIComponent(
        `Estimado proveedor,\n\nAdjunto a este correo enviamos el archivo de pedido ${order.code} generado por el Centro de Requisición & Pedidos de NexWay.\n\n` +
        `Detalles Generales del Pedido:\n` +
        `- Código de Orden: ${order.code}\n` +
        `- Bodega de Entrega: ${order.destinationWarehouse}\n` +
        `- Teléfono de quien solicita: ${order.supplierPhone || '-'}\n\n` +
        `Por favor, confirmar la recepción de este pedido y proceder con el despacho según los términos cotizados.\n\n` +
        `Atentamente,\n` +
        `${order.requestedBy || 'Responsable de Orden'}\n` +
        `NexWay S.A. de C.V.`
      );
      window.open(`mailto:${emails}?subject=${subject}&body=${body}`, '_blank');
      toast({ title: "Cliente de Correo Abierto", description: "Se ha pre-redactado la orden en tu aplicación de correo." });
    } catch {
      toast({ variant: "destructive", title: "Error al enviar", description: "No se pudo abrir el cliente de correo." });
    }
  };

  // --- LOGICA DE EXPORTACION A EXCEL ---
  const handleDownloadExcel = (order: any) => {
    try {
      // Helper para formatear fecha en español: ej. "12-may-26"
      const formatDateToSpanishShort = (dateStr: string) => {
        try {
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return '';
          const day = d.getDate();
          const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
          const month = months[d.getMonth()];
          const year = String(d.getFullYear()).slice(-2);
          return `${day}-${month}-${year}`;
        } catch {
          return '';
        }
      };

      const supplierNameUpper = String(order.supplier || 'PROVEEDOR').toUpperCase();
      const title = `PEDIDO A ${supplierNameUpper}`;
      
      const data: any[][] = [];
      
      // Fila 1: Título Centrado
      data.push(['', '', title, '']);
      
      // Fila 2: Fecha, valor, CASA MATRIZ
      data.push([
        'Fecha', 
        formatDateToSpanishShort(order.createdAt), 
        String(order.destinationWarehouse || 'CASA MATRIZ').toUpperCase(),
        ''
      ]);
      
      // Fila 3: Distribuidor, Enviar al correo electrónico
      data.push([
        'Distribuidor', 
        '', 
        'ENVIAR AL CORREO ELECTRONICO', 
        order.supplierEmail || 'sac.es2@swdeca.com'
      ]);
      
      // Fila 4: Teléfono y Correo Emisor
      data.push([
        'Teléfono', 
        order.supplierPhone || '', 
        'DESDE EL CORREO ELECTRONICO', 
        order.fromEmail || 'pablopiche1g3@gmail.com'
      ]);
      
      // Fila 5: Encabezados de Tabla
      data.push(['Cantidad', 'Rex', 'Descripción', 'No Cotizacion']);
      
      // Filas 6+: Ítems
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          data.push([
            item.quantity,
            item.sku,
            item.name,
            item.quoteNumber || ''
          ]);
        });
      }
      
      // 5 Filas vacías de separación
      for (let i = 0; i < 5; i++) {
        data.push([]);
      }
      
      // Bloque de Firmas
      data.push([
        'SOLICITADO POR',
        '',
        'AUTORIZADO POR',
        'DIGITADO POR'
      ]);
      
      data.push([
        `BODEGA ${String(order.destinationWarehouse || 'CASA MATRIZ').toUpperCase()}`,
        '',
        String(order.authorizedBy || 'JULIO NEFTALI CAÑAS ZELAYA').toUpperCase(),
        String(order.digitizedBy || 'RENE LANGLOIS 74503973').toUpperCase()
      ]);

      // Generar Worksheet de SheetJS
      const ws = XLSX.utils.aoa_to_sheet(data);
      
      // Combinaciones de celdas (Merges)
      ws['!merges'] = [
        { s: { r: 0, c: 2 }, e: { r: 0, c: 3 } } // Combinar C1 y D1 para el título
      ];

      // Anchos de columnas para evitar cortes de texto
      ws['!cols'] = [
        { wch: 15 }, // Cantidad / Fecha / SOLICITADO
        { wch: 18 }, // Rex / Valor Fecha
        { wch: 45 }, // Descripción / Etiqueta Correo / AUTORIZADO
        { wch: 35 }  // No Cotizacion / Correo / DIGITADO
      ];

      // Generar Workbook y guardar
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pedido');

      const cleanSupplier = supplierNameUpper.replace(/[^A-Z0-9]/g, '_');
      const filename = `Pedido_${cleanSupplier}_${order.code}.xlsx`;

      XLSX.writeFile(wb, filename);

      toast({
        title: "Excel Descargado",
        description: `Se ha descargado el archivo ${filename} exitosamente.`
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error de Exportación",
        description: "No se pudo generar el archivo Excel."
      });
    }
  };

  // --- LOGICA DE EXCEL ---
  const handleBulkCodesExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });

        if (json.length === 0) {
          toast({ variant: "destructive", title: "Archivo vacío", description: "El archivo Excel no contiene datos." });
          return;
        }

        const headers = (json[0] as any[]).map(h => String(h || '').trim().toLowerCase());
        
        const skuIdx = headers.findIndex(h => h.includes('sku') || h.includes('código') || h.includes('codigo') || h.includes('code') || h.includes('referencia'));
        const nameIdx = headers.findIndex(h => h.includes('descrip') || h.includes('nombre') || h.includes('producto') || h.includes('name') || h.includes('item'));

        if (skuIdx === -1) {
          toast({ variant: "destructive", title: "Formato Incorrecto", description: "No se encontró una columna de Código o SKU." });
          return;
        }

        const parsedCodes: { sku: string; name: string }[] = [];
        let count = 0;

        for (let i = 1; i < json.length; i++) {
          const row = json[i];
          if (!row || row.length === 0) continue;

          const sku = String(row[skuIdx] || '').trim().toUpperCase();
          if (!sku) continue;

          let name = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : `Producto ${sku}`;
          
          if (!parsedCodes.some(c => c.sku === sku)) {
            parsedCodes.push({ sku, name });
            count++;
          }
        }

        if (parsedCodes.length > 0) {
          setBulkCodes(parsedCodes);
          toast({ title: "Códigos Cargados", description: `Se prepararon ${count} códigos para importar desde el archivo Excel.` });
        } else {
          toast({ variant: "destructive", title: "Sin datos", description: "No se pudieron procesar filas del archivo." });
        }
      } catch (err) {
        toast({ variant: "destructive", title: "Error", description: "No se pudo leer el archivo Excel." });
      }
    };
    reader.readAsArrayBuffer(file);
    if (e.target) e.target.value = '';
  };

  const handleRegisterBulkCodes = async () => {
    if (bulkCodes.length === 0) return;
    setBulkLoading(true);
    let createdCount = 0;
    let skippedCount = 0;

    try {
      // Chunk the array into sizes of 500 (Firestore batch limit)
      const chunkSize = 500;
      for (let i = 0; i < bulkCodes.length; i += chunkSize) {
        const chunk = bulkCodes.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        
        for (const item of chunk) {
          const exists = inventory?.some((p: any) => p.sku === item.sku);
          if (!exists) {
            // Using auto-id reference
            const newDocRef = doc(collection(db, 'inventory'));
            batch.set(newDocRef, {
              sku: item.sku,
              name: item.name,
              category: 'General',
              price: 0,
              quantity: 0,
              bodegas: {},
              createdAt: new Date().toISOString()
            });
            createdCount++;
          } else {
            skippedCount++;
          }
        }
        await batch.commit();
      }

      toast({ 
        title: "Importación Exitosa", 
        description: `Se registraron ${createdCount} códigos nuevos rápidamente. Se omitieron ${skippedCount} códigos que ya existían.` 
      });
      setBulkCodes([]);
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: "Ocurrió un error al registrar los códigos en la base de datos." });
    } finally {
      setBulkLoading(false);
    }
  };

  // --- LOGICA DE PEDIDOS INTERNOS ---
  const handleIntAddItem = () => {
    if (!intItemSku) return;
    const cleanSku = intItemSku.trim().toUpperCase();
    const product = inventory?.find((p: any) => p.sku === cleanSku);
    const qty = parseInt(intItemQty.toString()) || 0;

    if (qty <= 0) {
      toast({ variant: "destructive", title: "Cantidad inválida", description: "Debe solicitar al menos 1 unidad." });
      return;
    }

    let finalName = '';
    if (product) {
      finalName = product.name;
    } else {
      if (!intItemName.trim()) {
        toast({ variant: "destructive", title: "Descripción Requerida", description: "El SKU es nuevo. Ingrese una descripción para el producto." });
        return;
      }
      finalName = intItemName.trim();
    }

    // Advertencia de Stock de origen si existe el producto
    if (product && intSourceWh) {
      const sourceStock = product.bodegas?.[intSourceWh] || 0;
      if (qty > sourceStock) {
        toast({ 
          variant: "default", 
          title: "Stock Insuficiente en Origen", 
          description: `Advertencia: ${product.name} solo cuenta con ${sourceStock} un. en ${intSourceWh}. El pedido se puede registrar como pendiente.`,
          className: "bg-amber-500 text-white"
        });
      }
    }

    setIntItems(prev => {
      const existing = prev.find(item => item.sku === cleanSku);
      if (existing) {
        return prev.map(item => item.sku === cleanSku ? { ...item, quantity: item.quantity + qty } : item);
      }
      return [...prev, { sku: cleanSku, name: finalName, quantity: qty }];
    });

    setIntItemSku('');
    setIntItemName('');
    setIntIsManual(false);
    setIntItemQty(1);
    toast({ title: "Añadido", description: `${finalName} agregado a la lista.` });
  };

  const handleCreateInternalOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intSourceWh || !intDestWh || !intRequestedBy || intItems.length === 0) {
      toast({ variant: "destructive", title: "Datos Incompletos", description: "Complete bodegas, solicitante e ítems." });
      return;
    }
    if (intSourceWh === intDestWh) {
      toast({ variant: "destructive", title: "Ruta Inválida", description: "El origen y destino deben ser bodegas diferentes." });
      return;
    }

    setLoading(true);
    try {
      // Autocrear productos inexistentes en el catálogo
      for (const item of intItems) {
        const exists = inventory?.some((p: any) => p.sku === item.sku);
        if (!exists) {
          await addDoc(collection(db, 'inventory'), {
            sku: item.sku,
            name: item.name,
            category: 'General',
            price: 0,
            quantity: 0,
            bodegas: {},
            createdAt: new Date().toISOString()
          });
        }
      }

      const orderCode = `REQ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
      await addDoc(internalOrdersQuery, {
        code: orderCode,
        sourceWarehouse: intSourceWh,
        destinationWarehouse: intDestWh,
        requestedBy: intRequestedBy,
        items: intItems,
        status: 'PENDIENTE',
        createdAt: new Date().toISOString()
      });

      toast({ title: "Requisición Enviada", description: `Se ha registrado el pedido ${orderCode} de forma exitosa y se han integrado los códigos al sistema.` });
      setIntItems([]);
      setIntRequestedBy('');
      setIntSourceWh('');
      setIntDestWh('');
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar el pedido interno." });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInternalStatus = async (orderId: string, currentStatus: string, nextStatus: 'DESPACHADO' | 'RECIBIDO') => {
    setLoading(true);
    try {
      const orderRef = doc(db, 'internal_orders', orderId);
      const order = internalOrders.find((o: any) => o.id === orderId);

      if (nextStatus === 'RECIBIDO') {
        // --- PROCESAR LOGICA DE INVENTARIO MULTIBODEGA ---
        // 1. Restar stock de la bodega origen
        // 2. Sumar stock en la bodega destino
        for (const item of order.items) {
          const product = inventory.find((p: any) => p.sku === item.sku);
          if (product) {
            const productRef = doc(db, 'inventory', product.id);
            const currentBodegas = product.bodegas || {};
            
            const sourceStock = currentBodegas[order.sourceWarehouse] || 0;
            const destStock = currentBodegas[order.destinationWarehouse] || 0;

            const updatedBodegas = {
              ...currentBodegas,
              [order.sourceWarehouse]: Math.max(0, sourceStock - item.quantity),
              [order.destinationWarehouse]: destStock + item.quantity
            };

            // Calcular nuevo total consolidado
            const consolidatedQty = Object.values(updatedBodegas).reduce((acc: number, val: any) => acc + (parseFloat(val) || 0), 0) as number;

            await updateDoc(productRef, {
              bodegas: updatedBodegas,
              quantity: consolidatedQty
            });
          }
        }
        toast({ title: "Inventario Actualizado", description: "Se ha transferido el stock físico entre las bodegas." });
      }

      await updateDoc(orderRef, { status: nextStatus, updatedAt: new Date().toISOString() });
      toast({ title: "Estado Actualizado", description: `El pedido ha sido marcado como ${nextStatus}.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el estado de la requisición." });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInternalOrder = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'internal_orders', id));
      toast({ title: "Pedido Eliminado" });
    } catch (err) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };


  // --- LOGICA DE PEDIDOS EXTERNOS ---
  const handleImportInternalOrder = (order: any) => {
    if (!order || !order.items) return;
    
    const importedItems = order.items.map((item: any) => {
      const catalogItem = inventory?.find((p: any) => p.sku === item.sku);
      const cost = catalogItem?.price || 0;
      return {
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        cost: cost
      };
    });

    setExtItems(prev => {
      const merged = [...prev];
      importedItems.forEach((newItem: any) => {
        const existing = merged.find(item => item.sku === newItem.sku);
        if (existing) {
          existing.quantity += newItem.quantity;
          if (newItem.cost > 0) existing.cost = newItem.cost;
        } else {
          merged.push(newItem);
        }
      });
      return merged;
    });

    if (order.destinationWarehouse) {
      setExtDestWh(order.destinationWarehouse);
    }

    toast({ 
      title: "Requisición Importada", 
      description: `Se han cargado ${order.items.length} productos de la requisición ${order.code}.` 
    });
  };

  const handleExtAddItem = () => {
    if (!extItemSku) return;
    const cleanSku = extItemSku.trim().toUpperCase();
    const product = inventory?.find((p: any) => p.sku === cleanSku);
    const qty = parseInt(extItemQty.toString()) || 0;
    const cost = parseFloat(extItemCost.toString()) || 0;

    if (qty <= 0) {
      toast({ variant: "destructive", title: "Cantidad inválida" });
      return;
    }
    if (cost < 0) {
      toast({ variant: "destructive", title: "Costo inválido", description: "El costo no puede ser negativo." });
      return;
    }

    let finalName = '';
    if (product) {
      finalName = product.name;
    } else {
      if (!extItemName.trim()) {
        toast({ variant: "destructive", title: "Descripción Requerida", description: "El SKU es nuevo. Ingrese una descripción para el producto." });
        return;
      }
      finalName = extItemName.trim();
    }

    setExtItems(prev => {
      const existing = prev.find(item => item.sku === cleanSku);
      if (existing) {
        return prev.map(item => item.sku === cleanSku ? { ...item, quantity: item.quantity + qty, cost: cost, quoteNumber: extItemQuote.trim() } : item);
      }
      return [...prev, { sku: cleanSku, name: finalName, quantity: qty, cost: cost, quoteNumber: extItemQuote.trim() }];
    });

    setExtItemSku('');
    setExtItemName('');
    setExtIsManual(false);
    setExtItemQty(1);
    setExtItemCost('');
    setExtItemQuote('');
    toast({ title: "Añadido", description: `${finalName} agregado.` });
  };

  const handleCreateSupplierOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extSupplier || !extDestWh || !extRequestedBy || extItems.length === 0) {
      toast({ variant: "destructive", title: "Datos Incompletos", description: "Complete todos los campos del pedido." });
      return;
    }

    setLoading(true);
    try {
      // Autocrear productos inexistentes en el catálogo
      for (const item of extItems) {
        const exists = inventory?.some((p: any) => p.sku === item.sku);
        if (!exists) {
          await addDoc(collection(db, 'inventory'), {
            sku: item.sku,
            name: item.name,
            category: 'General',
            price: item.cost || 0,
            quantity: 0,
            bodegas: {},
            createdAt: new Date().toISOString()
          });
        }
      }

      const orderCode = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const totalAmount = extItems.reduce((acc, item) => acc + ((item.cost || 0) * item.quantity), 0);

      await addDoc(supplierOrdersQuery, {
        code: orderCode,
        supplier: extSupplier,
        destinationWarehouse: extDestWh,
        requestedBy: extRequestedBy,
        items: extItems,
        total: totalAmount,
        status: 'SOLICITADO',
        createdAt: new Date().toISOString(),
        supplierEmail: extSupplierEmail,
        fromEmail: extFromEmail,
        authorizedBy: extAuthorizedBy,
        digitizedBy: extDigitizedBy,
        supplierPhone: extSupplierPhone
      });

      toast({ title: "Orden de Pedido Creada", description: `Se registró la orden ${orderCode} de forma exitosa y se han integrado los nuevos códigos al sistema.` });
      setExtItems([]);
      setExtRequestedBy('');
      setExtSupplier('');
      setExtDestWh('');
      if (!extConfigLocked) {
        setExtSupplierEmail('');
        setExtFromEmail('pablopiche1g3@gmail.com');
        setExtAuthorizedBy('JULIO NEFTALI CAÑAS ZELAYA');
        setExtDigitizedBy('RENE LANGLOIS 74503973');
        setExtSupplierPhone('');
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar el pedido externo." });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSupplierOrderStatus = async (orderId: string, nextStatus: 'RECIBIDO' | 'SOLICITADO') => {
    setLoading(true);
    try {
      const orderRef = doc(db, 'supplier_orders', orderId);
      const order = supplierOrders.find((o: any) => o.id === orderId);

      if (nextStatus === 'RECIBIDO') {
        // --- INGRESO DE STOCK AUTOMÁTICO ---
        for (const item of order.items) {
          const product = inventory.find((p: any) => p.sku === item.sku);
          if (product) {
            const productRef = doc(db, 'inventory', product.id);
            const currentBodegas = product.bodegas || {};
            
            const updatedBodegas = {
              ...currentBodegas,
              [order.destinationWarehouse]: (currentBodegas[order.destinationWarehouse] || 0) + item.quantity
            };

            // Calcular nuevo total consolidado
            const consolidatedQty = Object.values(updatedBodegas).reduce((acc: number, val: any) => acc + (parseFloat(val) || 0), 0) as number;

            await updateDoc(productRef, {
              bodegas: updatedBodegas,
              quantity: consolidatedQty,
              price: item.cost && item.cost > 0 ? item.cost : product.price // Actualizar precio con el nuevo costo si aplica
            });
          }
        }
        toast({ title: "Mercadería Recibida", description: `El stock se ha ingresado con éxito a la bodega '${order.destinationWarehouse}'.` });
      }

      await updateDoc(orderRef, { status: nextStatus, updatedAt: new Date().toISOString() });
      toast({ title: "Estado Actualizado", description: `La orden ha sido marcada como ${nextStatus}.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo completar la orden de compra." });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSupplierOrder = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'supplier_orders', id));
      toast({ title: "Orden Eliminada" });
    } catch (err) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  // --- FILTROS DE HISTORIAL ---
  const filteredInternalOrders = useMemo(() => {
    if (!internalOrders) return [];
    return internalOrders.filter((o: any) => 
      o.code.toLowerCase().includes(internalSearchFilter.toLowerCase()) ||
      o.sourceWarehouse.toLowerCase().includes(internalSearchFilter.toLowerCase()) ||
      o.destinationWarehouse.toLowerCase().includes(internalSearchFilter.toLowerCase()) ||
      o.requestedBy.toLowerCase().includes(internalSearchFilter.toLowerCase())
    );
  }, [internalSearchFilter, internalOrders]);

  const filteredSupplierOrders = useMemo(() => {
    if (!supplierOrders) return [];
    return supplierOrders.filter((o: any) => 
      o.code.toLowerCase().includes(externalSearchFilter.toLowerCase()) ||
      o.supplier.toLowerCase().includes(externalSearchFilter.toLowerCase()) ||
      o.destinationWarehouse.toLowerCase().includes(externalSearchFilter.toLowerCase())
    );
  }, [externalSearchFilter, supplierOrders]);

  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];
    return suppliers.filter((s: any) => 
      s.name.toLowerCase().includes(supplierSearchQuery.toLowerCase()) ||
      (s.nit && s.nit.includes(supplierSearchQuery))
    );
  }, [supplierSearchQuery, suppliers]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background p-4 md:p-6 transition-colors duration-300">
      
      {/* HEADER PRINCIPAL */}
      <div className="max-w-7xl mx-auto mb-6 md:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {!isStandalone && isAdmin && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full bg-white dark:bg-card shadow-sm hover:bg-slate-100 border border-slate-150" 
              onClick={() => router.push('/')}
            >
              <ArrowLeft className="text-slate-600 dark:text-foreground" size={20} />
            </Button>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-foreground tracking-tight">Centro de Requisición & Pedidos</h1>
              {activeTenant && (
                <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full text-amber-600 dark:text-amber-400 text-[10px] font-bold shadow-sm animate-pulse">
                  <span>CLIENTE: {activeTenant.toUpperCase()}</span>
                  <button 
                    onClick={() => {
                      window.localStorage.removeItem('nexway_tenant');
                      window.location.reload();
                    }}
                    className="ml-1 hover:text-amber-800 dark:hover:text-amber-200 transition-colors font-bold text-[10px]"
                    title="Volver a base principal"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            <p className="text-slate-500 dark:text-muted-foreground text-xs md:text-sm">Gestión de órdenes de pedidos internas entre tiendas y externas con proveedores</p>
          </div>
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

      <div className="max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-6">
          <TabsList className="bg-white dark:bg-card p-1 rounded-2xl shadow-sm border h-auto w-full justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="interno" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-violet-600 data-[state=active]:text-white whitespace-nowrap">
              <Warehouse size={14} className="mr-2" /> Pedidos Internos (Tiendas)
            </TabsTrigger>
            <TabsTrigger value="externo" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-violet-600 data-[state=active]:text-white whitespace-nowrap">
              <Truck size={14} className="mr-2" /> Pedidos Externos (Proveedores)
            </TabsTrigger>
            <TabsTrigger value="cargar-codigos" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-violet-600 data-[state=active]:text-white whitespace-nowrap">
              <FileSpreadsheet size={14} className="mr-2" /> Cargar Códigos (Excel)
            </TabsTrigger>
          </TabsList>

          {/* ==================== TAB PEDIDOS INTERNOS ==================== */}
          <TabsContent value="interno" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Formulario Nueva Requisición */}
              <div className="lg:col-span-5 space-y-6">
                <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                  <CardHeader className="bg-violet-900 dark:bg-violet-950 text-white p-5">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <ClipboardList size={18} className="text-violet-400" /> Nueva Requisición entre Sucursales
                    </CardTitle>
                    <CardDescription className="text-violet-200/80 text-xs">Solicite y traslade stock de forma ágil.</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="p-6 space-y-4">
                    <form onSubmit={handleCreateInternalOrder} className="space-y-4">
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Bodega (la que da el material)</Label>
                          <Select value={intSourceWh} onValueChange={setIntSourceWh}>
                            <SelectTrigger className="h-10 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold">
                              <SelectValue placeholder="Origen..." />
                            </SelectTrigger>
                            <SelectContent>
                              {warehouses?.map(w => (
                                <SelectItem key={w.id} value={w.name} className="text-xs">{w.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Bodega (que solicita)</Label>
                          <Select value={intDestWh} onValueChange={setIntDestWh}>
                            <SelectTrigger className="h-10 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold">
                              <SelectValue placeholder="Destino..." />
                            </SelectTrigger>
                            <SelectContent>
                              {warehouses?.map(w => (
                                <SelectItem key={w.id} value={w.name} className="text-xs">{w.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Responsable de Solicitud</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                          <Input 
                            placeholder="Nombre del encargado..." 
                            value={intRequestedBy}
                            onChange={e => setIntRequestedBy(e.target.value)}
                            className="pl-9 h-11 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold"
                          />
                        </div>
                      </div>

                      {/* Buscador de items para añadir */}
                      <div className="p-4 bg-slate-50 dark:bg-muted/30 rounded-2xl border space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Agregar Producto Manual</Label>
                        
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2 space-y-1 relative">
                              <Label className="text-[9px] font-bold text-slate-400">Código / SKU</Label>
                              <Input
                                placeholder="Escribe SKU..."
                                value={intItemSku}
                                onChange={e => {
                                  const val = e.target.value;
                                  setIntItemSku(val);
                                  const clean = val.trim().toUpperCase();
                                  const match = inventory?.find((p: any) => p.sku === clean);
                                  if (match) {
                                    setIntItemName(match.name);
                                    setIntIsManual(false);
                                  } else {
                                    setIntIsManual(true);
                                  }
                                }}
                                className="h-9 bg-white dark:bg-card text-xs font-bold uppercase"
                              />
                              {/* Autocomplete Suggestions */}
                              {intItemSku.trim().length > 0 && !inventory?.some((p: any) => p.sku === intItemSku.trim().toUpperCase()) && (
                                <div className="absolute z-20 w-full bg-white dark:bg-card border rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto">
                                  {inventory
                                    ?.filter((p: any) => p.sku.toLowerCase().includes(intItemSku.toLowerCase()) || p.name.toLowerCase().includes(intItemSku.toLowerCase()))
                                    .slice(0, 5)
                                    .map((p: any) => (
                                      <div
                                        key={p.id}
                                        className="p-2 hover:bg-slate-50 dark:hover:bg-muted text-left cursor-pointer transition-colors text-[11px] font-bold border-b last:border-0"
                                        onClick={() => {
                                          setIntItemSku(p.sku);
                                          setIntItemName(p.name);
                                          setIntIsManual(false);
                                        }}
                                      >
                                        <span className="text-violet-600 font-mono">{p.sku}</span> - <span className="text-slate-700 dark:text-slate-350">{p.name}</span>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[9px] font-bold text-slate-400">Cantidad</Label>
                              <Input 
                                type="number" 
                                value={intItemQty} 
                                onChange={e => setIntItemQty(e.target.value)}
                                className="h-9 bg-white dark:bg-card text-center text-xs font-bold"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] font-bold text-slate-400">Descripción del Producto</Label>
                            <Input
                              placeholder={intIsManual ? "Escriba descripción para SKU nuevo..." : "Se auto-rellena al escribir SKU..."}
                              value={intItemName}
                              onChange={e => setIntItemName(e.target.value)}
                              disabled={!intIsManual && intItemSku.trim() !== ''}
                              className="h-9 bg-white dark:bg-card text-xs font-bold"
                            />
                            {intIsManual && intItemSku.trim().length > 0 && (
                              <span className="text-[9px] text-amber-500 font-bold flex items-center gap-1 mt-0.5">
                                <AlertTriangle size={10} /> Código nuevo. Se registrará automáticamente en el inventario al guardar.
                              </span>
                            )}
                          </div>
                        </div>

                        <Button 
                          type="button" 
                          onClick={handleIntAddItem} 
                          variant="outline" 
                          className="w-full h-9 border-violet-500/20 text-violet-600 dark:text-violet-400 font-bold text-xs rounded-xl mt-2"
                        >
                          <Plus size={14} className="mr-1.5" /> Agregar a Lista
                        </Button>
                      </div>

                      {/* Items Agregados */}
                      {intItems.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Ítems Solicitados</Label>
                          <ScrollArea className="h-32 border rounded-xl bg-slate-50 dark:bg-muted/20">
                            <Table>
                              <TableBody>
                                {intItems.map((item, idx) => (
                                  <TableRow key={idx} className="hover:bg-transparent">
                                    <TableCell className="py-2 text-[10px] font-mono font-bold text-slate-600 dark:text-muted-foreground">{item.sku}</TableCell>
                                    <TableCell className="py-2 text-[11px] font-bold text-slate-800 dark:text-foreground">{item.name}</TableCell>
                                    <TableCell className="py-2 text-center text-[10px] font-black">{item.quantity} un.</TableCell>
                                    <TableCell className="py-2 text-right">
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6 text-slate-400 hover:text-rose-500"
                                        onClick={() => setIntItems(prev => prev.filter(i => i.sku !== item.sku))}
                                      >
                                        <Trash2 size={12} />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </ScrollArea>
                        </div>
                      )}

                      <Button 
                        type="submit" 
                        className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-lg text-xs"
                        disabled={loading || intItems.length === 0}
                      >
                        {loading ? <Loader2 className="animate-spin mr-2" /> : <ClipboardList className="mr-2" size={16} />}
                        ENVIAR SOLICITUD INTERNA
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Historial de Pedidos Internos */}
              <div className="lg:col-span-7 space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input 
                    placeholder="Buscar requisición por código, bodega o encargado..." 
                    value={internalSearchFilter}
                    onChange={e => setInternalSearchFilter(e.target.value)}
                    className="pl-12 h-12 bg-white dark:bg-card border-none shadow-sm rounded-2xl text-xs md:text-sm"
                  />
                </div>

                <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                  <ScrollArea className="h-[520px]">
                    <Table>
                      <TableHeader className="bg-slate-50 dark:bg-muted/50 sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="text-[10px] font-bold uppercase px-4 md:px-6">Código / Fecha</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase">Ruta</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase">Solicitante</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase text-center">Ítems</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase text-center">Estado</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInternalOrders.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-24 text-slate-400 italic text-xs">
                              No se encontraron requisiciones registradas.
                            </TableCell>
                          </TableRow>
                        ) : filteredInternalOrders.map((o: any) => (
                          <TableRow key={o.id} className="hover:bg-slate-50 dark:hover:bg-muted/30">
                            <TableCell className="px-4 md:px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-mono font-black text-xs text-slate-700 dark:text-foreground">{o.code}</span>
                                <span className="text-[9px] text-slate-400 font-bold">{new Date(o.createdAt).toLocaleDateString()}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-foreground">
                                <span>{o.sourceWarehouse}</span>
                                <ArrowRight size={10} className="text-slate-400" />
                                <span className="text-violet-600">{o.destinationWarehouse}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs font-bold text-slate-500 dark:text-muted-foreground">{o.requestedBy}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-[9px] bg-slate-50 border-slate-200">
                                {o.items?.length || 0} productos
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <Badge className={`font-black text-[9px] h-5 ${
                                  o.status === 'PENDIENTE' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                  o.status === 'DESPACHADO' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                  'bg-emerald-50 text-emerald-600 border-emerald-100'
                                }`} variant="outline">
                                  {o.status}
                                </Badge>
                                
                                {/* Acciones rápidas de cambio de estado */}
                                {o.status === 'PENDIENTE' && (
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleUpdateInternalStatus(o.id, o.status, 'DESPACHADO')}
                                    className="h-6 px-2 text-[9px] font-bold bg-blue-600 text-white rounded-md mt-1"
                                  >
                                    Despachar
                                  </Button>
                                )}
                                {o.status === 'DESPACHADO' && (
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleUpdateInternalStatus(o.id, o.status, 'RECIBIDO')}
                                    className="h-6 px-2 text-[9px] font-bold bg-emerald-600 text-white rounded-md mt-1"
                                  >
                                    Confirmar Recibido
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="px-4">
                              <div className="flex gap-1 items-center">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-slate-400 hover:text-blue-500" 
                                  onClick={() => {
                                    setSelectedOrderForPreview(o);
                                    setPreviewType('interno');
                                  }}
                                >
                                  <Eye size={12} />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-slate-400 hover:text-rose-500" 
                                  onClick={() => handleDeleteInternalOrder(o.id)}
                                >
                                  <Trash2 size={12} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </Card>
              </div>

            </div>
          </TabsContent>

          {/* ==================== TAB PEDIDOS EXTERNOS ==================== */}
          <TabsContent value="externo" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Formulario Nueva Orden Proveedor */}
              <div className="lg:col-span-5 space-y-6">
                <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                  <CardHeader className="bg-slate-900 dark:bg-slate-950 text-white p-5">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Building2 size={18} className="text-violet-400" /> Nueva Orden de Pedido a Proveedor
                    </CardTitle>
                    <CardDescription className="text-slate-400 text-xs">Cree cotizaciones u órdenes formales de compra.</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="p-6 space-y-4">
                    {/* Botón de Importación rápida de Sucursal */}
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Warehouse size={16} className="text-indigo-600 dark:text-indigo-400" />
                        <div className="flex flex-col">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-350">¿Cargar de Requisición Sucursal?</span>
                          <span className="text-[9px] text-slate-400 font-semibold">Importa los pedidos de tiendas directo a esta orden</span>
                        </div>
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button type="button" size="sm" variant="outline" className="h-8 rounded-xl text-[10px] font-black border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-card">
                            <Plus size={12} className="mr-1" /> Importar Requisición
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0" align="end">
                          <div className="p-3 border-b bg-indigo-50/50 dark:bg-indigo-950/50">
                            <span className="text-[10px] font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">Requisiciones Pendientes</span>
                          </div>
                          <ScrollArea className="h-48">
                            {internalOrders?.filter((o: any) => o.status === 'PENDIENTE').length === 0 ? (
                              <div className="p-4 text-center text-slate-400 text-xs italic">No hay requisiciones pendientes de sucursales</div>
                            ) : internalOrders
                              ?.filter((o: any) => o.status === 'PENDIENTE')
                              .map((o: any) => (
                                <div 
                                  key={o.id} 
                                  onClick={() => handleImportInternalOrder(o)} 
                                  className="p-3 hover:bg-slate-50 dark:hover:bg-muted cursor-pointer rounded-lg transition-colors border-b last:border-0"
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-mono font-black text-slate-800 dark:text-foreground">{o.code}</span>
                                    <Badge className="text-[8px] bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-bold">{o.items?.length || 0} prod.</Badge>
                                  </div>
                                  <span className="text-[9px] font-semibold text-slate-500 block mt-1">De: {o.destinationWarehouse}</span>
                                  <span className="text-[8px] font-mono text-slate-400">Solicitado por: {o.requestedBy}</span>
                                </div>
                              ))}
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <form onSubmit={handleCreateSupplierOrder} className="space-y-4">
                      
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Seleccionar Proveedor</Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <Input 
                              placeholder="Seleccione de la lista..." 
                              value={extSupplier}
                              onChange={e => setExtSupplier(e.target.value)}
                              className="h-10 pl-9 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold"
                            />
                          </div>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-xl bg-card border border-slate-200">
                                <Search size={16} />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-0" align="end">
                              <div className="p-3 border-b">
                                <Input 
                                  placeholder="Buscar proveedor..." 
                                  value={supplierSearchQuery} 
                                  onChange={e => setSupplierSearchQuery(e.target.value)} 
                                  className="h-8 text-xs bg-muted border-none" 
                                />
                              </div>
                              <ScrollArea className="h-48">
                                {filteredSuppliers.length === 0 ? (
                                  <div className="p-4 text-center text-slate-400 text-xs italic">No hay proveedores registrados</div>
                                ) : filteredSuppliers.map((s: any) => (
                                  <div 
                                    key={s.id} 
                                    onClick={() => {
                                      setExtSupplier(s.name);
                                      toast({ title: "Cargado", description: `Proveedor ${s.name} seleccionado.` });
                                    }} 
                                    className="p-3 hover:bg-slate-50 dark:hover:bg-muted cursor-pointer rounded-lg transition-colors border-b last:border-0"
                                  >
                                    <span className="text-xs font-bold text-slate-800 dark:text-foreground block">{s.name}</span>
                                    <span className="text-[9px] font-mono text-slate-400">NIT: {s.nit}</span>
                                  </div>
                                ))}
                              </ScrollArea>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Bodega de Recepción</Label>
                          <Select value={extDestWh} onValueChange={setExtDestWh}>
                            <SelectTrigger className="h-10 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold">
                              <SelectValue placeholder="Bodega..." />
                            </SelectTrigger>
                            <SelectContent>
                              {warehouses?.map(w => (
                                <SelectItem key={w.id} value={w.name} className="text-xs">{w.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Responsable de Orden</Label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                            <Input 
                              placeholder="Nombre..." 
                              value={extRequestedBy}
                              onChange={e => setExtRequestedBy(e.target.value)}
                              className="pl-8 h-10 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Configuración de Envíos & Firmas */}
                      <div className="p-4 bg-slate-50 dark:bg-muted/30 rounded-2xl border space-y-3">
                        <div className="flex justify-between items-center">
                          <Label className="text-[10px] font-black uppercase text-slate-500 block tracking-widest">Configuración de Envío & Firmas</Label>
                          <Button 
                            type="button" 
                            size="icon" 
                            variant="ghost" 
                            className={`h-7 w-7 rounded-lg transition-all ${
                              extConfigLocked 
                                ? 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100' 
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                            }`}
                            onClick={toggleLockConfig}
                            title={extConfigLocked ? "Desbloquear Configuración" : "Fijar y Bloquear Configuración"}
                          >
                            {extConfigLocked ? <Lock size={14} className="animate-pulse" /> : <Unlock size={14} />}
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[9px] font-bold text-slate-400">Enviar al correo electrónico</Label>
                            <Input 
                              placeholder="ejemplo1@mail.com, ejemplo2@mail.com"
                              value={extSupplierEmail}
                              onChange={e => setExtSupplierEmail(e.target.value)}
                              disabled={extConfigLocked}
                              className="h-9 bg-white dark:bg-card text-xs font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] font-bold text-slate-400">Desde el correo electrónico</Label>
                            <Input 
                              type="email"
                              placeholder="mi-correo@correo.com"
                              value={extFromEmail}
                              onChange={e => setExtFromEmail(e.target.value)}
                              disabled={extConfigLocked}
                              className="h-9 bg-white dark:bg-card text-xs font-bold"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[9px] font-bold text-slate-400">Teléfono de quien solicita</Label>
                            <Input 
                              placeholder="Ej: +503 7450-3973"
                              value={extSupplierPhone}
                              onChange={e => setExtSupplierPhone(e.target.value)}
                              disabled={extConfigLocked}
                              className="h-9 bg-white dark:bg-card text-xs font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] font-bold text-slate-400">Autorizado Por</Label>
                            <Input 
                              placeholder="Nombre autorizador..."
                              value={extAuthorizedBy}
                              onChange={e => setExtAuthorizedBy(e.target.value)}
                              disabled={extConfigLocked}
                              className="h-9 bg-white dark:bg-card text-xs font-bold"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[9px] font-bold text-slate-400">Digitado Por</Label>
                            <Input 
                              placeholder="Nombre digitador..."
                              value={extDigitizedBy}
                              onChange={e => setExtDigitizedBy(e.target.value)}
                              disabled={extConfigLocked}
                              className="h-9 bg-white dark:bg-card text-xs font-bold"
                            />
                          </div>
                          <div className="flex items-center justify-start text-[9px] text-slate-400 font-semibold italic pl-1 pt-4">
                            {extConfigLocked 
                              ? "🔒 Configuración bloqueada y guardada." 
                              : "🔓 Modifica y pulsa el candado para fijar."}
                          </div>
                        </div>
                      </div>

                      {/* Cargar Ítems Manualmente */}
                      <div className="p-4 bg-slate-50 dark:bg-muted/30 rounded-2xl border space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-500 block tracking-widest">Agregar Producto Manual</Label>
                        
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2 space-y-1 relative">
                              <Label className="text-[9px] font-bold text-slate-400">Código / SKU</Label>
                              <Input
                                placeholder="Escribe SKU..."
                                value={extItemSku}
                                onChange={e => {
                                  const val = e.target.value;
                                  setExtItemSku(val);
                                  const clean = val.trim().toUpperCase();
                                  const match = inventory?.find((p: any) => p.sku === clean);
                                  if (match) {
                                    setExtItemName(match.name);
                                    setExtIsManual(false);
                                  } else {
                                    setExtIsManual(true);
                                  }
                                }}
                                className="h-9 bg-white dark:bg-card text-xs font-bold uppercase"
                              />
                              {/* Autocomplete Suggestions */}
                              {extItemSku.trim().length > 0 && !inventory?.some((p: any) => p.sku === extItemSku.trim().toUpperCase()) && (
                                <div className="absolute z-20 w-full bg-white dark:bg-card border rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto">
                                  {inventory
                                    ?.filter((p: any) => p.sku.toLowerCase().includes(extItemSku.toLowerCase()) || p.name.toLowerCase().includes(extItemSku.toLowerCase()))
                                    .slice(0, 5)
                                    .map((p: any) => (
                                      <div
                                        key={p.id}
                                        className="p-2 hover:bg-slate-50 dark:hover:bg-muted text-left cursor-pointer transition-colors text-[11px] font-bold border-b last:border-0"
                                        onClick={() => {
                                          setExtItemSku(p.sku);
                                          setExtItemName(p.name);
                                          setExtIsManual(false);
                                        }}
                                      >
                                        <span className="text-violet-600 font-mono">{p.sku}</span> - <span className="text-slate-700 dark:text-slate-350">{p.name}</span>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[9px] font-bold text-slate-400">Cant.</Label>
                              <Input 
                                type="number" 
                                value={extItemQty} 
                                onChange={e => setExtItemQty(e.target.value)}
                                className="h-9 bg-white dark:bg-card text-center text-xs font-bold"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[9px] font-bold text-slate-400">Descripción del Producto</Label>
                              <Input
                                placeholder={extIsManual ? "Escriba descripción..." : "Se auto-rellena..."}
                                value={extItemName}
                                onChange={e => setExtItemName(e.target.value)}
                                disabled={!extIsManual && extItemSku.trim() !== ''}
                                className="h-9 bg-white dark:bg-card text-xs font-bold"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[9px] font-bold text-slate-400">Costo ($)</Label>
                              <Input 
                                type="number" 
                                placeholder="0.00"
                                value={extItemCost} 
                                onChange={e => setExtItemCost(e.target.value)}
                                className="h-9 bg-white dark:bg-card text-right text-xs font-bold text-emerald-600"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[9px] font-bold text-slate-400">No. Cotización</Label>
                              <Input 
                                placeholder="Ej: COT-102"
                                value={extItemQuote} 
                                onChange={e => setExtItemQuote(e.target.value)}
                                className="h-9 bg-white dark:bg-card text-xs font-bold text-slate-800"
                              />
                            </div>
                          </div>
                          
                          {extIsManual && extItemSku.trim().length > 0 && (
                            <span className="text-[9px] text-amber-500 font-bold flex items-center gap-1 mt-0.5">
                              <AlertTriangle size={10} /> Código nuevo. Se registrará automáticamente en el inventario al guardar.
                            </span>
                          )}
                        </div>

                        <Button 
                          type="button" 
                          onClick={handleExtAddItem} 
                          variant="outline" 
                          className="w-full h-9 border-violet-500/20 text-violet-600 dark:text-violet-400 font-bold text-xs rounded-xl mt-2"
                        >
                          <Plus size={14} className="mr-1.5" /> Agregar Ítem
                        </Button>
                      </div>

                      {/* Lista de Ítems */}
                      {extItems.length > 0 && (
                        <div className="space-y-2 pt-2 border-t">
                          <div className="flex justify-between items-center">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Detalle de Pedido</Label>
                            <span className="text-xs font-black text-emerald-600">Total: ${extItems.reduce((acc, item) => acc + ((item.cost || 0) * item.quantity), 0).toFixed(2)}</span>
                          </div>
                          <ScrollArea className="h-32 border rounded-xl bg-slate-50 dark:bg-muted/20">
                            <Table>
                              <TableBody>
                                {extItems.map((item, idx) => (
                                  <TableRow key={idx} className="hover:bg-transparent">
                                    <TableCell className="py-2 text-[10px] font-mono font-bold text-slate-600 dark:text-muted-foreground">{item.sku}</TableCell>
                                    <TableCell className="py-2 text-[11px] font-bold text-slate-800 dark:text-foreground">
                                      {item.name}
                                      {item.quoteNumber && (
                                        <Badge variant="outline" className="text-[8px] bg-indigo-50 border-indigo-150 text-indigo-600 ml-1.5 font-bold h-4 px-1 py-0 select-none">
                                          Cot: {item.quoteNumber}
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="py-2 text-center text-[10px] font-bold">{item.quantity}x</TableCell>
                                    <TableCell className="py-2 text-right text-[10px] font-bold text-emerald-600">${((item.cost || 0) * item.quantity).toFixed(2)}</TableCell>
                                    <TableCell className="py-2 text-right">
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6 text-slate-400 hover:text-rose-500"
                                        onClick={() => setExtItems(prev => prev.filter(i => i.sku !== item.sku))}
                                      >
                                        <Trash2 size={12} />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </ScrollArea>
                        </div>
                      )}

                      <Button 
                        type="submit" 
                        className="w-full h-12 bg-slate-900 dark:bg-violet-600 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg text-xs"
                        disabled={loading || extItems.length === 0}
                      >
                        {loading ? <Loader2 className="animate-spin mr-2" /> : <Plus className="mr-2" size={16} />}
                        GENERAR ORDEN DE PEDIDO
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Historial de Pedidos Proveedores */}
              <div className="lg:col-span-7 space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input 
                    placeholder="Buscar orden externa por código, proveedor o bodega..." 
                    value={externalSearchFilter}
                    onChange={e => setExternalSearchFilter(e.target.value)}
                    className="pl-12 h-12 bg-white dark:bg-card border-none shadow-sm rounded-2xl text-xs md:text-sm"
                  />
                </div>

                <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                  <ScrollArea className="h-[520px]">
                    <Table>
                      <TableHeader className="bg-slate-50 dark:bg-muted/50 sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="text-[10px] font-bold uppercase px-4 md:px-6">Código / Fecha</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase">Proveedor</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase">Destino</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase text-right">Inversión</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase text-center">Estado</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSupplierOrders.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-24 text-slate-400 italic text-xs">
                              No se encontraron órdenes registradas.
                            </TableCell>
                          </TableRow>
                        ) : filteredSupplierOrders.map((o: any) => (
                          <TableRow key={o.id} className="hover:bg-slate-50 dark:hover:bg-muted/30">
                            <TableCell className="px-4 md:px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-mono font-black text-xs text-slate-700 dark:text-foreground">{o.code}</span>
                                <span className="text-[9px] text-slate-400 font-bold">{new Date(o.createdAt).toLocaleDateString()}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs font-bold text-slate-800 dark:text-foreground">{o.supplier}</TableCell>
                            <TableCell className="text-xs font-semibold text-slate-500 dark:text-muted-foreground flex items-center gap-1 mt-3">
                              <Warehouse size={12} className="text-slate-400" />
                              <span>{o.destinationWarehouse}</span>
                            </TableCell>
                            <TableCell className="text-right text-xs font-black text-emerald-600">${o.total?.toFixed(2)}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <Badge className={`font-black text-[9px] h-5 ${
                                  o.status === 'SOLICITADO' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                  'bg-emerald-50 text-emerald-600 border-emerald-100'
                                }`} variant="outline">
                                  {o.status}
                                </Badge>
                                
                                {o.status === 'SOLICITADO' && (
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleUpdateSupplierOrderStatus(o.id, 'RECIBIDO')}
                                    className="h-6 px-2 text-[9px] font-bold bg-emerald-600 text-white rounded-md mt-1"
                                  >
                                    Cargar Stock
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="px-4">
                              <div className="flex gap-1 items-center">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-slate-400 hover:text-blue-500" 
                                  onClick={() => {
                                    setSelectedOrderForPreview(o);
                                    setPreviewType('externo');
                                  }}
                                  title="Ver Vista Previa"
                                >
                                  <Eye size={12} />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20" 
                                  title="Descargar Excel (.xlsx)"
                                  onClick={() => handleDownloadExcel(o)}
                                >
                                  <FileSpreadsheet size={12} />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-slate-400 hover:text-rose-500" 
                                  onClick={() => handleDeleteSupplierOrder(o.id)}
                                  title="Eliminar Orden"
                                >
                                  <Trash2 size={12} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </Card>
              </div>

            </div>
          </TabsContent>

          {/* ==================== TAB CARGAR CÓDIGOS ==================== */}
          <TabsContent value="cargar-codigos" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Cargador e Instrucciones */}
              <div className="lg:col-span-5 space-y-6">
                <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                  <CardHeader className="bg-violet-900 dark:bg-violet-950 text-white p-5">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <FileSpreadsheet size={18} className="text-violet-400" /> Carga Masiva de Códigos
                    </CardTitle>
                    <CardDescription className="text-violet-200/80 text-xs">Registra productos masivamente en el inventario.</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="p-6 space-y-4">
                    <div className="p-4 bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/50 rounded-2xl space-y-2">
                      <Label className="text-[10px] font-black uppercase text-violet-600 dark:text-violet-400 tracking-widest block flex items-center gap-1.5 font-sans">
                        <UploadCloud size={14} /> Seleccionar Excel (.xlsx)
                      </Label>
                      <div className="relative border-2 border-dashed border-violet-200 dark:border-violet-850 hover:border-violet-500 rounded-xl p-6 text-center cursor-pointer transition-all bg-white dark:bg-card">
                        <input 
                          type="file" 
                          accept=".xlsx, .xls" 
                          onChange={handleBulkCodesExcelUpload} 
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                        <div className="flex flex-col items-center gap-2">
                          <UploadCloud size={28} className="text-violet-500 animate-pulse" />
                          <span className="text-[12px] font-bold text-slate-755 dark:text-slate-350">Arrastra o selecciona un archivo</span>
                          <span className="text-[10px] text-slate-400 font-semibold">El archivo debe contener las columnas: Código/SKU y Descripción</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-muted/30 border rounded-2xl text-xs space-y-2 text-slate-600 dark:text-slate-350">
                      <h4 className="font-black text-slate-700 dark:text-foreground text-[10px] uppercase tracking-wider flex items-center gap-1">
                        <Info size={12} className="text-violet-500" /> Formato sugerido de columnas:
                      </h4>
                      <ul className="list-disc list-inside pl-1 space-y-1 font-semibold text-[11px]">
                        <li><span className="font-mono text-violet-600 dark:text-violet-400">Código / SKU</span> (Obligatorio)</li>
                        <li><span className="font-mono text-violet-600 dark:text-violet-400">Descripción / Nombre</span> (Obligatorio)</li>
                      </ul>
                      <p className="text-[10px] text-slate-400 pt-1 leading-relaxed">
                        Los productos se guardarán con cantidad <span className="font-bold">0</span> y precio <span className="font-bold">$0.00</span> en el inventario consolidado. Luego podrás abastecerlos desde los módulos de stock o compras.
                      </p>
                    </div>

                    {bulkCodes.length > 0 && (
                      <Button 
                        type="button" 
                        onClick={handleRegisterBulkCodes} 
                        className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-lg text-xs"
                        disabled={bulkLoading}
                      >
                        {bulkLoading ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" size={16} />}
                        IMPORTAR {bulkCodes.length} CÓDIGOS AL CATÁLOGO
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Vista Previa de Códigos a Registrar */}
              <div className="lg:col-span-7 space-y-4">
                <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                  <div className="p-4 bg-slate-50 dark:bg-muted/50 sticky top-0 border-b flex justify-between items-center z-10">
                    <span className="text-[10px] font-black text-slate-700 dark:text-foreground uppercase tracking-widest">Vista Previa de Importación</span>
                    <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-600 border-violet-100 font-bold">
                      {bulkCodes.length} productos listos
                    </Badge>
                  </div>
                  <ScrollArea className="h-[480px]">
                    <Table>
                      <TableHeader className="bg-slate-50/50 dark:bg-muted/30">
                        <TableRow>
                          <TableHead className="w-1/3 px-4 md:px-6 text-[10px] font-bold uppercase">Código / SKU</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase">Descripción / Nombre</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bulkCodes.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center py-24 text-slate-400 italic text-xs">
                              Sube un archivo de Excel para ver la vista previa de los códigos a registrar.
                            </TableCell>
                          </TableRow>
                        ) : bulkCodes.map((item, idx) => (
                          <TableRow key={idx} className="hover:bg-slate-50 dark:hover:bg-muted/30">
                            <TableCell className="px-4 md:px-6 py-3 font-mono font-black text-xs text-slate-700 dark:text-foreground">
                              {item.sku}
                            </TableCell>
                            <TableCell className="text-xs font-bold text-slate-500 dark:text-muted-foreground">
                              {item.name}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </Card>
              </div>

            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ==================== MODAL DE VISTA PREVIA & IMPRESIÓN DE ORDEN ==================== */}
      {selectedOrderForPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-card border w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Header Modal */}
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Printer size={18} className="text-violet-400" />
                <span className="font-bold text-sm">Vista Previa del Documento</span>
              </div>
              <Badge className="font-mono bg-violet-600 text-white font-bold">{selectedOrderForPreview.code}</Badge>
            </div>

            {/* Area de Impresión */}
            <ScrollArea className="flex-1 p-6 md:p-8 bg-white dark:bg-slate-950 font-sans" id="order-print-area">
              <div className="space-y-6 text-slate-800 dark:text-slate-200">
                
                {/* Logo & Identificacion */}
                <div className="flex justify-between items-start border-b pb-6">
                  <div>
                    <h2 className="text-2xl font-black text-indigo-600 tracking-tight">NEXWAY S.A. DE C.V.</h2>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Centro de Distribución Logística</p>
                    <p className="text-xs text-slate-500 mt-1">San Salvador, El Salvador</p>
                    <p className="text-xs text-slate-500">Tel: +503 2200-0000 | info@nexway.com</p>
                  </div>
                  <div className="text-right">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase">
                      {previewType === 'interno' ? 'Requisición Interna' : 'Orden de Compra'}
                    </h3>
                    <p className="text-xs font-mono font-bold text-violet-600 mt-1">{selectedOrderForPreview.code}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">Fecha Emisión: {new Date(selectedOrderForPreview.createdAt).toLocaleDateString()}</p>
                    {previewType === 'externo' && (
                      <div className="text-[9px] text-slate-400 font-bold mt-2 space-y-0.5 text-right select-none">
                        <div>ENVIAR AL CORREO: <span className="text-indigo-600 font-mono">{selectedOrderForPreview.supplierEmail || 'sac.es2@swdeca.com'}</span></div>
                        <div>DESDE EL CORREO: <span className="text-slate-600 font-mono">{selectedOrderForPreview.fromEmail || 'pablopiche1g3@gmail.com'}</span></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Detalles de Ruta / Sujeto */}
                <div className="grid grid-cols-2 gap-6 bg-slate-50 dark:bg-muted/30 p-4 rounded-2xl border">
                  {previewType === 'interno' ? (
                    <>
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Bodega (la que da el material)</span>
                        <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">{selectedOrderForPreview.sourceWarehouse}</p>
                        <p className="text-xs text-slate-500">Distribución local autorizada</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Bodega (que solicita)</span>
                        <p className="text-sm font-bold text-violet-600 mt-0.5">{selectedOrderForPreview.destinationWarehouse}</p>
                        <p className="text-xs text-slate-500">Destino del stock solicitado</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Proveedor Destinatario</span>
                        <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">{selectedOrderForPreview.supplier}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Directorio de Suministrantes Oficiales</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Bodega de Destino / Entrega</span>
                        <p className="text-sm font-bold text-violet-600 mt-0.5">{selectedOrderForPreview.destinationWarehouse}</p>
                        <p className="text-xs text-slate-500">Punto de recepción de mercancía</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Encargado de Gestión</span>
                    <p className="text-xs font-bold text-slate-700 dark:text-foreground mt-0.5">{selectedOrderForPreview.requestedBy}</p>
                    {previewType === 'externo' && selectedOrderForPreview.supplierPhone && (
                      <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Tel: {selectedOrderForPreview.supplierPhone}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Estado Actual</span>
                    <p className="text-xs font-bold mt-0.5 uppercase text-violet-600">{selectedOrderForPreview.status}</p>
                  </div>
                </div>

                {/* Tabla de Productos */}
                <div className="border rounded-2xl overflow-hidden mt-4">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-muted/50">
                      <TableRow>
                        <TableHead className="px-4 text-[9px] font-black uppercase">SKU</TableHead>
                        <TableHead className="text-[9px] font-black uppercase">Descripción del Producto</TableHead>
                        <TableHead className="text-center text-[9px] font-black uppercase">Cantidad</TableHead>
                        {previewType === 'externo' && (
                          <>
                            <TableHead className="text-right text-[9px] font-black uppercase">Precio Unitario</TableHead>
                            <TableHead className="text-center text-[9px] font-black uppercase">No. Cotización</TableHead>
                            <TableHead className="text-right text-[9px] font-black uppercase">Subtotal</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrderForPreview.items?.map((item: any, idx: number) => (
                        <TableRow key={idx} className="border-b last:border-0 hover:bg-transparent">
                          <TableCell className="px-4 py-3 font-mono text-[10px] font-bold text-slate-600">{item.sku}</TableCell>
                          <TableCell className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.name}</TableCell>
                          <TableCell className="text-center text-xs font-black">{item.quantity} un.</TableCell>
                          {previewType === 'externo' && (
                            <>
                              <TableCell className="text-right text-xs font-bold text-slate-500">${(item.cost || 0).toFixed(2)}</TableCell>
                              <TableCell className="text-center text-xs font-semibold text-slate-600 dark:text-slate-350">{item.quoteNumber || '-'}</TableCell>
                              <TableCell className="text-right text-xs font-black text-slate-800 dark:text-foreground">${((item.cost || 0) * item.quantity).toFixed(2)}</TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Total en Orden de Compra */}
                {previewType === 'externo' && (
                  <div className="flex justify-end pt-4">
                    <div className="w-64 bg-slate-50 dark:bg-muted/10 p-4 rounded-2xl border text-right">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Total de Inversión</span>
                      <p className="text-2xl font-black text-emerald-600 mt-1">${selectedOrderForPreview.total?.toFixed(2)}</p>
                      <p className="text-[8px] text-slate-400 mt-1 font-semibold">Sujeto a percepción de IVA del 1% si aplica</p>
                    </div>
                  </div>
                )}

                {/* Terminos y Firmas */}
                {previewType === 'interno' ? (
                  <div className="pt-12 grid grid-cols-2 gap-12 text-center text-xs text-slate-400">
                    <div className="space-y-4">
                      <div className="border-t border-dashed w-48 mx-auto pt-2 font-bold text-[10px] uppercase text-slate-500">Firma Encargado</div>
                      <p className="text-[8px]">Emitido y aprobado digitalmente por {selectedOrderForPreview.requestedBy}</p>
                    </div>
                    <div className="space-y-4">
                      <div className="border-t border-dashed w-48 mx-auto pt-2 font-bold text-[10px] uppercase text-slate-500">Autorización CD</div>
                      <p className="text-[8px]">NexWay Centro de Control y Despacho</p>
                    </div>
                  </div>
                ) : (
                  <div className="pt-12 grid grid-cols-3 gap-6 text-center text-[10px] text-slate-400">
                    <div className="space-y-4">
                      <div className="border-t border-dashed w-full mx-auto pt-2 font-black uppercase text-slate-500 text-[9px]">SOLICITADO POR</div>
                      <p className="font-bold text-slate-700 dark:text-slate-350">BODEGA {selectedOrderForPreview.destinationWarehouse?.toUpperCase()}</p>
                    </div>
                    <div className="space-y-4">
                      <div className="border-t border-dashed w-full mx-auto pt-2 font-black uppercase text-slate-500 text-[9px]">AUTORIZADO POR</div>
                      <p className="font-bold text-slate-700 dark:text-slate-350">{selectedOrderForPreview.authorizedBy || 'JULIO NEFTALI CAÑAS ZELAYA'}</p>
                    </div>
                    <div className="space-y-4">
                      <div className="border-t border-dashed w-full mx-auto pt-2 font-black uppercase text-slate-500 text-[9px]">DIGITADO POR</div>
                      <p className="font-bold text-slate-700 dark:text-slate-350">{selectedOrderForPreview.digitizedBy || 'RENE LANGLOIS 74503973'}</p>
                    </div>
                  </div>
                )}

              </div>
            </ScrollArea>

            {/* Footer Modal */}
            <div className="p-4 bg-slate-50 dark:bg-muted/50 border-t flex justify-end gap-3 select-none">
              <Button 
                variant="outline" 
                onClick={() => setSelectedOrderForPreview(null)}
                className="h-10 text-xs font-bold rounded-xl"
              >
                Cerrar
              </Button>
              {previewType === 'externo' && (
                <>
                  <Button 
                    onClick={() => handleSendEmailClient(selectedOrderForPreview)}
                    className="h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl"
                  >
                    <Mail size={14} className="mr-1.5" /> Enviar por Correo
                  </Button>
                  <Button 
                    onClick={() => handleDownloadExcel(selectedOrderForPreview)}
                    className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl"
                  >
                    <FileSpreadsheet size={14} className="mr-1.5" /> Descargar Excel
                  </Button>
                </>
              )}
              <Button 
                onClick={() => {
                  window.print();
                }}
                className="h-10 bg-violet-600 hover:bg-violet-755 text-white font-bold text-xs rounded-xl"
              >
                <Printer size={14} className="mr-1.5" /> Imprimir Documento
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
