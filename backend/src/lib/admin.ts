export const PRIMARY_ADMIN_EMAIL = 'xandyramoscrazy@gmail.com';
export const PRIMARY_ADMIN_NAME = 'Xandy Ramos';

export function isPrimaryAdminEmail(email: string) {
  return email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
}
