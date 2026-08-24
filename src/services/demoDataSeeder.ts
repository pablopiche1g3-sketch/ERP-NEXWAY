// Service to seed local demo dataset when cloud database is offline or unpopulated

export const DEMO_WAREHOUSES = [
  { id: 'wh-001', name: 'Bodega Central San Salvador', created_at: new Date().toISOString() },
  { id: 'wh-002', name: 'Bodega Sucursal Santa Ana', created_at: new Date().toISOString() },
  { id: 'wh-003', name: 'Bodega Sucursal San Miguel', created_at: new Date().toISOString() }
];

export const DEMO_INVENTORY = [
  {
    id: 'PROD-001',
    sku: 'PROD-001',
    name: 'Resma Papel Bond Carta 75g (500 Hojas)',
    category: 'Papelería & Oficina',
    price: 4.50,
    quantity: 450,
    bodegas: { 'Bodega Central San Salvador': 300, 'Bodega Sucursal Santa Ana': 150 },
    createdAt: new Date().toISOString()
  },
  {
    id: 'PROD-002',
    sku: 'PROD-002',
    name: 'Laptop Executive Pro 15.6" i7 16GB 512GB SSD',
    category: 'Tecnología',
    price: 850.00,
    quantity: 25,
    bodegas: { 'Bodega Central San Salvador': 15, 'Bodega Sucursal San Miguel': 10 },
    createdAt: new Date().toISOString()
  },
  {
    id: 'PROD-003',
    sku: 'PROD-003',
    name: 'Silla Ergonómica Ejecutiva Malla Negra',
    category: 'Mobiliario de Oficina',
    price: 125.00,
    quantity: 40,
    bodegas: { 'Bodega Central San Salvador': 25, 'Bodega Sucursal Santa Ana': 15 },
    createdAt: new Date().toISOString()
  },
  {
    id: 'PROD-004',
    sku: 'PROD-004',
    name: 'Impresora Multifuncional Dúplex Láser Wifi',
    category: 'Tecnología',
    price: 295.00,
    quantity: 18,
    bodegas: { 'Bodega Central San Salvador': 12, 'Bodega Sucursal San Miguel': 6 },
    createdAt: new Date().toISOString()
  },
  {
    id: 'PROD-005',
    sku: 'PROD-005',
    name: 'Caja de Lapiceros Gel Negro 0.7mm (12 Unid)',
    category: 'Papelería & Oficina',
    price: 7.25,
    quantity: 300,
    bodegas: { 'Bodega Central San Salvador': 200, 'Bodega Sucursal Santa Ana': 100 },
    createdAt: new Date().toISOString()
  },
  {
    id: 'PROD-006',
    sku: 'PROD-006',
    name: 'Archivador Metálico 4 Gavetas Gris',
    category: 'Mobiliario de Oficina',
    price: 180.00,
    quantity: 15,
    bodegas: { 'Bodega Central San Salvador': 10, 'Bodega Sucursal San Miguel': 5 },
    createdAt: new Date().toISOString()
  }
];

export const DEMO_CUSTOMERS = [
  {
    id: 'cust-001',
    name: 'Distribuidora Cuscatlán S.A. de C.V.',
    nit: '0614-150890-101-2',
    nrc: '194820-4',
    giro: 'Venta de Artículos de Oficina',
    email: 'compras@cuscatlan.sv',
    phone: '2255-8800',
    address: 'Alameda Roosevelt #2410, San Salvador',
    type: 'Gran Contribuyente',
    category: 'Corporativo',
    is_authorized_credit: true,
    credit_limit: 5000.00
  },
  {
    id: 'cust-002',
    name: 'Comercial El Ángel S.A. de C.V.',
    nit: '0614-200185-102-1',
    nrc: '84920-1',
    giro: 'Servicios de Consultoría',
    email: 'contacto@elangel.sv',
    phone: '2510-4433',
    address: 'Paseo General Escalón #3820, San Salvador',
    type: 'Mediano Contribuyente',
    category: 'Frecuente',
    is_authorized_credit: true,
    credit_limit: 2500.00
  },
  {
    id: 'cust-003',
    name: 'Cliente Final Contado',
    nit: '0614-010190-000-0',
    nrc: '',
    giro: 'Particular',
    email: 'cliente@nexway.sv',
    phone: '7000-0000',
    address: 'San Salvador',
    type: 'Consumidor Final',
    category: 'General',
    is_authorized_credit: false,
    credit_limit: 0.00
  }
];

