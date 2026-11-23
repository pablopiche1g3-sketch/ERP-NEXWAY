import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeUuid(val: any, fallback: string | null = null): string | null {
  if (!val || typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  return UUID_REGEX.test(trimmed) ? trimmed : fallback;
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function formatDisplayName(email: string, explicitName?: string | null): string {
  if (explicitName && explicitName.trim().length > 0) {
    return explicitName.trim();
  }
  const prefix = (email || '').split('@')[0] || 'Usuario';
  return prefix
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function lookupPreassigned(preassignedRaw: any, email: string): { role?: string; branch_id?: string | null; station_id?: string | null } | null {
  if (!preassignedRaw) return null;
  const cleanEmail = (email || '').toLowerCase();
  if (Array.isArray(preassignedRaw)) {
    return preassignedRaw.find((r: any) => (r?.email || '').toLowerCase() === cleanEmail) || null;
  }
  if (typeof preassignedRaw === 'object') {
    const val = preassignedRaw[cleanEmail] || preassignedRaw[email];
    if (!val) return null;
    return typeof val === 'string' ? { role: val } : val;
  }
  return null;
}

/**
 * GET /api/users/create
 * Reconciles auth.users with public.profiles and system_config (app_users_registry + preassigned_roles),
 * auto-healing any orphaned auth users and returning the complete list of system users.
 */
export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Credenciales administrativas de Supabase no configuradas.' },
        { status: 500 }
      );
    }

    const [authRes, profilesRes, configRes, branchesRes] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ perPage: 500 }),
      supabaseAdmin.from('profiles').select('*'),
      supabaseAdmin
        .from('system_config')
        .select('key, value')
        .in('key', ['app_users_registry', 'preassigned_roles']),
      supabaseAdmin.from('branches').select('id').limit(1),
    ]);

    const defaultBranchUuid = branchesRes.data?.[0]?.id || null;
    const authUsers = authRes.data?.users || [];
    const existingProfiles = profilesRes.data || [];
    const configRows = configRes.data || [];

    const registryRow = configRows.find((r: any) => r.key === 'app_users_registry');
    const preassignedRow = configRows.find((r: any) => r.key === 'preassigned_roles');

    const registryList: any[] = Array.isArray(registryRow?.value) ? registryRow.value : [];
    const preassignedRaw = preassignedRow?.value || {};

    // Reconcile any auth.users missing from public.profiles
    const missingProfilesToInsert: any[] = [];
    for (const au of authUsers) {
      const email = (au.email || '').toLowerCase();
      if (!email) continue;
      const existingById = existingProfiles.find((p: any) => p.id === au.id);
      if (!existingById) {
        const regMatch = registryList.find(
          (r: any) => (r.email || '').toLowerCase() === email
        );
        const preMatch = lookupPreassigned(preassignedRaw, email);
        const inferredRole =
          regMatch?.role ||
          preMatch?.role ||
          au.user_metadata?.role ||
          (email.startsWith('pablo') ? 'admin' : 'vendedor');
        const inferredName = formatDisplayName(
          email,
          regMatch?.full_name || au.user_metadata?.full_name
        );

        const newProfile = {
          id: au.id,
          email,
          role: inferredRole,
          station_id: sanitizeUuid(regMatch?.station_id || preMatch?.station_id, null),
          branch_id: sanitizeUuid(regMatch?.branch_id || preMatch?.branch_id, defaultBranchUuid),
          permissions: {
            full_name: inferredName,
            pin_code: regMatch?.pin_code || '',
            status: regMatch?.status || 'ACTIVO',
            modules: regMatch?.allowed_modules || [],
            tabs: regMatch?.allowed_tabs || [],
          },
        };
        missingProfilesToInsert.push(newProfile);
      }
    }

    if (missingProfilesToInsert.length > 0) {
      await supabaseAdmin.from('profiles').upsert(missingProfilesToInsert, { onConflict: 'id' });
    }

    // Re-fetch or merge all profiles
    const allProfiles = [...existingProfiles, ...missingProfilesToInsert];
    const seenEmails = new Set<string>();
    const unifiedUsers: any[] = [];

    for (const p of allProfiles) {
      const email = (p.email || '').toLowerCase();
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);

      const regMatch = registryList.find(
        (r: any) => (r.email || '').toLowerCase() === email || r.id === p.id
      );
      const preMatch = lookupPreassigned(preassignedRaw, email);
      const perms = p.permissions && typeof p.permissions === 'object' ? p.permissions : {};
      const fullName = formatDisplayName(
        email,
        perms.full_name || regMatch?.full_name || regMatch?.name
      );

      unifiedUsers.push({
        id: p.id,
        email: p.email,
        full_name: fullName,
        name: fullName,
        role: p.role || regMatch?.role || preMatch?.role || 'vendedor',
        station_id: p.station_id ?? perms.station_id ?? regMatch?.station_id ?? null,
        branch_id: p.branch_id ?? perms.branch_id ?? regMatch?.branch_id ?? null,
        pin_code: perms.pin_code ?? regMatch?.pin_code ?? '',
        status: perms.status || regMatch?.status || 'ACTIVO',
        permissions: perms,
        allowed_modules: Array.isArray(perms.modules)
          ? perms.modules
          : Array.isArray(regMatch?.allowed_modules)
          ? regMatch.allowed_modules
          : [],
        allowed_tabs: Array.isArray(perms.tabs)
          ? perms.tabs
          : Array.isArray(regMatch?.allowed_tabs)
          ? regMatch.allowed_tabs
          : [],
        created_at: p.created_at || new Date().toISOString(),
      });
    }

    // Also include any registry users that weren't in profiles yet
    for (const reg of registryList) {
      const email = (reg.email || '').toLowerCase();
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);
      const fullName = formatDisplayName(email, reg.full_name || reg.name);
      unifiedUsers.push({
        id: reg.id || `usr-${email.split('@')[0]}`,
        email,
        full_name: fullName,
        name: fullName,
        role: reg.role || 'vendedor',
        station_id: sanitizeUuid(reg.station_id, null),
        branch_id: sanitizeUuid(reg.branch_id, defaultBranchUuid),
        pin_code: reg.pin_code || '',
        status: reg.status || 'ACTIVO',
        permissions: {
          full_name: fullName,
          pin_code: reg.pin_code || '',
          status: reg.status || 'ACTIVO',
          modules: reg.allowed_modules || [],
          tabs: reg.allowed_tabs || [],
        },
        allowed_modules: reg.allowed_modules || [],
        allowed_tabs: reg.allowed_tabs || [],
        created_at: reg.created_at || new Date().toISOString(),
      });
    }

    // Include any preassigned dictionary entries not yet in unifiedUsers
    if (preassignedRaw && typeof preassignedRaw === 'object' && !Array.isArray(preassignedRaw)) {
      for (const [rawEm, rawVal] of Object.entries(preassignedRaw)) {
        const email = rawEm.toLowerCase();
        if (!email || seenEmails.has(email)) continue;
        seenEmails.add(email);
        const parsed = typeof rawVal === 'string' ? { role: rawVal } : (rawVal as any);
        const fullName = formatDisplayName(email);
        unifiedUsers.push({
          id: `pre-${email.split('@')[0]}`,
          email,
          full_name: fullName,
          name: fullName,
          role: parsed?.role || 'vendedor',
          station_id: sanitizeUuid(parsed?.station_id, null),
          branch_id: sanitizeUuid(parsed?.branch_id, defaultBranchUuid),
          pin_code: '',
          status: 'ACTIVO',
          permissions: { full_name: fullName, status: 'ACTIVO', modules: [], tabs: [] },
          allowed_modules: [],
          allowed_tabs: [],
          created_at: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      users: unifiedUsers,
      reconciledCount: missingProfilesToInsert.length,
    });
  } catch (err: any) {
    console.error('Error en GET /api/users/create:', err);
    return NextResponse.json(
      { error: err.message || 'Error al obtener usuarios.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'El servidor no está configurado con las credenciales de administración requeridas.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      username,
      email: rawEmail,
      full_name,
      password,
      role,
      station_id,
      branch_id,
      pin_code,
      status,
      permissions,
      allowed_modules,
      allowed_tabs,
    } = body;

    const identifier = (rawEmail || username || '').toString().trim();
    if (!identifier || !role) {
      return NextResponse.json(
        { error: 'El usuario/correo y el rol son obligatorios.' },
        { status: 400 }
      );
    }

    // Formatear el identificador como un correo interno de dominio local si no lleva @
    const formattedEmail = identifier.includes('@')
      ? identifier.toLowerCase().trim()
      : `${identifier.toLowerCase().trim().replace(/\s+/g, '.')}@nexway.local`;

    const displayFullName = formatDisplayName(formattedEmail, full_name);

    const { data: branchesData } = await supabaseAdmin.from('branches').select('id').limit(1);
    const defaultBranchUuid = branchesData?.[0]?.id || null;

    // 1. Verificar si el usuario ya existe en Supabase Auth
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 500 });
    const existingAuthUser = (listData?.users || []).find(
      (u) => (u.email || '').toLowerCase() === formattedEmail
    );

    let targetUserId: string;

    if (existingAuthUser) {
      targetUserId = existingAuthUser.id;
      const updatePayload: any = {
        email_confirm: true,
        user_metadata: {
          ...(existingAuthUser.user_metadata || {}),
          full_name: displayFullName,
          role,
        },
      };
      if (password && password.toString().trim().length >= 6) {
        updatePayload.password = password.toString().trim();
      }
      await supabaseAdmin.auth.admin.updateUserById(targetUserId, updatePayload);
    } else {
      const effectivePassword =
        password && password.toString().trim().length >= 6
          ? password.toString().trim()
          : 'Nexway2026!';

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: formattedEmail,
        password: effectivePassword,
        email_confirm: true,
        user_metadata: {
          full_name: displayFullName,
          role,
        },
      });

      if (authError || !authData?.user) {
        return NextResponse.json(
          { error: authError?.message || 'No se pudo crear el usuario en Auth.' },
          { status: 400 }
        );
      }
      targetUserId = authData.user.id;
    }

    // 2. Consultar perfil previo para preservar permisos si ya existía
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .maybeSingle();

    const prevPerms =
      existingProfile?.permissions && typeof existingProfile.permissions === 'object'
        ? existingProfile.permissions
        : {};

    const mergedPermissions = {
      ...prevPerms,
      ...(permissions && typeof permissions === 'object' ? permissions : {}),
      full_name: displayFullName,
      pin_code: pin_code !== undefined ? pin_code : prevPerms.pin_code || '',
      status: status || prevPerms.status || 'ACTIVO',
      modules: Array.isArray(allowed_modules)
        ? allowed_modules
        : Array.isArray(permissions?.modules)
        ? permissions.modules
        : Array.isArray(prevPerms.modules)
        ? prevPerms.modules
        : [],
      tabs: Array.isArray(allowed_tabs)
        ? allowed_tabs
        : Array.isArray(permissions?.tabs)
        ? permissions.tabs
        : Array.isArray(prevPerms.tabs)
        ? prevPerms.tabs
        : [],
    };

    const resolvedStationId =
      station_id !== undefined
        ? (station_id === null || station_id === '' || station_id === '__none' ? null : String(station_id).trim())
        : (existingProfile?.station_id ?? prevPerms.station_id ?? null);

    const resolvedBranchId =
      branch_id !== undefined
        ? (branch_id === null || branch_id === '' || branch_id === '__none' ? null : sanitizeUuid(branch_id, defaultBranchUuid))
        : sanitizeUuid(existingProfile?.branch_id ?? prevPerms.branch_id, defaultBranchUuid);

    const mergedPermissionsWithStation = {
      ...mergedPermissions,
      station_id: resolvedStationId,
      branch_id: resolvedBranchId,
    };

    const profilePayload: any = {
      id: targetUserId,
      email: formattedEmail,
      role,
      station_id: resolvedStationId,
      branch_id: resolvedBranchId,
      permissions: mergedPermissionsWithStation,
    };

    // 3. Upsert en public.profiles (con fallback automático si station_id tiene FK/columna incompatible)
    let { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' });

    if (profileError) {
      const { station_id: _omitStation, ...fallbackPayload } = profilePayload;
      const retryRes = await supabaseAdmin
        .from('profiles')
        .upsert(fallbackPayload, { onConflict: 'id' });
      profileError = retryRes.error;
    }

    if (profileError) {
      return NextResponse.json(
        { error: `Error al guardar el perfil: ${profileError.message}` },
        { status: 400 }
      );
    }

    // 4. Sincronizar también en system_config (app_users_registry) para disponibilidad global inmediata
    try {
      const { data: regConfig } = await supabaseAdmin
        .from('system_config')
        .select('value')
        .eq('key', 'app_users_registry')
        .maybeSingle();

      const currentRegistry: any[] = Array.isArray(regConfig?.value) ? regConfig.value : [];
      const userRecord = {
        id: targetUserId,
        email: formattedEmail,
        full_name: displayFullName,
        name: displayFullName,
        role,
        station_id: profilePayload.station_id,
        branch_id: profilePayload.branch_id,
        pin_code: mergedPermissions.pin_code,
        status: mergedPermissions.status,
        allowed_modules: mergedPermissions.modules,
        allowed_tabs: mergedPermissions.tabs,
        updated_at: new Date().toISOString(),
      };

      const existingIdx = currentRegistry.findIndex(
        (u: any) =>
          (u.email || '').toLowerCase() === formattedEmail || u.id === targetUserId
      );

      let updatedRegistry: any[];
      if (existingIdx >= 0) {
        updatedRegistry = [...currentRegistry];
        updatedRegistry[existingIdx] = { ...updatedRegistry[existingIdx], ...userRecord };
      } else {
        updatedRegistry = [...currentRegistry, userRecord];
      }

      await supabaseAdmin.from('system_config').upsert(
        {
          key: 'app_users_registry',
          value: updatedRegistry,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
    } catch (syncErr) {
      console.warn('Advertencia sincronizando app_users_registry:', syncErr);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: targetUserId,
        email: formattedEmail,
        full_name: displayFullName,
        name: displayFullName,
        role,
        station_id: profilePayload.station_id,
        branch_id: profilePayload.branch_id,
        pin_code: mergedPermissions.pin_code,
        status: mergedPermissions.status,
        permissions: mergedPermissions,
        allowed_modules: mergedPermissions.modules,
        allowed_tabs: mergedPermissions.tabs,
      },
    });
  } catch (err: any) {
    console.error('Error en POST /api/users/create:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
