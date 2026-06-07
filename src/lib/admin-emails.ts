const ADMIN_EMAILS = [
  'pablopiche1g3@gmail.com',
  'pinturas.tecnicolorsw@gmail.com',
  'saladventastecnicolor@gmail.com',
] as const;

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.trim().toLowerCase() as any);
}

export const DEFAULT_FROM_EMAIL = 'pablopiche1g3@gmail.com';

export function isRoleChangeable(email: string): boolean {
  return !isAdminEmail(email);
}

export function canRevokeAccess(email: string): boolean {
  return !isAdminEmail(email);
}

export { ADMIN_EMAILS };
