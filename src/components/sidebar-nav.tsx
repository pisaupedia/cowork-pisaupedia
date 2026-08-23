'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  badge?: number;
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ' +
              (active ? 'bg-[var(--brand-blue-dark)] text-white' : 'text-white/70 hover:bg-white/10')
            }
          >
            <span className="flex-grow">{item.label}</span>
            {item.badge ? (
              <span className="flex-shrink-0 rounded-full bg-[var(--brand-red)] px-2 py-0.5 text-[11px] font-semibold text-white">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
