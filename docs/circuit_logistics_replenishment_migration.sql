-- ====================================================================================
-- CIRCUITO INTEGRADO DE TRASLADOS, DESPACHO DE BODEGA Y REABASTECIMIENTO AUTOMÁTICO
-- ERP NEXWAY - SUPABASE / POSTGRESQL MIGRATION
-- ====================================================================================

-- 1. Tabla de Inventario por Sucursal / Bodega con Puntos de Reorden
CREATE TABLE IF NOT EXISTS public.inventario_sucursal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) NOT NULL,
    producto_nombre VARCHAR(255) NOT NULL,
    sucursal_id VARCHAR(100) NOT NULL,
    warehouse_id VARCHAR(100),
    stock_actual NUMERIC(12, 2) NOT NULL DEFAULT 0,
    stock_reservado NUMERIC(12, 2) NOT NULL DEFAULT 0, -- Mercancía comprometida en picking/traslados
    stock_minimo NUMERIC(12, 2) NOT NULL DEFAULT 5,
    punto_reorden NUMERIC(12, 2) NOT NULL DEFAULT 10,
    stock_maximo NUMERIC(12, 2) NOT NULL DEFAULT 30,
    costo_unitario NUMERIC(12, 4) NOT NULL DEFAULT 0,
    proveedor_habitual_id VARCHAR(100),
    proveedor_habitual_nombre VARCHAR(255),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_sku_sucursal UNIQUE (sku, sucursal_id),
    CONSTRAINT chk_stock_actual_valido CHECK (stock_actual >= 0),
    CONSTRAINT chk_stock_reservado_valido CHECK (stock_reservado >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inv_sucursal_sku ON public.inventario_sucursal(sku);
CREATE INDEX IF NOT EXISTS idx_inv_sucursal_suc ON public.inventario_sucursal(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_inv_sucursal_reorden ON public.inventario_sucursal(stock_actual, punto_reorden);

-- 2. Tabla de Traslados de Circuito
CREATE TABLE IF NOT EXISTS public.traslados_circuito (
    id VARCHAR(100) PRIMARY KEY,
    correlativo VARCHAR(50) UNIQUE NOT NULL,
    origen_id VARCHAR(100) NOT NULL,
    origen_nombre VARCHAR(255) NOT NULL,
    destino_id VARCHAR(100) NOT NULL,
    destino_nombre VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL DEFAULT 'INTERNO', -- 'INTERNO', 'INTERTIENDA'
    estado VARCHAR(50) NOT NULL DEFAULT 'SOLICITADO', -- 'SOLICITADO', 'EN_PICKING', 'DESPACHADO', 'RECIBIDO', 'CANCELADO'
    solicitado_por VARCHAR(255) NOT NULL,
    despachado_por VARCHAR(255),
    recibido_por VARCHAR(255),
    transportista VARCHAR(255),
    vehiculo_placa VARCHAR(50),
    observaciones TEXT,
    total_items NUMERIC(12, 2) DEFAULT 0,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    despachado_at TIMESTAMPTZ,
    recibido_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_traslados_estado ON public.traslados_circuito(estado);
CREATE INDEX IF NOT EXISTS idx_traslados_origen ON public.traslados_circuito(origen_id);
CREATE INDEX IF NOT EXISTS idx_traslados_destino ON public.traslados_circuito(destino_id);

-- 3. Tabla de Solicitudes de Reabastecimiento Automático (Disparadas por Punto de Reorden)
CREATE TABLE IF NOT EXISTS public.solicitudes_reabastecimiento (
    id VARCHAR(100) PRIMARY KEY,
    correlativo VARCHAR(50) UNIQUE NOT NULL,
    proveedor_id VARCHAR(100),
    proveedor_nombre VARCHAR(255) NOT NULL,
    sucursal_id VARCHAR(100) NOT NULL,
    sucursal_nombre VARCHAR(255) NOT NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'SUGERIDA', -- 'SUGERIDA', 'ORDEN_GENERADA', 'COMPLETADA', 'DESCARTADA'
    motivo VARCHAR(255) DEFAULT 'PUNTO_REORDEN_ALCANZADO',
    total_estimado NUMERIC(12, 2) DEFAULT 0,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    orden_compra_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reabast_estado ON public.solicitudes_reabastecimiento(estado);
CREATE INDEX IF NOT EXISTS idx_reabast_proveedor ON public.solicitudes_reabastecimiento(proveedor_id);

-- 4. Función para Despachar Traslado (Descarga Stock Origen y Registra Kardex)
CREATE OR REPLACE FUNCTION public.fn_despachar_traslado_circuito(
    p_traslado_id VARCHAR,
    p_despachador VARCHAR,
    p_transportista VARCHAR,
    p_placa VARCHAR
) RETURNS VOID AS $$
DECLARE
    v_item RECORD;
    v_traslado RECORD;
    v_stock_actual NUMERIC;
    v_nuevo_stock NUMERIC;
BEGIN
    SELECT * INTO v_traslado FROM public.traslados_circuito WHERE id = p_traslado_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Traslado no encontrado: %', p_traslado_id;
    END IF;

    IF v_traslado.estado NOT IN ('SOLICITADO', 'EN_PICKING') THEN
        RAISE EXCEPTION 'El traslado ya no está en estado para despacho (Estado: %)', v_traslado.estado;
    END IF;

    -- Iterar sobre los ítems del traslado
    FOR v_item IN SELECT * FROM jsonb_to_recordset(v_traslado.items) AS (
        sku VARCHAR,
        name VARCHAR,
        quantity NUMERIC,
        cost NUMERIC
    )
    LOOP
        -- Descontar de inventario_stock
        UPDATE public.inventory_stock
        SET quantity = GREATEST(0, quantity - v_item.quantity)
        WHERE sku = v_item.sku AND warehouse_id = v_traslado.origen_id
        RETURNING quantity INTO v_nuevo_stock;

        -- Registrar salida en Kardex
        INSERT INTO public.kardex (
            sku,
            movement_type,
            location,
            document_ref,
            qty_in,
            qty_out,
            balance,
            unit_cost
        ) VALUES (
            v_item.sku,
            'TRASLADO_SALIDA',
            v_traslado.origen_nombre,
            v_traslado.correlativo,
            0,
            v_item.quantity,
            COALESCE(v_nuevo_stock, 0),
            COALESCE(v_item.cost, 0)
        );
    END LOOP;

    -- Actualizar estado del traslado
    UPDATE public.traslados_circuito
    SET estado = 'DESPACHADO',
        despachado_por = p_despachador,
        transportista = p_transportista,
        vehiculo_placa = p_placa,
        despachado_at = NOW(),
        updated_at = NOW()
    WHERE id = p_traslado_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Función para Confirmar Recepción de Traslado (Carga Stock Destino y Registra Kardex)
CREATE OR REPLACE FUNCTION public.fn_recibir_traslado_circuito(
    p_traslado_id VARCHAR,
    p_receptor VARCHAR
) RETURNS VOID AS $$
DECLARE
    v_item RECORD;
    v_traslado RECORD;
    v_nuevo_stock NUMERIC;
BEGIN
    SELECT * INTO v_traslado FROM public.traslados_circuito WHERE id = p_traslado_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Traslado no encontrado: %', p_traslado_id;
    END IF;

    IF v_traslado.estado <> 'DESPACHADO' THEN
        RAISE EXCEPTION 'El traslado no está en estado DESPACHADO (Estado actual: %)', v_traslado.estado;
    END IF;

    -- Iterar sobre los ítems para incrementar en destino
    FOR v_item IN SELECT * FROM jsonb_to_recordset(v_traslado.items) AS (
        sku VARCHAR,
        name VARCHAR,
        quantity NUMERIC,
        cost NUMERIC
    )
    LOOP
        -- Incrementar o crear en inventory_stock de destino
        INSERT INTO public.inventory_stock (sku, warehouse_id, quantity)
        VALUES (v_item.sku, v_traslado.destino_id, v_item.quantity)
        ON CONFLICT (sku, warehouse_id)
        DO UPDATE SET quantity = public.inventory_stock.quantity + v_item.quantity
        RETURNING quantity INTO v_nuevo_stock;

        -- Registrar entrada en Kardex
        INSERT INTO public.kardex (
            sku,
            movement_type,
            location,
            document_ref,
            qty_in,
            qty_out,
            balance,
            unit_cost
        ) VALUES (
            v_item.sku,
            'TRASLADO_ENTRADA',
            v_traslado.destino_nombre,
            v_traslado.correlativo,
            v_item.quantity,
            0,
            COALESCE(v_nuevo_stock, 0),
            COALESCE(v_item.cost, 0)
        );
    END LOOP;

    -- Actualizar estado del traslado
    UPDATE public.traslados_circuito
    SET estado = 'RECIBIDO',
        recibido_por = p_receptor,
        recibido_at = NOW(),
        updated_at = NOW()
    WHERE id = p_traslado_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
