-- Migration: Add fields for Document/Spreadsheet space to modulos_personalizados
ALTER TABLE public.modulos_personalizados 
ADD COLUMN IF NOT EXISTS proyecto_id text,
ADD COLUMN IF NOT EXISTS proveedor_id text,
ADD COLUMN IF NOT EXISTS empresa_id uuid,
ADD COLUMN IF NOT EXISTS creado_por uuid,
ADD COLUMN IF NOT EXISTS tipo text;

-- Add comment
COMMENT ON COLUMN public.modulos_personalizados.tipo IS 'Tipo de archivo libre: documento o hoja_calculo';
