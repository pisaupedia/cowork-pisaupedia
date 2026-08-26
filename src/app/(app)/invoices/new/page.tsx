import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { nextDocumentNumber } from '@/lib/repo/documents';
import { getOrderById } from '@/lib/repo/orders';
import {
  COMPANY_PROFILE,
  DEFAULT_BANK_INFO,
  DEFAULT_INVOICE_NOTES,
  DEFAULT_QUOTATION_NOTES,
  DEFAULT_QUOTATION_TERMS,
  DEFAULT_SURATJALAN_NOTES,
  DOC_TYPE_LABEL,
} from '@/lib/constants';
import type { DocType } from '@/lib/types';
import { DocumentEditor } from '@/components/invoice/DocumentEditor';
import { SocialFollow } from '@/components/invoice/SocialFollow';
import { createDocumentAction } from './actions';

const TAB_CLASS: Record<DocType, string> = { invoice: '', quotation: 'quo', suratjalan: 'sj' };
const DOC_TITLE_CLASS: Record<DocType, string> = { invoice: 'invoice', quotation: 'quo', suratjalan: 'sj' };

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; orderId?: string }>;
}) {
  const user = await requireUser();
  if (user.role !== 'ADMIN') redirect('/dashboard');

  const { type: rawType, orderId } = await searchParams;
  const type: DocType = rawType === 'quotation' || rawType === 'suratjalan' ? rawType : 'invoice';

  const { nomor } = nextDocumentNumber(type);
  const today = new Date().toISOString().slice(0, 10);

  // Kalau dibuka lewat tombol "Buat Invoice dari Pesanan Ini" di halaman
  // detail pesanan, prefill nama klien & satu baris item dari data pesanan
  // itu — supaya tidak perlu diketik ulang dari nol. Lihat catatan tautan
  // order_id di src/lib/schema.sql/repo/documents.ts.
  const sourceOrder = orderId ? getOrderById(orderId) : undefined;
  const prefillItem = sourceOrder
    ? [{ deskripsi: sourceOrder.jenis, qty: sourceOrder.jumlah, harga: sourceOrder.harga }]
    : undefined;

  return (
    <div className="flex max-w-[1000px] flex-col gap-4">
      <Link href="/invoices" className="flex w-fit items-center gap-1 text-sm font-semibold no-print" style={{ color: 'var(--iv-muted)' }}>
        &larr; Back
      </Link>

      {sourceOrder ? (
        <div className="no-print rounded-md px-3 py-2 text-xs" style={{ background: 'var(--iv-accent-light)', color: 'var(--iv-ink)' }}>
          Prefilled from production order <strong>{sourceOrder.kode}</strong> ({sourceOrder.pelanggan}).
        </div>
      ) : null}

      <div className="iv-tabs no-print">
        {(['invoice', 'suratjalan', 'quotation'] as DocType[]).map((t) => (
          <Link
            key={t}
            href={`/invoices/new?type=${t}${orderId ? `&orderId=${orderId}` : ''}`}
            className={`iv-tab-btn ${t === type ? `active ${TAB_CLASS[t]}` : ''}`}
          >
            {t === 'invoice' ? '🧾' : t === 'suratjalan' ? '🚚' : '📋'} {DOC_TYPE_LABEL[t]}
          </Link>
        ))}
      </div>

      <form action={createDocumentAction} className="iv-sheet flex flex-col gap-3">
        <input type="hidden" name="type" value={type} />
        {sourceOrder ? <input type="hidden" name="orderId" value={sourceOrder.id} /> : null}

        <div className="iv-top-row">
          <div className="iv-brand">
            <div className="iv-logo-box">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={COMPANY_PROFILE.logo} alt={COMPANY_PROFILE.name} />
            </div>
            <div>
              <div className="iv-company-name">{COMPANY_PROFILE.name}</div>
              <div className="iv-company-line">{COMPANY_PROFILE.addressLine1}</div>
              <div className="iv-company-line">{COMPANY_PROFILE.addressLine2}</div>
              <div className="iv-company-line">
                {COMPANY_PROFILE.website} · {COMPANY_PROFILE.phone}
              </div>
            </div>
          </div>

          <div className="iv-meta-block">
            <h2 className={`iv-doc-title ${DOC_TITLE_CLASS[type]}`}>{DOC_TYPE_LABEL[type].toUpperCase()}</h2>
            <div className="iv-meta-field">
              <label>{type === 'invoice' ? 'Invoice No.' : type === 'suratjalan' ? 'Delivery Note No.' : 'Quotation No.'}</label>
              <div className="iv-meta-static">
                {nomor} <span style={{ color: 'var(--iv-muted)', fontWeight: 400 }}>(preview)</span>
              </div>
            </div>
            <div className="iv-meta-field">
              <label>Date</label>
              <input type="date" name="tanggal" defaultValue={today} required />
            </div>
            {type === 'invoice' ? (
              <div className="iv-meta-field">
                <label>Due Date</label>
                <input type="date" name="dueDate" />
              </div>
            ) : null}
          </div>
        </div>

        {type === 'suratjalan' ? (
          <div className="iv-parties">
            <div className="iv-party">
              <h3>Deliver To</h3>
              <div className="iv-field">
                <input name="clientName" placeholder="Recipient / Company Name" />
              </div>
              <div className="iv-field">
                <textarea name="clientAddress" rows={2} placeholder="Delivery address" />
              </div>
              <div className="iv-field">
                <input name="clientContact" placeholder="Recipient phone" />
              </div>
            </div>
            <div className="iv-party right">
              <h3>Driver</h3>
              <div className="iv-field">
                <label>Courier</label>
                <input name="driver" placeholder="Driver / courier name" />
              </div>
            </div>
          </div>
        ) : null}

        <div>
          <DocumentEditor
            type={type}
            billTo={
              <div className="iv-party">
                <h3>{type === 'quotation' ? 'Quote To' : 'Bill To'}</h3>
                <div className="iv-field">
                  <input name="clientName" placeholder="Client / Company Name" defaultValue={sourceOrder?.pelanggan ?? ''} />
                </div>
                <div className="iv-field">
                  <textarea name="clientAddress" rows={2} placeholder="Client address" />
                </div>
                <div className="iv-field">
                  <input name="clientContact" placeholder="Client phone / email" />
                </div>
              </div>
            }
            initialItems={prefillItem}
          />
        </div>

        <div className="iv-footer-fields">
          <div>
            <h3>Notes</h3>
            <textarea
              name="notes"
              placeholder="Additional notes for the client..."
              defaultValue={
                type === 'invoice' ? DEFAULT_INVOICE_NOTES : type === 'quotation' ? DEFAULT_QUOTATION_NOTES : DEFAULT_SURATJALAN_NOTES
              }
            />
          </div>
          {type === 'invoice' ? (
            <div>
              <h3>Payment Information</h3>
              <textarea name="bankInfo" placeholder="Bank name, account number, account holder..." style={{ minHeight: 112 }} defaultValue={DEFAULT_BANK_INFO} />
            </div>
          ) : null}
          {type === 'quotation' ? (
            <div>
              <h3>Terms &amp; Conditions</h3>
              <textarea name="terms" placeholder="Lead time, warranty, payment terms, etc..." style={{ minHeight: 112 }} defaultValue={DEFAULT_QUOTATION_TERMS} />
            </div>
          ) : null}
        </div>

        {type === 'quotation' ? (
          <div className="iv-sig-row no-print-space">
            <div className="iv-sig-box" style={{ flex: '0 1 240px', textAlign: 'left' }}>
              <div className="iv-sig-caption">Issued By</div>
              <div className="iv-sig-space" />
              <div className="iv-sig-line">
                <input name="issuedBy" placeholder="Name" style={{ textAlign: 'left' }} />
              </div>
            </div>
          </div>
        ) : null}

        {type === 'suratjalan' ? (
          <div className="iv-sig-row no-print-space">
            <div className="iv-sig-box">
              <div className="iv-sig-caption">Sender</div>
              <div className="iv-sig-space" />
              <div className="iv-sig-line">
                <input name="senderName" placeholder="Name & signature" />
              </div>
            </div>
            <div className="iv-sig-box">
              <div className="iv-sig-caption">Driver</div>
              <div className="iv-sig-space" />
              <div className="iv-sig-line">
                <input name="driverSign" placeholder="Received by name & signature" />
              </div>
            </div>
            <div className="iv-sig-box">
              <div className="iv-sig-caption">Recipient</div>
              <div className="iv-sig-space" />
              <div className="iv-sig-line">
                <input name="receiverName" placeholder="Name & signature" />
              </div>
            </div>
          </div>
        ) : null}

        <SocialFollow />

        <button type="submit" className="iv-btn primary no-print w-fit">
          💾 Save {DOC_TYPE_LABEL[type]}
        </button>
      </form>
    </div>
  );
}
