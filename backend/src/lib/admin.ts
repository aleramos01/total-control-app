export const PRIMARY_ADMIN_EMAIL = 'xandyramoscrazy@gmail.com';

export function isPrimaryAdminEmail(email: string) {
  return email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
}
