-- 1. Tabla para el historial de cierres de caja con conteo físico
CREATE TABLE IF NOT EXISTS cierre_turnos_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    opened_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expected_cash NUMERIC(10, 2) NOT NULL,
    reported_cash NUMERIC(10, 2) NOT NULL,
    difference NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('CERRADO', 'DESCUADRE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de auditoría (audit_logs) para registrar eventos inalterables (ej. corrección de pago)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity_id TEXT,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Asegurar que customers tenga la columna benefit_profile
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='benefit_profile') THEN
        ALTER TABLE customers ADD COLUMN benefit_profile TEXT;
    END IF;
END
$$;
