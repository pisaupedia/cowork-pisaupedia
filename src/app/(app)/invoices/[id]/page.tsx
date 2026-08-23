import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { getDocumentById, listDocumentItems } from '@/lib/repo/documents';
import { COMPANY_PROFILE, DOC_TYPE_LABEL } from '@/lib/constants';
import { DocumentEditor } from '@/components/invoice/DocumentEditor';
import { PrintButton } from '@/components/invoice/PrintButton';
import { SocialFollow } from '@/components/invoice/SocialFollow';
import type { DocType } from '@/lib/types';
import { updateDocumentAction } from './actions';
import { deleteDocumentAction } from '../actions';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';

const DOC_TITLE_CLASS: Record<DocType, string> = { invoice: 'invoice', quotation: 'quo', suratjalan: 'sj' };

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user.role !== 'ADMIN') redirect('/dashboard');

  const { id } = await params;
  const doc = getDocumentById(id);
  if (!doc) notFound();

  const items = listDocumentItems(id);
  const type = doc.type;

  return (
    <div className="flex max-w-[1000px] flex-col gap-4">
      <div className="flex items-center justify-between no-print">
        <Link href="/invoices" className="flex w-fit items-center gap-1 text-sm font-semibold" style={{ color: 'var(--iv-muted)' }}>
          &larr; Back
        </Link>
        <div className="flex items-center gap-2">
          <PrintButton />
          <form action={deleteDocumentAction}>
            <input type="hidden" name="id" value={doc.id} />
            <ConfirmDeleteButton
              label="Delete"
              triggerClassName="iv-btn danger-outline"
              title="Confirm Delete"
              description="Enter the confirmation code to delete this document."
              confirmLabel="Delete"
              cancelLabel="Cancel"
              errorText="Incorrect code. Try again."
              placeholder="Confirmation code"
            />
          </form>
        </div>
      </div>

      <form action={updateDocumentAction} className="iv-sheet flex flex-col gap-3">
        <input type="hidden" name="id" value={doc.id} />

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
              <div className="iv-meta-static">{doc.nomor}</div>
            </div>
            <div className="iv-meta-field">
              <label>Date</label>
              <input type="date" name="tanggal" defaultValue={doc.tanggal.slice(0, 10)} required />
            </div>
            {type === 'invoice' ? (
              <div className="iv-meta-field">
                <label>Due Date</label>
                <input type="date" name="dueDate" defaultValue={doc.due_date?.slice(0, 10)} />
              </div>
            ) : null}
          </div>
        </div>

        {type === 'suratjalan' ? (
          <div className="iv-parties">
            <div className="iv-party">
              <h3>Deliver To</h3>
              <div className="iv-field">
                <input name="clientName" placeholder="Recipient / Company Name" defaultValue={doc.client_name ?? ''} />
              </div>
              <div className="iv-field">
                <textarea name="clientAddress" rows={2} placeholder="Delivery address" defaultValue={doc.client_address ?? ''} />
              </div>
              <div className="iv-field">
                <input name="clientContact" placeholder="Recipient phone" defaultValue={doc.client_contact ?? ''} />
              </div>
            </div>
            <div className="iv-party right">
              <h3>Driver</h3>
              <div className="iv-field">
                <label>Courier</label>
                <input name="driver" placeholder="Driver / courier name" defaultValue={doc.driver ?? ''} />
              </div>
            </div>
          </div>
        ) : (
          <div className="iv-parties">
            <div className="iv-party">
              <h3>{type === 'quotation' ? 'Quote To' : 'Bill To'}</h3>
              <div className="iv-field">
                <input name="clientName" placeholder="Client / Company Name" defaultValue={doc.client_name ?? ''} />
              </div>
              <div className="iv-field">
                <textarea name="clientAddress" rows={2} placeholder="Client address" defaultValue={doc.client_address ?? ''} />
              </div>
              <div className="iv-field">
                <input name="clientContact" placeholder="Client phone / email" defaultValue={doc.client_contact ?? ''} />
              </div>
            </div>
          </div>
        )}

        <div>
          <h2 className="mb-2 font-heading text-sm font-semibold no-print" style={{ color: 'var(--iv-ink)' }}>
            Items
          </h2>
          <DocumentEditor
            type={type}
            initialCurrency={doc.currency}
            initialOverallDiscountPercent={doc.overall_discount_percent}
            initialTaxEnabled={doc.tax_enabled === 1}
            initialTaxPercent={doc.tax_percent}
            initialItems={items.map((it) => ({
              deskripsi: it.deskripsi,
              qty: it.qty,
              unit: it.unit ?? '',
              harga: it.harga,
              diskonPercent: it.diskon_percent,
              catatan: it.catatan ?? '',
            }))}
          />
        </div>

        <div className="iv-footer-fields">
          <div>
            <h3>Notes</h3>
            <textarea name="notes" placeholder="Additional notes for the client..." defaultValue={doc.notes ?? ''} />
          </div>
          {type === 'invoice' ? (
            <div>
              <h3>Payment Information</h3>
              <textarea name="bankInfo" placeholder="Bank name, account number, account holder..." style={{ minHeight: 112 }} defaultValue={doc.bank_info ?? ''} />
            </div>
          ) : null}
          {type === 'quotation' ? (
            <div>
              <h3>Terms &amp; Conditions</h3>
              <textarea name="terms" placeholder="Lead time, warranty, payment terms, etc..." style={{ minHeight: 112 }} defaultValue={doc.terms ?? ''} />
            </div>
          ) : null}
        </div>

        {type === 'quotation' ? (
          <div className="iv-sig-row no-print-space">
            <div className="iv-sig-box" style={{ flex: '0 1 240px', textAlign: 'left' }}>
              <div className="iv-sig-caption">Issued By</div>
              <div className="iv-sig-space" />
              <div className="iv-sig-line">
                <input name="issuedBy" placeholder="Name" defaultValue={doc.issued_by ?? ''} style={{ textAlign: 'left' }} />
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
                <input name="senderName" placeholder="Name & signature" defaultValue={doc.sender_name ?? ''} />
              </div>
            </div>
            <div className="iv-sig-box">
              <div className="iv-sig-caption">Driver</div>
              <div className="iv-sig-space" />
              <div className="iv-sig-line">
                <input name="driverSign" placeholder="Received by name & signature" defaultValue={doc.driver_sign ?? ''} />
              </div>
            </div>
            <div className="iv-sig-box">
              <div className="iv-sig-caption">Recipient</div>
              <div className="iv-sig-space" />
              <div className="iv-sig-line">
                <input name="receiverName" placeholder="Name & signature" defaultValue={doc.receiver_name ?? ''} />
              </div>
            </div>
          </div>
        ) : null}

        <SocialFollow />

        <button type="submit" className="iv-btn primary no-print w-fit">
          💾 Save Changes
        </button>
      </form>
    </div>
  );
}
