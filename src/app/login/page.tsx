import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { loginAction } from './actions';
import { COMPANY_NAME } from '@/lib/constants';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; restored?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');
  const { error, restored } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center bg-[oklch(0.97_0.005_255)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-1 text-center">
          <div className="flex items-center gap-2">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--brand-red)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3 3 14l3 3L17 6z" />
              <path d="M17 6l3-3 1 1-3 3z" />
              <path d="M6 17l-3 3" />
            </svg>
            <span className="font-heading text-lg font-semibold">Pisaupedia Knife Manufacture</span>
          </div>
          <span className="text-xs text-black/50">{COMPANY_NAME}</span>
        </div>

        {restored ? (
          <p className="mb-4 rounded-lg bg-[var(--status-aman-bg)] px-3 py-2 text-xs text-[var(--status-aman-fg)]">
            Database berhasil dipulihkan dari backup. Sesi login sebelumnya (termasuk punyamu) ikut tereset — silakan
            login lagi.
          </p>
        ) : null}

        <form action={loginAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="username" className="text-xs font-medium text-black/60">
              Username
            </label>
            <input
              id="username"
              name="username"
              required
              autoFocus
              className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-[var(--brand-blue)]"
              placeholder="Username"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-xs font-medium text-black/60">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-[var(--brand-blue)]"
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-[var(--status-terlambat-bg)] px-3 py-2 text-xs text-[var(--status-terlambat-fg)]">
              Username atau password salah.
            </p>
          ) : null}

          <button
            type="submit"
            className="mt-1 rounded-lg bg-[var(--brand-blue)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Masuk
          </button>
        </form>
      </div>
    </main>
  );
}
