import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar variables de entorno desde .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const firebaseConfig = {
  apiKey: "AIzaSyDAeNes5_5Uu4fzwfG3zTDeBjvu0HJpnFs",
  authDomain: "studio-8389574161-3faaf.firebaseapp.com",
  projectId: "studio-8389574161-3faaf",
  storageBucket: "studio-8389574161-3faaf.firebasestorage.app",
  messagingSenderId: "378069437984",
  appId: "1:378069437984:web:e83180b34b68795edaf645"
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Error: Las credenciales de Supabase no están en .env.local");
  process.exit(1);
}

// Inicializar Firebase
const firebaseApp = initializeApp(firebaseConfig);
const firestore = getFirestore(firebaseApp);

// Inicializar Supabase
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runMigration() {
  console.log("=== INICIANDO MIGRACIÓN DE DATOS DESDE FIREBASE A SUPABASE ===");

  try {
    // 1. MIGRAR BODEGAS (WAREHOUSES)
    console.log("\n1. Migrando Bodegas...");
    const whSnap = await getDocs(collection(firestore, 'warehouses'));
    const warehouseIdMap: Record<string, string> = {}; // Mapear nombre a UUID de Supabase

    for (const docSnap of whSnap.docs) {
      const data = docSnap.data();
      const whName = data.name;
      
      if (!whName) continue;

      // Insertar en Supabase
      const { data: insertedWh, error: whErr } = await supabase
        .from('warehouses')
        .insert({ name: whName })
        .select()
        .single();

      if (whErr) {
        if (whErr.code === '23505') { // Ya existe
          const { data: existingWh } = await supabase
            .from('warehouses')
            .select('id')
            .eq('name', whName)
            .single();
          if (existingWh) {
            warehouseIdMap[whName] = existingWh.id;
            console.log(`- Bodega '${whName}' ya existía en Supabase. Mapeada.`);
          }
        } else {
          console.error(`- Error insertando bodega '${whName}':`, whErr.message);
        }
      } else if (insertedWh) {
        warehouseIdMap[whName] = insertedWh.id;
        console.log(`- Bodega '${whName}' migrada con éxito.`);
      }
    }

    // 2. MIGRAR INVENTARIO MAESTRO Y STOCK POR BODEGA
    console.log("\n2. Migrando Catálogo Maestro e Existencias...");
    const invSnap = await getDocs(collection(firestore, 'inventory'));
    let prodCount = 0;
    let stockCount = 0;

    for (const docSnap of invSnap.docs) {
      const data = docSnap.data();
      const sku = String(data.sku || '').trim().toUpperCase();
      const name = data.name;
      
      if (!sku || !name) continue;

      const category = data.category || 'General';
      const price = parseFloat(data.price) || 0.00;

      // A. Insertar producto maestro
      const { error: prodErr } = await supabase
        .from('inventory')
        .insert({
          sku,
          name,
          category,
          price
        });

      if (prodErr && prodErr.code !== '23505') {
        console.error(`- Error al migrar producto maestro ${sku}:`, prodErr.message);
        continue;
      }

      prodCount++;

      // B. Migrar stock distribuido por bodega
      const bodegasStockObj = data.bodegas || {}; // Ej: { "Bodega Central": 10 }
      for (const [whName, qtyVal] of Object.entries(bodegasStockObj)) {
        const whId = warehouseIdMap[whName];
        if (!whId) {
          console.warn(`- Advertencia: Bodega '${whName}' no encontrada para el stock del producto ${sku}.`);
          continue;
        }

        const quantity = parseFloat(String(qtyVal)) || 0;

        const { error: stockErr } = await supabase
          .from('inventory_stock')
          .insert({
            sku,
            warehouse_id: whId,
            quantity
          });

        if (stockErr && stockErr.code !== '23505') {
          console.error(`  - Error al insertar existencias para ${sku} en '${whName}':`, stockErr.message);
        } else {
          stockCount++;
        }
      }
    }
    console.log(`- Total de productos maestros migrados: ${prodCount}`);
    console.log(`- Total de registros de existencias por bodega migrados: ${stockCount}`);

    // 3. MIGRAR PROVEEDORES
    console.log("\n3. Migrando Proveedores...");
    const supSnap = await getDocs(collection(firestore, 'suppliers'));
    let supCount = 0;
    const supplierIdMap: Record<string, string> = {};

    for (const docSnap of supSnap.docs) {
      const data = docSnap.data();
      const name = data.name;
      if (!name) continue;

      const { data: insertedSup, error: supErr } = await supabase
        .from('suppliers')
        .insert({
          name,
          nit: data.nit || null,
          nrc: data.nrc || null,
          address: data.address || null
        })
        .select()
        .single();

      if (supErr) {
        console.error(`- Error insertando proveedor '${name}':`, supErr.message);
      } else if (insertedSup) {
        supplierIdMap[name] = insertedSup.id;
        supCount++;
      }
    }
    console.log(`- Total de proveedores migrados: ${supCount}`);

    // 4. MIGRAR CLIENTES
    console.log("\n4. Migrando Clientes...");
    const custSnap = await getDocs(collection(firestore, 'customers'));
    let custCount = 0;
    const customerIdMap: Record<string, string> = {};

    for (const docSnap of custSnap.docs) {
      const data = docSnap.data();
      const name = data.name;
      if (!name) continue;

      const { data: insertedCust, error: custErr } = await supabase
        .from('customers')
        .insert({
          name,
          nit: data.nit || null,
          nrc: data.nrc || null,
          address: data.address || null
        })
        .select()
        .single();

      if (custErr) {
        console.error(`- Error insertando cliente '${name}':`, custErr.message);
      } else if (insertedCust) {
        customerIdMap[name] = insertedCust.id;
        custCount++;
      }
    }
    console.log(`- Total de clientes migrados: ${custCount}`);

    // 5. MIGRAR LIBRO DIARIO CONTABLE
    console.log("\n5. Migrando Libro Diario Contable...");
    const journalSnap = await getDocs(collection(firestore, 'journal'));
    let entryCount = 0;

    for (const docSnap of journalSnap.docs) {
      const data = docSnap.data();
      const desc = data.description || 'Partida de Diario';
      const type = data.type || 'Egreso';
      const amount = parseFloat(data.amount) || 0;
      
      const { data: insertedEntry, error: jErr } = await supabase
        .from('journal')
        .insert({
          description: desc,
          type,
          amount,
          created_at: data.timestamp || new Date().toISOString()
        })
        .select()
        .single();

      if (jErr) {
        console.error(`- Error insertando asiento '${desc}':`, jErr.message);
        continue;
      }

      entryCount++;

      // Si es un asiento contable doble, migrar sus líneas de Debe y Haber
      if (type === 'Avanzado' && Array.isArray(data.lines)) {
        for (const line of data.lines) {
          const { error: lineErr } = await supabase
            .from('journal_lines')
            .insert({
              journal_id: insertedEntry.id,
              account_code: line.accountCode || '6101',
              debit: parseFloat(line.debit) || 0,
              credit: parseFloat(line.credit) || 0
            });

          if (lineErr) {
            console.error(`  - Error insertando línea contable para ${line.accountCode}:`, lineErr.message);
          }
        }
      }
    }
    console.log(`- Total de asientos de diario migrados: ${entryCount}`);

    console.log("\n=== MIGRACIÓN FINALIZADA CON ÉXITO ===");
  } catch (error: any) {
    console.error("\nOcurrió un error general durante la migración:", error.message);
  }
}

runMigration();
