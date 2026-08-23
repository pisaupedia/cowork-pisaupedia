'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUserByUsername, verifyPassword } from '@/lib/repo/users';
import { createSession, deleteSession } from '@/lib/repo/sessions';
import { SESSION_COOKIE } from '@/lib/session';

export async function loginAction(formData: FormData): Promise<void> {
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  const user = username ? getUserByUsername(username) : undefined;
  if (!user || !verifyPassword(user, password)) {
    redirect('/login?error=1');
  }

  const { token, expiresAt } = createSession(user.id);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });

  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) deleteSession(token);
  store.delete(SESSION_COOKIE);
  redirect('/login');
}
