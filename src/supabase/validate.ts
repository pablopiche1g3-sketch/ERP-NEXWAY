import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar variables de entorno desde .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Error: Las credenciales de Supabase no están en .env.local");
  process.exit(1);
}

// Inicializar Supabase
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TABLES_TO_CHECK = [
  'profiles', 'warehouses', 'inventory', 'inventory_stock', 'suppliers', 'customers',
  'sales', 'sales_items', 'purchases', 'purchase_items', 'journal', 'journal_lines',
  'supplier_mappings', 'company_mappings', 'credit_notes', 'debit_notes',
  'daily_closings', 'internal_orders', 'supplier_orders', 'system_config',
  'transfers', 'quedan', 'institutional_projects', 'institutional_sales',
  'institutional_purchases', 'quotations'
];

async function runValidation() {
  console.log("==========================================");
  console.log("🔍 INICIANDO VALIDACIÓN DE ESQUEMA SUPABASE");
  console.log("==========================================\n");

  let allGood = true;

  for (const table of TABLES_TO_CHECK) {
    // Intentar hacer una consulta simple a cada tabla (seleccionar id, límite 1)
    // Si la tabla no existe o los permisos fallan, devolverá un error.
    const { error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (error) {
      console.log(`❌ ERROR en la tabla '${table}': ${error.message}`);
      allGood = false;
    } else {
      console.log(`✅ OK - Tabla '${table}' detectada y accesible.`);
    }
  }

  console.log("\n==========================================");
  if (allGood) {
    console.log("🎉 ¡VALIDACIÓN EXITOSA! Todas las tablas están en Supabase.");
    console.log("El esquema maestro se corrió correctamente.");
  } else {
    console.log("⚠️ Hubo problemas con algunas tablas. Revisa los mensajes de arriba.");
    console.log("Es posible que no hayas corrido el script 'schema.sql' completo.");
  }
  console.log("==========================================");
}

runValidation();
