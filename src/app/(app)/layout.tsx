import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { logoutAction } from '@/app/login/actions';
import { listPendingApprovalOrders } from '@/lib/view';
import { SidebarNav } from '@/components/sidebar-nav';
import { Toast } from '@/components/toast';
import { readFlash } from '@/lib/flash';
import { COMPANY_NAME } from '@/lib/constants';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const flash = await readFlash();

  const isAdmin = user.role === 'ADMIN';
  const pendingCount = isAdmin ? listPendingApprovalOrders().length : 0;

  const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/kanban', label: 'Papan Kanban' },
    { href: '/kalender', label: 'Kalender' },
    ...(isAdmin ? [{ href: '/approval', label: 'Persetujuan', badge: pendingCount || undefined }] : []),
    ...(isAdmin ? [{ href: '/orders/new', label: 'Pesanan Baru' }] : []),
    ...(isAdmin ? [{ href: '/invoices', label: 'Invoice & Documents' }] : []),
    ...(isAdmin ? [{ href: '/vendors', label: 'Vendor & Pengguna' }] : []),
    ...(isAdmin ? [{ href: '/arsip', label: 'Arsip' }] : []),
    ...(isAdmin ? [{ href: '/backup', label: 'Backup & Restore' }] : []),
  ];

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      <aside className="flex flex-shrink-0 flex-col gap-4 bg-[oklch(0.22_0.015_255)] p-4 md:w-60 md:gap-6 md:p-6">
        <div className="flex items-center gap-2 md:flex-col md:items-start md:gap-1">
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="oklch(0.6 0.19 15)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3 3 14l3 3L17 6z" />
              <path d="M17 6l3-3 1 1-3 3z" />
              <path d="M6 17l-3 3" />
            </svg>
            <span className="font-heading text-[15px] font-semibold text-white">Pisaupedia Knife Manufacture</span>
          </div>
          <span className="pl-8 text-[11px] text-white/50 md:pl-0">{COMPANY_NAME}</span>
        </div>

        <SidebarNav items={navItems} />

        <div className="mt-auto flex flex-col gap-2 rounded-lg bg-white/10 p-3">
          <div className="text-[11px] uppercase tracking-wide text-white/50">
            {isAdmin ? 'Mode: Internal (Admin)' : 'Mode: Vendor'}
          </div>
          <div className="text-[13px] text-white/90">
            {user.name}
            {!isAdmin && user.vendorNama ? ` — ${user.vendorNama}` : ''}
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="mt-1 w-full rounded-md bg-[var(--brand-red)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-red-dark)]"
            >
              Keluar
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-grow overflow-x-hidden bg-[oklch(0.97_0.005_255)] p-4 md:p-8">{children}</main>
      <Toast flash={flash} />
    </div>
  );
}