export const DEMO_SUPPLIERS = [
  {
    id: 'supp-001',
    name: 'Importadora Papelera San Salvador S.A.',
    nit: '0614-010170-001-9',
    nrc: '10293-8',
    giro: 'Importación y Distribución de Papel',
    email: 'ventas@papelera.sv',
    phone: '2233-1100',
    address: 'Zona Industrial Merliot, Antiguo Cuscatlán',
    apply_retention: true,
    apply_perception: false
  },
  {
    id: 'supp-002',
    name: 'Tecnología Global El Salvador S.A.',
    nit: '0614-101088-103-5',
    nrc: '58392-0',
    giro: 'Distribuidor Mayorista de Cómputo',
    email: 'pedidos@tecglobal.sv',
    phone: '2288-9900',
    address: 'Boulevard de los Héroes #120, San Salvador',
    apply_retention: false,
    apply_perception: false
  }
];

export const DEMO_USERS = [
  {
    id: 'usr-001',
    username: 'pablopiche1g3',
    email: 'admin@nexway.sv',
    full_name: 'Pablo Piche (Administrador)',
    role: 'administrador',
    pin_code: '9999',
    status: 'active',
    allowed_modules: ['billing', 'compras', 'finanzas', 'logistica', 'accounting', 'management', 'crm'],
    created_at: new Date().toISOString()
  },
  {
    id: 'usr-003',
    username: 'conta1',
    email: 'conta@nexway.sv',
    full_name: 'Elena Rivas (Contadora)',
    role: 'contador',
    pin_code: '5555',
    status: 'active',
    allowed_modules: ['accounting', 'finanzas'],
    created_at: new Date().toISOString()
  }
];

export function seedDemoDataIfEmpty() {
  if (typeof window === 'undefined') return;

  // 1. Bodegas
  if (!localStorage.getItem('nexway_warehouses')) {
    localStorage.setItem('nexway_warehouses', JSON.stringify(DEMO_WAREHOUSES));
  }

  // 2. Inventario
  if (!localStorage.getItem('nexway_inventory')) {
    localStorage.setItem('nexway_inventory', JSON.stringify(DEMO_INVENTORY));
  }

  // 3. Clientes
  if (!localStorage.getItem('nexway_customers')) {
    localStorage.setItem('nexway_customers', JSON.stringify(DEMO_CUSTOMERS));
  }

  // 4. Proveedores
  if (!localStorage.getItem('nexway_suppliers')) {
    localStorage.setItem('nexway_suppliers', JSON.stringify(DEMO_SUPPLIERS));
  }

  // 5. Usuarios
  if (!localStorage.getItem('nexway_app_users')) {
    localStorage.setItem('nexway_app_users', JSON.stringify(DEMO_USERS));
  }
}

export function forceSeedDemoData() {
  if (typeof window === 'undefined') return;
  localStorage.setItem('nexway_warehouses', JSON.stringify(DEMO_WAREHOUSES));
  localStorage.setItem('nexway_inventory', JSON.stringify(DEMO_INVENTORY));
  localStorage.setItem('nexway_customers', JSON.stringify(DEMO_CUSTOMERS));
  localStorage.setItem('nexway_suppliers', JSON.stringify(DEMO_SUPPLIERS));
  localStorage.setItem('nexway_app_users', JSON.stringify(DEMO_USERS));
}
