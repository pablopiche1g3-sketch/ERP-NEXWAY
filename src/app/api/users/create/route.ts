import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { username, password, role, station_id } = await request.json();

    if (!username || !password || !role) {
      return NextResponse.json(
        { error: 'El nombre de usuario, la contraseña y el rol son obligatorios.' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Error: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados en el servidor.');
      return NextResponse.json(
        { error: 'El servidor no está configurado con las credenciales de administración requeridas.' },
        { status: 500 }
      );
    }

    // Crear cliente de administración de Supabase
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Formatear el username como un correo interno de dominio local
    const formattedEmail = username.includes('@') 
      ? username.toLowerCase().trim() 
      : `${username.toLowerCase().trim()}@nexway.local`;

    // 1. Crear el usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: formattedEmail,
      password: password,
      email_confirm: true // Confirmar correo automáticamente
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const newUser = authData.user;

    if (!newUser) {
      return NextResponse.json({ error: 'No se pudo crear el usuario.' }, { status: 500 });
    }

    // 2. Crear de inmediato el perfil en public.profiles con RLS bypassed/service_role
    // Usamos el id retornado de Auth
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUser.id,
        email: formattedEmail,
        role: role,
        station_id: station_id || null
      });

    if (profileError) {
      // Intentar limpiar el usuario creado en Auth si falla la creación del perfil
      await supabaseAdmin.auth.admin.deleteUser(newUser.id);
      return NextResponse.json({ error: `Error al crear el perfil: ${profileError.message}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: formattedEmail,
        role: role
      }
    });

  } catch (err: any) {
    console.error('Error en API /api/users/create:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
