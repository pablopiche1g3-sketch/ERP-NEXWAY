import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

async function verifyAdminAuth(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return 'Token de autorización requerido.';
  }

  const token = authHeader.slice(7);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  const supabaseAnon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
  if (error || !user) {
    return 'Token inválido o expirado.';
  }

  const { data: profile } = await supabaseAnon
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'gerencia')) {
    return 'Se requieren permisos de administrador.';
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const authErr = await verifyAdminAuth(request.headers.get('authorization'));
    if (authErr) {
      return NextResponse.json({ error: authErr }, { status: 401 });
    }

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
      return NextResponse.json(
        { error: 'El servidor no está configurado con las credenciales de administración requeridas.' },
        { status: 500 }
      );
    }

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
