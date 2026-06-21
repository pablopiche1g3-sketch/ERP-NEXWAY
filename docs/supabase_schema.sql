-- SCRIPT DE ESQUEMA RELACIONAL SQL PARA SUPABASE (POSTGRESQL) - NEXWAY ERP
-- Copia y pega este script completo en el SQL Editor de tu proyecto en Supabase para crear las tablas de forma automática.

-- 1. EXTENSIONES ÚTILES
create extension if not exists "uuid-ossp";

-- 2. TABLA DE PERFILES DE USUARIOS (Roles de Acceso)
-- Se vincula directamente con la tabla interna auth.users de Supabase Auth
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  role text not null default 'pedidos',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Habilitar Row Level Security (RLS) en la tabla perfiles
alter table public.profiles enable row level security;

-- Crear políticas básicas de acceso para perfiles
create policy "Permitir lectura pública de perfiles" on public.profiles
  for select using (true);

create policy "Permitir a usuarios actualizar su propio perfil" on public.profiles
  for update using (auth.uid() = id);

-- 3. DISPARADOR (TRIGGER) AUTOMÁTICO PARA NUEVOS USUARIOS
-- Cuando un usuario se registra mediante Supabase Auth, se crea automáticamente su perfil en public.profiles
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'pedidos');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. TABLA DE BODEGAS (ALMACENES)
create table public.warehouses (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 5. TABLA DE INVENTARIO MAESTRO (Catálogo de Productos)
create table public.inventory (
  sku text primary key, -- El SKU en mayúsculas actúa como identificador único principal
  name text not null,
  category text not null default 'General',
  price numeric(10,2) not null default 0.00,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 6. TABLA DE EXISTENCIAS POR BODEGA (Relación Relacional)
create table public.inventory_stock (
  id uuid default uuid_generate_v4() primary key,
  sku text references public.inventory(sku) on delete cascade not null,
  warehouse_id uuid references public.warehouses(id) on delete cascade not null,
  quantity numeric(10,2) not null default 0.00,
  constraint unique_sku_warehouse unique (sku, warehouse_id)
);

-- 7. TABLA DE PROVEEDORES
create table public.suppliers (
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
create table public.customers (
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
create table public.purchases (
  id uuid default uuid_generate_v4() primary key,
  order_id text not null unique,
  supplier_id uuid references public.suppliers(id) on delete set null,
  entered_by text not null,
  warehouse_id uuid references public.warehouses(id) on delete set null,
  total numeric(10,2) not null default 0.00,
  status text not null default 'PENDIENTE', -- PENDIENTE, CERRADA
  payment_method text,
  credit_days integer,
  payment_status text,
  document_type text,
  document_number text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 10. DETALLES DE COMPRAS (Items)
create table public.purchase_items (
  id uuid default uuid_generate_v4() primary key,
  purchase_id uuid references public.purchases(id) on delete cascade not null,
  sku text references public.inventory(sku) on delete restrict not null,
  quantity numeric(10,2) not null default 0.00,
  cost numeric(10,2) not null default 0.00,
  subtotal numeric(10,2) not null default 0.00
);

-- 11. TABLA DE VENTAS (Facturación / DTE)
create table public.sales (
  id uuid default uuid_generate_v4() primary key,
  correlative text not null unique,
  doc_type text not null default 'CF', -- CF (Factura), CCF (Crédito Fiscal)
  customer_id uuid references public.customers(id) on delete set null,
  total numeric(10,2) not null default 0.00,
  status text not null default 'ACTIVA', -- ACTIVA, CANCELADA
  payment_method text,
  customer_name text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 12. DETALLES DE VENTAS (Items)
create table public.sales_items (
  id uuid default uuid_generate_v4() primary key,
  sale_id uuid references public.sales(id) on delete cascade not null,
  sku text references public.inventory(sku) on delete restrict not null,
  quantity numeric(10,2) not null default 0.00,
  price numeric(10,2) not null default 0.00,
  subtotal numeric(10,2) not null default 0.00
);

-- 13. LIBRO DIARIO CONTABLE (Asientos)
create table public.journal (
  id uuid default uuid_generate_v4() primary key,
  description text not null,
  type text not null default 'Egreso', -- Ingreso, Egreso, Avanzado
  amount numeric(10,2) not null default 0.00,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 14. LÍNEAS DE ASIENTOS DOBLES (Debe y Haber)
create table public.journal_lines (
  id uuid default uuid_generate_v4() primary key,
  journal_id uuid references public.journal(id) on delete cascade not null,
  account_code text not null,
  debit numeric(10,2) not null default 0.00,
  credit numeric(10,2) not null default 0.00
);

-- 15. TABLAS DE MAPEO DE PRODUCTOS (Para DTE Facturación Electrónica y Empresas)
create table public.supplier_mappings (
  supplier_code text primary key,
  internal_sku text not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create table public.company_mappings (
  id uuid default uuid_generate_v4() primary key,
  master_sku text not null,
  product_name text not null,
  company_name text not null,
  company_sku text not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  constraint unique_company_mapping unique (company_name, company_sku)
);

-- 16. TABLAS DE NOTAS DE CRÉDITO Y DÉBITO (AJUSTES) Y ARQUEOS DIARIOS
create table public.credit_notes (
  id uuid default uuid_generate_v4() primary key,
  ref_doc text not null,
  customer_name text not null,
  reason text not null,
  items jsonb not null,
  total numeric(10,2) not null default 0.00,
  status text not null default 'EMITIDA',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create table public.debit_notes (
  id uuid default uuid_generate_v4() primary key,
  ref_doc text not null,
  customer_name text not null,
  reason text not null,
  items jsonb not null,
  total numeric(10,2) not null default 0.00,
  status text not null default 'EMITIDA',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create table public.daily_closings (
  id uuid default uuid_generate_v4() primary key,
  date date not null,
  cash_float numeric(10,2) not null default 0.00,
  system_cash_sales numeric(10,2) not null default 0.00,
  physical_cash_found numeric(10,2) not null default 0.00,
  expenses numeric(10,2) not null default 0.00,
  difference numeric(10,2) not null default 0.00,
  denominations jsonb not null,
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
  closed_by text not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 17. TABLAS DE PEDIDOS INTERNOS Y PEDIDOS A PROVEEDORES (ORDENES EXTERNAS)
create table public.internal_orders (
  id uuid default uuid_generate_v4() primary key,
  code text,
  source_warehouse text not null,
  destination_warehouse text not null,
  requested_by text not null,
  items jsonb not null,
  status text not null default 'PENDIENTE', -- PENDIENTE, APROBADO, CANCELADO
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create table public.supplier_orders (
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
  status text not null default 'PENDIENTE', -- PENDIENTE, APROBADO, RECHAZADO
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 18. CONFIGURACIÓN GENERAL DEL SISTEMA
create table public.system_config (
  key text primary key,
  value jsonb not null
);

-- 19. TABLA DE TRASLADOS (HISTORIAL LOGÍSTICO)
create table public.transfers (
  id uuid default uuid_generate_v4() primary key,
  type text not null, -- INTERNO, INTERTIENDA
  source text not null,
  destination text not null,
  authorized_by text not null,
  items jsonb not null,
  status text not null default 'COMPLETADO',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 20. AREA DE QUEDAN (PAGOS A PROVEEDORES)
create table public.quedan (
  id uuid default uuid_generate_v4() primary key,
  supplier text not null,
  due_date date not null,
  invoices jsonb not null,
  total_amount numeric(10,2) not null default 0.00,
  status text not null default 'PENDIENTE', -- PENDIENTE, PAGADO
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 21. LICITACIONES / INSTITUCIONAL
create table public.institutional_projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  purchase_order text,
  total_budget numeric(10,2) not null default 0.00,
  customer_name text,
  items jsonb not null default '[]'::jsonb,
  status text not null default 'EN CURSO', -- EN CURSO, FINALIZADO
  documents jsonb not null default '[]'::jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create table public.institutional_sales (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.institutional_projects(id) on delete set null,
  doc_number text not null,
  total numeric(10,2) not null default 0.00,
  date date not null default current_date,
  items text,
  cart_items jsonb not null default '[]'::jsonb,
  concept text,
  customer_name text,
  customer_email text,
  status text not null default 'COMPLETADA',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create table public.institutional_purchases (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.institutional_projects(id) on delete set null,
  supplier text,
  doc_number text,
  items jsonb not null default '[]'::jsonb,
  total numeric(10,2) not null default 0.00,
  date date not null default current_date,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 22. HABILITAR TIEMPO REAL (REAL-TIME) PARA TODAS LAS TABLAS CLAVE
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.warehouses;
alter publication supabase_realtime add table public.inventory_stock;
alter publication supabase_realtime add table public.sales;
alter publication supabase_realtime add table public.purchases;
alter publication supabase_realtime add table public.journal;
alter publication supabase_realtime add table public.supplier_mappings;
alter publication supabase_realtime add table public.company_mappings;
alter publication publication_realtime_dummy_to_avoid_error add table public.credit_notes; -- Ajustar si no existía la dummy
alter publication supabase_realtime add table public.credit_notes;
alter publication supabase_realtime add table public.debit_notes;
alter publication supabase_realtime add table public.daily_closings;
alter publication supabase_realtime add table public.internal_orders;
alter publication supabase_realtime add table public.supplier_orders;
alter publication supabase_realtime add table public.system_config;
alter publication supabase_realtime add table public.transfers;
alter publication supabase_realtime add table public.quedan;
alter publication supabase_realtime add table public.institutional_projects;
alter publication supabase_realtime add table public.institutional_sales;
alter publication supabase_realtime add table public.institutional_purchases;

-- 23. TABLAS DE LISTAS DE PRECIOS ESPECIALES PARA CLIENTES
create table public.price_lists (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create table public.price_list_items (
  id uuid default gen_random_uuid() primary key,
  price_list_id uuid references public.price_lists(id) on delete cascade not null,
  sku text not null,
  description text,
  price numeric(10,2) not null default 0.00,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  constraint unique_price_list_sku unique (price_list_id, sku)
);

-- Vincular clientes y ventas a listas de precios
alter table public.customers add column if not exists price_list_id uuid references public.price_lists(id) on delete set null;
alter table public.sales_items add column if not exists price_list_id uuid references public.price_lists(id) on delete set null;

alter publication supabase_realtime add table public.price_lists;
alter publication supabase_realtime add table public.price_list_items;

-- 24. TABLA DE SUCURSALES (BRANCHES) Y TENANCY MULTISUCURSAL
create table public.branches (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Vincular perfiles, ventas y compras a sucursales
alter table public.profiles add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table public.sales add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table public.purchases add column if not exists branch_id uuid references public.branches(id) on delete set null;

alter publication supabase_realtime add table public.branches;
