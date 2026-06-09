-- 1. Vincular bodegas a sucursales
ALTER TABLE public.warehouses 
ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

-- 2. Vincular diario contable a sucursales
ALTER TABLE public.journal 
ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

-- 3. Tabla para Notas de Crédito de Proveedores
CREATE TABLE IF NOT EXISTS public.supplier_credit_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  document_number text NOT NULL,
  type text NOT NULL, -- 'DEVOLUCION' o 'AJUSTE_PRECIO'
  total numeric(10,2) NOT NULL DEFAULT 0.00,
  items jsonb NOT NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar tiempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_credit_notes;
