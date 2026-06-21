const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ntykiyxrvgfblbxdgwzv.supabase.co';
const supabaseKey = 'sb_publishable_dnse-V7k724QX3yt-QrirQ_77NqkV62';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  console.log('Checking table "productos"...');
  const { data: prodData, error: prodErr } = await supabase.from('productos').select('*').limit(1);
  if (prodErr) {
    console.log('Error querying table "productos":', prodErr.message);
  } else {
    console.log('Table "productos" exists. Data sample:', prodData);
  }

  console.log('\nChecking table "inventory"...');
  const { data: invData, error: invErr } = await supabase.from('inventory').select('*').limit(1);
  if (invErr) {
    console.log('Error querying table "inventory":', invErr.message);
  } else {
    console.log('Table "inventory" exists. Data sample:', invData);
  }

  console.log('\nChecking table "modulos_personalizados"...');
  const { data: modData, error: modErr } = await supabase.from('modulos_personalizados').select('*').limit(1);
  if (modErr) {
    console.log('Error querying table "modulos_personalizados":', modErr.message);
  } else {
    console.log('Table "modulos_personalizados" exists. Data sample:', modData);
  }
}

checkTables();
