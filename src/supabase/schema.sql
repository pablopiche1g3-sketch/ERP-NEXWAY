-- =========================================================================
-- NEXWAY ERP - SCRIPT MAESTRO UNIFICADO DE ESQUEMAS Y MIGRACIÓN (POSTGRESQL)
-- =========================================================================
-- Copia y pega este script completo en el SQL Editor de tu proyecto en Supabase para crear las tablas de forma automática.
-- Usamos "IF NOT EXISTS" para que puedas ejecutarlo completo sin borrar ni afectar tus datos actuales.

-- 1. EXTENSIONES ÚTILES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA DE USUARIOS Y PERMISOS PROPIA DEL ERP (app_users)
CREATE TABLE IF NOT EXISTS public.app_users (
  id text primary key default uuid_generate_v4()::text,
  username text not null unique,
  email text not null unique,
  full_name text not null,
  role text not null default 'cajero',
  pin_code text default '1234',
  password_hash text,
  status text default 'active',
  allowed_modules jsonb default '["billing"]'::jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Permitir lectura pública de app_users" ON public.app_users FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Permitir inserción y actualización de app_users" ON public.app_users FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- TABLA DE PERFILES DE RESPALDO (profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id text primary key,
  email text not null,
  role text not null default 'cajero',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Permitir lectura pública de perfiles" ON public.profiles FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 4. TABLA DE BODEGAS (ALMACENES)
CREATE TABLE IF NOT EXISTS public.warehouses (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 5. TABLA DE INVENTARIO MAESTRO (Catálogo de Productos)
CREATE TABLE IF NOT EXISTS public.inventory (
  sku text primary key,
  name text not null,
  category text not null default 'General',
  price numeric(10,2) not null default 0.00,
  
  -- Campos Avanzados (ERP Legacy)
  brand text,
  product_type text default 'Terminado',
  unit text default 'Unidad',
  location text,
  min_stock numeric(10,2) default 0.00,
  max_stock numeric(10,2) default 0.00,
  reorder_point numeric(10,2) default 0.00,
  cost numeric(10,2) default 0.00,
  
  -- Campos BMS (Agregados en Refactorización)
  margin numeric(10,2) default 0.00,
  default_warehouse_id uuid references public.warehouses(id) on delete set null,
  default_location text,
  
  -- Propiedades (Banderas)
  is_active boolean default true,
  is_service boolean default false,
  is_exempt boolean default false,

  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 6. TABLA DE EXISTENCIAS POR BODEGA
CREATE TABLE IF NOT EXISTS public.inventory_stock (
  id uuid default uuid_generate_v4() primary key,
  sku text references public.inventory(sku) on delete cascade not null,
  warehouse_id uuid references public.warehouses(id) on delete cascade not null,
  quantity numeric(10,2) not null default 0.00,
  constraint unique_sku_warehouse unique (sku, warehouse_id)
);

-- 7. TABLA DE PROVEEDORES
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  nit text,
  nrc text,
  giro text,
  email text,
  phone text,
  address text,
  apply_retention boolean not null default false,
  apply_perception boolean not null default false,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 8. TABLA DE CLIENTES
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  nit text,
  nrc text,
  giro text,
  email text,
  phone text,
  address text,
  type text,
  category text,
  is_authorized_credit boolean not null default false,
  credit_limit numeric(10,2) not null default 0.00,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 9. TABLA DE COMPRAS (Ingresos de Stock)
CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid default uuid_generate_v4() primary key,
  order_id text unique,
  supplier_name text, -- agregado por si order_id no basta
  document_type text,
  document_number text,
  supplier_id uuid references public.suppliers(id) on delete set null,
  entered_by text,
  warehouse_id uuid references public.warehouses(id) on delete set null,
  total numeric(10,2) not null default 0.00,
  status text not null default 'PENDIENTE',
  payment_method text,
  credit_days integer,
  payment_status text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 10. DETALLES DE COMPRAS (Items)
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id uuid default uuid_generate_v4() primary key,
  purchase_id uuid references public.purchases(id) on delete cascade not null,
  sku text references public.inventory(sku) on delete restrict not null,
  quantity numeric(10,2) not null default 0.00,
  cost numeric(10,2) not null default 0.00,
  subtotal numeric(10,2) not null default 0.00
);

-- 11. TABLA DE VENTAS (Facturación / DTE)
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid default uuid_generate_v4() primary key,
  correlative text unique,
  doc_type text not null default 'CF',
  customer_id uuid references public.customers(id) on delete set null,
  total numeric(10,2) not null default 0.00,
  subtotal numeric(10,2) default 0.00,
  iva numeric(10,2) default 0.00,
  status text not null default 'ACTIVA',
  payment_method text,
  customer_name text,
  type text default 'Factura',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 12. DETALLES DE VENTAS (Items)
CREATE TABLE IF NOT EXISTS public.sales_items (
  id uuid default uuid_generate_v4() primary key,
  sale_id uuid references public.sales(id) on delete cascade not null,
  sku text not null,
  quantity numeric(10,2) not null default 0.00,
  price numeric(10,2) not null default 0.00,
  subtotal numeric(10,2) not null default 0.00,
  total numeric(10,2) default 0.00
);

-- 12.5 NUEVO: COTIZACIONES
CREATE TABLE IF NOT EXISTS public.quotations (
    id uuid default uuid_generate_v4() primary key,
    customer_name text not null,
    items jsonb not null default '[]'::jsonb,
    subtotal numeric(10,2) default 0.00,
    iva numeric(10,2) default 0.00,
    total numeric(10,2) default 0.00,
    status text default 'PENDIENTE',
    created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 13. LIBRO DIARIO CONTABLE (Asientos)
CREATE TABLE IF NOT EXISTS public.journal (
  id uuid default uuid_generate_v4() primary key,
  description text not null,
  type text not null default 'Egreso',
  amount numeric(10,2) not null default 0.00,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 14. LÍNEAS DE ASIENTOS DOBLES (Debe y Haber)
CREATE TABLE IF NOT EXISTS public.journal_lines (
  id uuid default uuid_generate_v4() primary key,
  journal_id uuid references public.journal(id) on delete cascade not null,
  account_code text not null,
  debit numeric(10,2) not null default 0.00,
  credit numeric(10,2) not null default 0.00
);

-- 15. TABLAS DE MAPEO DE PRODUCTOS
CREATE TABLE IF NOT EXISTS public.supplier_mappings (
  supplier_code text primary key,
  internal_sku text not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS public.company_mappings (
  id uuid default uuid_generate_v4() primary key,
  master_sku text not null,
  product_name text not null,
  company_name text not null,
  company_sku text not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  constraint unique_company_mapping unique (company_name, company_sku)
);

-- 16. NOTAS DE CRÉDITO Y DÉBITO Y CIERRES
CREATE TABLE IF NOT EXISTS public.credit_notes (
  id uuid default uuid_generate_v4() primary key,
  ref_doc text not null,
  customer_name text not null,
  reason text not null,
  items jsonb not null,
  total numeric(10,2) not null default 0.00,
  status text not null default 'EMITIDA',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS public.debit_notes (
  id uuid default uuid_generate_v4() primary key,
  ref_doc text not null,
  customer_name text not null,
  reason text not null,
  items jsonb not null,
  total numeric(10,2) not null default 0.00,
  status text not null default 'EMITIDA',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS public.daily_closings (
  id uuid default uuid_generate_v4() primary key,
  date date not null unique,
  cash_float numeric(10,2) not null default 0.00,
  system_cash_sales numeric(10,2) not null default 0.00,
  physical_cash_found numeric(10,2) not null default 0.00,
  expenses numeric(10,2) not null default 0.00,
  difference numeric(10,2) not null default 0.00,
  denominations jsonb not null default '{}'::jsonb,
  system_card_sales numeric(10,2) not null default 0.00,
  physical_card_found numeric(10,2) not null default 0.00,
  card_difference numeric(10,2) not null default 0.00,
  system_check_sales numeric(10,2) not null default 0.00,
  physical_check_found numeric(10,2) not null default 0.00,
  check_difference numeric(10,2) not null default 0.00,
  system_transfer_sales numeric(10,2) not null default 0.00,
  physical_transfer_found numeric(10,2) not null default 0.00,
  transfer_difference numeric(10,2) not null default 0.00,
  system_credit_sales numeric(10,2) not null default 0.00,
  physical_credit_found numeric(10,2) not null default 0.00,
  credit_difference numeric(10,2) not null default 0.00,
  closed_by text,
  total_sales numeric(10,2) default 0.00,
  total_cash numeric(10,2) default 0.00,
  total_transfers numeric(10,2) default 0.00,
  status text not null default 'ABIERTO',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 17. TABLAS DE PEDIDOS INTERNOS
CREATE TABLE IF NOT EXISTS public.internal_orders (
  id uuid default uuid_generate_v4() primary key,
  code text,
  source_warehouse text not null,
  destination_warehouse text not null,
  requested_by text not null,
  items jsonb not null,
  status text not null default 'PENDIENTE',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS public.supplier_orders (
  id uuid default uuid_generate_v4() primary key,
  code text,
  supplier_name text not null,
  destination_warehouse text not null,
  requested_by text not null,
  items jsonb not null,
  total numeric(10,2) default 0.00,
  supplier_email text,
  from_email text,
  authorized_by text,
  digitized_by text,
  supplier_phone text,
  status text not null default 'PENDIENTE',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 18. CONFIGURACIÓN GENERAL DEL SISTEMA
CREATE TABLE IF NOT EXISTS public.system_config (
  id uuid default uuid_generate_v4() unique,
  key text primary key,
  value jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 19. TABLA DE TRASLADOS
CREATE TABLE IF NOT EXISTS public.transfers (
  id uuid default uuid_generate_v4() primary key,
  type text not null,
  source text not null,
  destination text not null,
  authorized_by text not null,
  items jsonb not null,
  status text not null default 'COMPLETADO',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 20. AREA DE QUEDAN (PAGOS A PROVEEDORES)
CREATE TABLE IF NOT EXISTS public.quedan (
  id uuid default uuid_generate_v4() primary key,
  supplier text not null,
  due_date date not null,
  invoices jsonb not null,
  total_amount numeric(10,2) not null default 0.00,
  status text not null default 'PENDIENTE',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 21. LICITACIONES / INSTITUCIONAL
CREATE TABLE IF NOT EXISTS public.institutional_projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  purchase_order text,
  total_budget numeric(10,2) not null default 0.00,
  customer_name text,
  customer_id uuid references public.customers(id) on delete set null,
  items jsonb not null default '[]'::jsonb,
  status text not null default 'EN CURSO',
  budget numeric(15,2) default 0.00,
  documents jsonb not null default '[]'::jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS public.institutional_sales (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.institutional_projects(id) on delete cascade,
  doc_number text,
  total numeric(10,2) not null default 0.00,
  amount numeric(15,2) default 0.00,
  date date default current_date,
  items text,
  cart_items jsonb default '[]'::jsonb,
  concept text,
  description text,
  customer_name text,
  customer_email text,
  status text not null default 'COMPLETADA',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS public.institutional_purchases (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.institutional_projects(id) on delete cascade,
  supplier text,
  doc_number text,
  items jsonb default '[]'::jsonb,
  total numeric(10,2) not null default 0.00,
  amount numeric(15,2) default 0.00,
  description text,
  date date default current_date,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 22. REAL-TIME PARA TODAS LAS TABLAS CLAVE
-- Agregamos las publicaciones con cuidado por si ya existen
DO $$ 
DECLARE
  t text;
  tables_to_publish text[] := ARRAY[
    'profiles', 'warehouses', 'inventory_stock', 'sales', 'purchases', 
    'journal', 'supplier_mappings', 'company_mappings', 'credit_notes', 
    'debit_notes', 'daily_closings', 'internal_orders', 'supplier_orders', 
    'system_config', 'transfers', 'quedan', 'institutional_projects', 
    'institutional_sales', 'institutional_purchases', 'quotations'
  ];
BEGIN
  -- Intenta habilitar supabase_realtime
  FOREACH t IN ARRAY tables_to_publish
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
    EXCEPTION WHEN undefined_object OR duplicate_object THEN
      -- Ignorar si la tabla ya está en realtime o la publicación no existe
      NULL;
    END;
  END LOOP;
END $$;

-- 23. SUCURSALES (BRANCHES)
CREATE TABLE IF NOT EXISTS public.branches (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  address text,
  phone text,
  status text default 'ACTIVA',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 24. CAJAS (CASH REGISTERS)
CREATE TABLE IF NOT EXISTS public.cash_registers (
  id uuid default uuid_generate_v4() primary key,
  branch_id uuid references public.branches(id) on delete cascade,
  name text not null,
  default_warehouse_id uuid references public.warehouses(id),
  status text default 'ACTIVA',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Habilitar realtime para las nuevas tablas
DO $$ 
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.branches;';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ 
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_registers;';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 25. CENTROS DE COSTO
CREATE TABLE IF NOT EXISTS public.cost_centers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  branch_id uuid references public.branches(id) on delete cascade,
  status text default 'ACTIVO',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 26. NÓMINA Y RECURSOS HUMANOS
CREATE TABLE IF NOT EXISTS public.payroll_records (
  id uuid default uuid_generate_v4() primary key,
  profile_id text references public.profiles(id) on delete cascade,
  base_salary numeric(10,2) not null default 0.00,
  isss_deduction numeric(10,2) default 0.00,
  afp_deduction numeric(10,2) default 0.00,
  renta_deduction numeric(10,2) default 0.00,
  period text not null, -- ej. "2026-08 Q1"
  net_paid numeric(10,2) default 0.00,
  status text default 'BORRADOR',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS public.employee_loans (
  id uuid default uuid_generate_v4() primary key,
  profile_id text references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null default 0.00,
  balance numeric(10,2) not null default 0.00,
  installment_amount numeric(10,2) not null default 0.00,
  reason text,
  status text default 'ACTIVO', -- ACTIVO, PAGADO
  created_at timestamptz default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS public.employee_bonuses (
  id uuid default uuid_generate_v4() primary key,
  profile_id text references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null default 0.00,
  reason text,
  month text, -- ej. "2026-08"
  status text default 'PENDIENTE', -- PENDIENTE, PAGADO
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- ALTER TABLES PARA SOPORTE DE NUEVOS MÓDULOS
DO $$ BEGIN
  ALTER TABLE public.inventory ADD COLUMN cost_center_id uuid references public.cost_centers(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE public.journal ADD COLUMN branch_id uuid references public.branches(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE public.journal ADD COLUMN cost_center_id uuid references public.cost_centers(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE public.journal ADD COLUMN project_id uuid references public.institutional_projects(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE public.journal_lines ADD COLUMN branch_id uuid references public.branches(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE public.journal_lines ADD COLUMN cost_center_id uuid references public.cost_centers(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE public.sales ADD COLUMN seller_id text references public.profiles(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE public.institutional_sales ADD COLUMN seller_id text references public.profiles(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

-- 27. VISTA DE CRM (CLIENTES INACTIVOS)
CREATE OR REPLACE VIEW public.vw_inactive_customers AS
SELECT 
  c.id,
  c.name,
  c.email,
  c.phone,
  c.category,
  MAX(s.created_at) as last_purchase_date,
  EXTRACT(DAY FROM (now() - MAX(s.created_at))) as days_inactive
FROM public.customers c
LEFT JOIN public.sales s ON c.id = s.customer_id
GROUP BY c.id, c.name, c.email, c.phone, c.category;

-- Habilitar realtime para las nuevas tablas de Nómina y RH
DO $$ BEGIN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.cost_centers;'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.payroll_records;'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_loans;'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_bonuses;'; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 28. TABLAS DE ABONOS Y SEGUIMIENTO CXC / CXP
CREATE TABLE IF NOT EXISTS public.cxc_payments (
  id uuid default uuid_generate_v4() primary key,
  sale_id uuid references public.sales(id) on delete cascade not null,
  amount numeric(10,2) not null default 0.00,
  payment_method text default 'Efectivo',
  reference text,
  notes text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS public.cxp_payments (
  id uuid default uuid_generate_v4() primary key,
  purchase_id uuid references public.purchases(id) on delete cascade not null,
  amount numeric(10,2) not null default 0.00,
  payment_method text default 'Transferencia',
  reference text,
  notes text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 29. DISEÑADOR DE IMPRESIÓN MODULAR (HTML/CSS TO PDF)
CREATE TABLE IF NOT EXISTS public.plantillas_impresion (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null,
  modulo_origen text not null default 'POS', -- 'POS', 'Cotización', 'Proyecto', 'Quedan'
  html_template text not null default '',
  json_scheme jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

ALTER TABLE public.plantillas_impresion ADD COLUMN IF NOT EXISTS json_scheme jsonb;

DO $$ BEGIN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.plantillas_impresion;'; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 30. AGENDA INTELIGENTE DE TAREAS Y RECOMENDACIONES IA
CREATE TABLE IF NOT EXISTS public.agenda_tasks (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  category text default 'manual', -- 'manual', 'ai_suggested'
  status text default 'pending', -- 'pending', 'completed'
  due_date date default current_date,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

DO $$ BEGIN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.agenda_tasks;'; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 31. CUENTAS BANCARIAS Y TRANSACCIONES DE CONCILIACIÓN
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid default uuid_generate_v4() primary key,
  bank_name text not null,
  account_number text not null,
  account_type text default 'Corriente', -- 'Corriente', 'Ahorro', 'Caja Chica'
  balance numeric(12,2) not null default 0.00,
  currency text default 'USD',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id uuid default uuid_generate_v4() primary key,
  bank_account_id uuid references public.bank_accounts(id) on delete cascade not null,
  type text not null, -- 'INGRESO', 'EGRESO'
  amount numeric(12,2) not null default 0.00,
  reference text,
  description text,
  date date default current_date,
  status text default 'CONCILIADO', -- 'CONCILIADO', 'PENDIENTE'
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 32. CREDIT SCORING Y EVALUACIÓN DE RIESGO
CREATE TABLE IF NOT EXISTS public.client_credit_scorings (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid,
  score numeric(5,2) default 90.00,
  risk_level text default 'BAJO', -- 'BAJO', 'MEDIO', 'ALTO'
  avg_pay_days integer default 15,
  recommended_limit numeric(10,2) default 5000.00,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 33. ANTICIPOS Y DEPÓSITOS A FAVOR DE CLIENTES
CREATE TABLE IF NOT EXISTS public.customer_advances (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid,
  amount numeric(10,2) not null default 0.00,
  used_amount numeric(10,2) not null default 0.00,
  notes text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

DO $$ BEGIN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_accounts;'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_transactions;'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_advances;'; EXCEPTION WHEN OTHERS THEN NULL; END $$;




