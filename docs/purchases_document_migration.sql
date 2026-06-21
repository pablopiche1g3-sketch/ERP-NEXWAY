-- 1. Añadir columnas de DTE / Documentos a la tabla de compras
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS document_type text,
ADD COLUMN IF NOT EXISTS document_number text;
