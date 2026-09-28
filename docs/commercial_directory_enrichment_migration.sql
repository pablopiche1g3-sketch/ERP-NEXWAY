-- ====================================================================================
-- ENRIQUECIMIENTO DEL DIRECTORIO COMERCIAL (CLIENTES Y PROVEEDORES 360°)
-- ERP NEXWAY - SUPABASE / POSTGRESQL MIGRATION
-- ====================================================================================

-- 1. Ampliación de columnas en public.customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS commercial_name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'San Salvador';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS municipality TEXT DEFAULT 'San Salvador Centro';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS balance NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_days INTEGER DEFAULT 30;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_gran_contribuyente BOOLEAN DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS price_list_id UUID REFERENCES public.price_lists(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_nit ON public.customers(nit);
CREATE INDEX IF NOT EXISTS idx_customers_nrc ON public.customers(nrc);
CREATE INDEX IF NOT EXISTS idx_customers_category ON public.customers(category);

-- 2. Ampliación de columnas en public.suppliers
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS commercial_name TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS bank_account TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS bank_account_type TEXT DEFAULT 'Corriente';
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS credit_days INTEGER DEFAULT 30;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT 'Crédito 30 días';
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS is_gran_contribuyente BOOLEAN DEFAULT false;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Mercadería General';
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_suppliers_nit ON public.suppliers(nit);
CREATE INDEX IF NOT EXISTS idx_suppliers_nrc ON public.suppliers(nrc);
