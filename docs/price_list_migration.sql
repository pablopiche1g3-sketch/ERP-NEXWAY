-- 1. Crear tabla de listas de precios
CREATE TABLE IF NOT EXISTS public.price_lists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Crear tabla de items de lista de precios
CREATE TABLE IF NOT EXISTS public.price_list_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  price_list_id uuid REFERENCES public.price_lists(id) ON DELETE CASCADE NOT NULL,
  sku text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0.00,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_price_list_sku UNIQUE (price_list_id, sku)
);

-- 3. Vincular clientes a una lista de precios
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS price_list_id uuid REFERENCES public.price_lists(id) ON DELETE SET NULL;

-- 4. Registrar qué lista de precios se usó para cada ítem vendido
ALTER TABLE public.sales_items
ADD COLUMN IF NOT EXISTS price_list_id uuid REFERENCES public.price_lists(id) ON DELETE SET NULL;

-- 5. Habilitar tiempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.price_lists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.price_list_items;
