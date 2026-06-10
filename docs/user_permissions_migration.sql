-- Añadir columna de permisos individuales a la tabla de perfiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT NULL;
