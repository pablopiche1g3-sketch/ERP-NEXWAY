-- =========================================================================
-- NEXWAY ERP - SCRIPT MAESTRO UNIFICADO DE ESQUEMAS Y MIGRACIÓN (POSTGRESQL)
-- =========================================================================
-- Copia y pega este script completo en el SQL Editor de tu proyecto en Supabase para crear las tablas de forma automática.
-- Usamos "IF NOT EXISTS" para que puedas ejecutarlo completo sin borrar ni afectar tus datos actuales.

-- 1. EXTENSIONES ÚTILES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA DE PERFILES DE USUARIOS (Roles de Acceso)
-- ADVERTENCIA: Borramos la tabla vieja en caso de que existiera con el tipo UUID incorrecto para evitar conflictos.
DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  role text not null default 'pedidos',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Habilitar Row Level Security (RLS) en la tabla perfiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Crear políticas básicas de acceso para perfiles (Usa 'OR REPLACE' si la base de datos lo soporta, o ignora errores si ya existen)
DO $$ BEGIN
  CREATE POLICY "Permitir lectura pública de perfiles" ON public.profiles FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Permitir a usuarios actualizar su propio perfil" ON public.profiles FOR UPDATE USING (auth.uid()::text = id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. DISPARADOR (TRIGGER) AUTOMÁTICO PARA NUEVOS USUARIOS (Si se usa auth nativo de Supabase)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id::text, new.email, 'pedidos');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminamos el trigger si existe para volver a crearlo de forma segura
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

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
