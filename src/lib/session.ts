import { cookies } from 'next/headers';
import { getSessionUserId } from '@/lib/repo/sessions';
import { getUserById } from '@/lib/repo/users';
import { getVendorById } from '@/lib/repo/vendors';
import type { SessionUser } from '@/lib/types';

export const SESSION_COOKIE = 'pisau_session';

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const userId = getSessionUserId(token);
  if (!userId) return null;

  const user = getUserById(userId);
  if (!user) return null;

  const vendor = user.vendor_id ? getVendorById(user.vendor_id) : undefined;

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    vendorId: user.vendor_id,
    vendorNama: vendor?.nama ?? null,
  };
}

/** Throws if there is no logged-in user. Use inside Server Actions / Route Handlers. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized: belum login.');
  return user;
}

/** Throws unless the current user is an admin. Use inside Server Actions / Route Handlers. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new Error('Forbidden: khusus admin.');
  return user;
}
