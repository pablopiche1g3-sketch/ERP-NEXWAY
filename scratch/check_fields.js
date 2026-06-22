const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ntykiyxrvgfblbxdgwzv.supabase.co';
const supabaseKey = 'sb_publishable_dnse-V7k724QX3yt-QrirQ_77NqkV62';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('modulos_personalizados')
    .insert({
      nombre_modulo: 'test_probing',
      datos: {},
      producto_id: null,
      proveedor_id: null,
      proyecto_id: null,
      empresa_id: 'd3b07384-d113-4ec6-a5d7-ec49673cc000',
      creado_por: 'd3b07384-d113-4ec6-a5d7-ec49673cc000'
    })
    .select('*');

  if (error) {
    console.log('Insert failed:', error.message, error.code);
  } else {
    console.log('Insert succeeded! Columns in table are:', Object.keys(data[0]));
    // Clean up
    await supabase.from('modulos_personalizados').delete().eq('nombre_modulo', 'test_probing');
  }
}

check();
