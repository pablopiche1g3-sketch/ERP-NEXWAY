-- 1. Crear tabla de sucursales
CREATE TABLE IF NOT EXISTS public.branches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Añadir columna branch_id a los perfiles de usuario
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

-- 3. Añadir columna branch_id a las transacciones de ventas y compras
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

-- 4. Habilitar tiempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.branches;
