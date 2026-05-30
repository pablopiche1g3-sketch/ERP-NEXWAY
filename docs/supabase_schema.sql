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

-- 15. HABILITAR TIEMPO REAL (REAL-TIME) PARA TABLAS CLAVE
-- Esto permite que el ERP escuche cambios reactivos como lo hacía con Firestore
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.warehouses;
alter publication supabase_realtime add table public.inventory_stock;
alter publication supabase_realtime add table public.sales;
alter publication supabase_realtime add table public.purchases;
alter publication supabase_realtime add table public.journal;

-- 16. TABLAS DE MAPEO DE PRODUCTOS (Para DTE Facturación Electrónica y Empresas)
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

alter publication supabase_realtime add table public.supplier_mappings;
alter publication supabase_realtime add table public.company_mappings;
