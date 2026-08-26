import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { listVisibleOrders, toOrderCard } from '@/lib/view';
import { formatTanggal, STATUS_COLORS } from '@/lib/derive';
import { OrderCard } from '@/components/order-card';

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default async function KalenderPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; tanggal?: string }>;
}) {
  const user = await requireUser();
  const { bulan, tanggal } = await searchParams;

  const now = new Date();
  const [year, month] = bulan && /^\d{4}-\d{2}$/.test(bulan)
    ? bulan.split('-').map(Number)
    : [now.getFullYear(), now.getMonth() + 1];

  const todayIso = now.toISOString().slice(0, 10);
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = (firstOfMonth.getUTCDay() + 6) % 7; // 0 = Senin
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const orders = listVisibleOrders(user);
  const cards = orders.map((o) => toOrderCard(o, user));
  const cardByDeadline = new Map<string, typeof cards>();
  orders.forEach((o, i) => {
    const list = cardByDeadline.get(o.deadline) ?? [];
    list.push(cards[i]);
    cardByDeadline.set(o.deadline, list);
  });

  const cells: { day: number | null; iso: string | null }[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ day: null, iso: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, iso: `${year}-${pad(month)}-${pad(d)}` });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, iso: null });

  const prevMonth = month === 1 ? `${year - 1}-12` : `${year}-${pad(month - 1)}`;
  const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${pad(month + 1)}`;

  const selectedOrders = tanggal ? cardByDeadline.get(tanggal) ?? [] : null;

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <h1 className="font-heading text-xl font-semibold">Kalender Deadline</h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={`/kalender?bulan=${prevMonth}`}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-black/10 text-base sm:h-auto sm:w-auto sm:px-2 sm:py-1 sm:text-sm"
          >
            &larr;
          </Link>
          <span className="font-heading text-base font-semibold sm:text-lg">
            {MONTHS_ID[month - 1]} {year}
          </span>
          <Link
            href={`/kalender?bulan=${nextMonth}`}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-black/10 text-base sm:h-auto sm:w-auto sm:px-2 sm:py-1 sm:text-sm"
          >
            &rarr;
          </Link>
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-black/60 sm:gap-4 sm:text-xs">
          <Legend color={STATUS_COLORS.aman.dot} label="Aman" />
          <Legend color={STATUS_COLORS.mendekati.dot} label="Mendekati" />
          <Legend color={STATUS_COLORS.terlambat.dot} label="Terlambat" />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-black/50 sm:gap-1.5 sm:text-xs">
        {WEEKDAYS.map((w) => (
          <div key={w} className="truncate">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {cells.map((cell, i) => {
          if (cell.day === null) return <div key={i} />;
          const dayCards = cardByDeadline.get(cell.iso!) ?? [];
          const worst = dayCards.some((c) => c.statusKey === 'terlambat')
            ? 'terlambat'
            : dayCards.some((c) => c.statusKey === 'mendekati')
              ? 'mendekati'
              : 'aman';
          const isToday = cell.iso === todayIso;
          const isSelected = cell.iso === tanggal;
          return (
            <Link
              key={i}
              href={`/kalender?bulan=${year}-${pad(month)}&tanggal=${cell.iso}`}
              className={
                'flex min-h-[52px] flex-col gap-1 rounded-lg border border-black/10 p-1 text-left sm:min-h-[68px] sm:p-1.5 ' +
                (isSelected ? 'bg-[oklch(0.9_0.03_255)]' : isToday ? 'bg-[oklch(0.96_0.02_65)]' : 'bg-white')
              }
            >
              <span className="text-[11px] font-medium text-black/60 sm:text-xs">{cell.day}</span>
              {dayCards.length > 0 ? (
                <span className="flex flex-wrap items-center gap-1 text-[10px] text-black/60">
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full sm:h-1.5 sm:w-1.5"
                    style={{ background: STATUS_COLORS[worst].dot }}
                  />
                  <span className="hidden truncate sm:inline">
                    {dayCards[0].kode}
                    {dayCards.length > 1 ? ` +${dayCards.length - 1}` : ''}
                  </span>
                  <span className="font-semibold sm:hidden">{dayCards.length}</span>
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      {tanggal ? (
        <div className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white p-4">
          <h2 className="font-heading text-sm font-semibold">Deadline pada {formatTanggal(tanggal)}</h2>
          {selectedOrders && selectedOrders.length > 0 ? (
            selectedOrders.map((c) => <OrderCard key={c.id} card={c} from="kalender" />)
          ) : (
            <p className="text-sm text-black/55">Tidak ada deadline pada tanggal ini.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
