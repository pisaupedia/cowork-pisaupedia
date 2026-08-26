import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { listDocuments, documentStats } from '@/lib/repo/documents';
import { formatCurrency } from '@/lib/derive';
import { formatDateEn } from './format';
import { DOC_TYPE_LABEL } from '@/lib/constants';
import type { DocType } from '@/lib/types';
import { deleteDocumentAction } from './actions';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';

const TYPE_FILTERS: { key: DocType | 'all'; label: string }[] = [
  { key: 'all', label: 'All Types' },
  { key: 'invoice', label: 'Invoice' },
  { key: 'quotation', label: 'Quotation' },
  { key: 'suratjalan', label: 'Delivery Note' },
];

const TYPE_BADGE_CLASS: Record<DocType, string> = {
  invoice: 'invoice',
  quotation: 'quo',
  suratjalan: 'sj',
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const user = await requireUser();
  if (user.role !== 'ADMIN') redirect('/dashboard');

  const { q, type } = await searchParams;
  const activeType = type === 'invoice' || type === 'quotation' || type === 'suratjalan' ? type : undefined;

  const documents = listDocuments({ type: activeType, search: q?.trim() || undefined });
  const stats = documentStats();

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <div>
        <h1>Pisaupedia Document App</h1>
        <p className="iv-subtitle">
          Invoices, quotations, and delivery notes — separate from production order data. Admin only.
        </p>
      </div>

      <div className="iv-toolbar no-print">
        <Link href="/invoices/new?type=invoice" className="iv-btn primary">
          🧾 New Invoice
        </Link>
        <Link href="/invoices/new?type=suratjalan" className="iv-btn primary sj">
          🚚 New Delivery Note
        </Link>
        <Link href="/invoices/new?type=quotation" className="iv-btn primary quo">
          📋 New Quotation
        </Link>
      </div>

      <div className="iv-db-stats">
        <div className="iv-db-stat">
          <div className="n">{stats.total}</div>
          <div className="l">Total Documents</div>
        </div>
        <div className="iv-db-stat">
          <div className="n">{stats.invoiceCount}</div>
          <div className="l">Invoices</div>
        </div>
        <div className="iv-db-stat">
          <div className="n">{stats.suratJalanCount}</div>
          <div className="l">Delivery Notes</div>
        </div>
        <div className="iv-db-stat">
          <div className="n">{stats.quotationCount}</div>
          <div className="l">Quotations</div>
        </div>
        <div className="iv-db-stat">
          <div className="n">{formatCurrency(stats.totalInvoiceValue, 'IDR')}</div>
          <div className="l">Total Invoice Value</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 no-print">
        <form className="flex flex-wrap items-center gap-2" method="get">
          {activeType ? <input type="hidden" name="type" value={activeType} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search document no. / name..."
            className="iv-search"
          />
          <button type="submit" className="iv-btn">
            Search
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2 no-print">
        {TYPE_FILTERS.map((f) => {
          const href = f.key === 'all' ? '/invoices' : `/invoices?type=${f.key}`;
          const isActive = f.key === 'all' ? !activeType : activeType === f.key;
          return (
            <Link
              key={f.key}
              href={q ? `${href}${href.includes('?') ? '&' : '?'}q=${encodeURIComponent(q)}` : href}
              className={`iv-filter-pill ${isActive ? 'active' : ''}`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="iv-db-table-wrap">
        {documents.length === 0 ? (
          <div className="iv-empty-db">No documents saved yet.</div>
        ) : (
          <div className="iv-table-scroll">
            <table className="iv-db-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Document No.</th>
                  <th>Date</th>
                  <th>Client / Recipient Name</th>
                  <th className="num">Total</th>
                  <th className="no-print">Action</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <span className={`iv-badge ${TYPE_BADGE_CLASS[d.type]}`}>{DOC_TYPE_LABEL[d.type]}</span>
                    </td>
                    <td>{d.nomor}</td>
                    <td>{formatDateEn(d.tanggal)}</td>
                    <td>{d.client_name || '—'}</td>
                    <td className="num">{d.type === 'suratjalan' ? '—' : formatCurrency(d.grand_total, d.currency)}</td>
                    <td className="no-print">
                      <div className="iv-row-actions">
                        <Link href={`/invoices/${d.id}`} className="iv-link">
                          View / Edit
                        </Link>
                        {d.order_id ? (
                          <Link href={`/orders/${d.order_id}`} className="iv-link" title="Linked production order">
                            Source Order
                          </Link>
                        ) : null}
                        <form action={deleteDocumentAction}>
                          <input type="hidden" name="id" value={d.id} />
                          <ConfirmDeleteButton
                            label="Delete"
                            triggerClassName="iv-link danger"
                            title="Confirm Delete"
                            description="Enter the confirmation code to delete this document."
                            confirmLabel="Delete"
                            cancelLabel="Cancel"
                            errorText="Incorrect code. Try again."
                            placeholder="Confirmation code"
                          />
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
