'use client';

import { useMemo, useState } from 'react';
import { CURRENCIES } from '@/lib/constants';
import { computeDocumentTotals } from '@/lib/docTotals';
import type { CurrencyCode, DocType } from '@/lib/types';

export interface EditorItem {
  key: string;
  deskripsi: string;
  qty: number;
  unit: string;
  harga: number;
  diskonPercent: number;
  catatan: string;
}

let rowCounter = 0;
function newRowKey(): string {
  rowCounter += 1;
  return `row-${rowCounter}`;
}

function emptyRow(): EditorItem {
  return { key: newRowKey(), deskripsi: '', qty: 1, unit: '', harga: 0, diskonPercent: 0, catatan: '' };
}

const CURRENCY_FMT_PREVIEW: Record<CurrencyCode, { symbol: string; locale: string; decimals: number }> = {
  IDR: { symbol: 'Rp', locale: 'id-ID', decimals: 0 },
  USD: { symbol: '$', locale: 'en-US', decimals: 2 },
  EUR: { symbol: '€', locale: 'de-DE', decimals: 2 },
  SGD: { symbol: 'S$', locale: 'en-SG', decimals: 2 },
  MYR: { symbol: 'RM', locale: 'ms-MY', decimals: 2 },
};

function fmtPreview(n: number, code: CurrencyCode): string {
  const c = CURRENCY_FMT_PREVIEW[code] ?? CURRENCY_FMT_PREVIEW.IDR;
  const num = Number.isFinite(n) ? n : 0;
  return `${c.symbol} ${num.toLocaleString(c.locale, { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals })}`;
}

export function DocumentEditor({
  type,
  initialItems,
  initialCurrency,
  initialOverallDiscountPercent,
  initialTaxEnabled,
  initialTaxPercent,
}: {
  type: DocType;
  initialItems?: Partial<EditorItem>[];
  initialCurrency?: CurrencyCode;
  initialOverallDiscountPercent?: number;
  initialTaxEnabled?: boolean;
  initialTaxPercent?: number;
}) {
  const [items, setItems] = useState<EditorItem[]>(() => {
    const seed = (initialItems ?? []).map((it) => ({ ...emptyRow(), ...it }));
    return seed.length > 0 ? seed : [emptyRow()];
  });
  const [currency, setCurrency] = useState<CurrencyCode>(initialCurrency ?? 'IDR');
  const [overallDiscountPercent, setOverallDiscountPercent] = useState(initialOverallDiscountPercent ?? 0);
  const [taxEnabled, setTaxEnabled] = useState(initialTaxEnabled ?? true);
  const [taxPercent, setTaxPercent] = useState(initialTaxPercent ?? 11);

  const hasPricing = type === 'invoice' || type === 'quotation';

  const totals = useMemo(
    () =>
      computeDocumentTotals(
        items.map((it) => ({ qty: it.qty, harga: it.harga, diskonPercent: it.diskonPercent })),
        overallDiscountPercent,
        taxEnabled,
        taxPercent
      ),
    [items, overallDiscountPercent, taxEnabled, taxPercent]
  );

  const itemsJson = useMemo(
    () =>
      JSON.stringify(
        items.map((it) => ({
          deskripsi: it.deskripsi,
          qty: it.qty,
          unit: it.unit,
          harga: it.harga,
          diskonPercent: it.diskonPercent,
          catatan: it.catatan,
        }))
      ),
    [items]
  );

  function updateItem(key: string, patch: Partial<EditorItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function removeItem(key: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : prev));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyRow()]);
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="itemsJson" value={itemsJson} />

      {hasPricing ? (
        <div className="iv-party right" style={{ marginBottom: 4 }}>
          <h3>Currency</h3>
          <div className="iv-field">
            <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div className="iv-table-scroll">
        <table className="iv-table">
          <thead>
            <tr>
              <th style={{ width: '36%' }}>Description</th>
              <th className="num" style={{ width: '10%' }}>Qty</th>
              {hasPricing ? <th className="num" style={{ width: '16%' }}>Unit Price</th> : null}
              {hasPricing ? <th className="num" style={{ width: '10%' }}>Discount %</th> : null}
              {!hasPricing ? <th style={{ width: '16%' }}>Unit</th> : null}
              {!hasPricing ? <th>Remarks</th> : null}
              {hasPricing ? <th className="num" style={{ width: '18%' }}>Amount</th> : null}
              <th className="no-print" style={{ width: '4%' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.key}>
                <td>
                  <input
                    value={it.deskripsi}
                    onChange={(e) => updateItem(it.key, { deskripsi: e.target.value })}
                    placeholder="Item / service name"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    className="num"
                    value={it.qty}
                    onChange={(e) => updateItem(it.key, { qty: Number(e.target.value) || 0 })}
                  />
                </td>
                {hasPricing ? (
                  <td>
                    <input
                      type="number"
                      min={0}
                      className="num"
                      value={it.harga}
                      onChange={(e) => updateItem(it.key, { harga: Number(e.target.value) || 0 })}
                    />
                  </td>
                ) : null}
                {hasPricing ? (
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="num"
                      value={it.diskonPercent}
                      onChange={(e) => updateItem(it.key, { diskonPercent: Number(e.target.value) || 0 })}
                    />
                  </td>
                ) : null}
                {!hasPricing ? (
                  <td>
                    <input
                      value={it.unit}
                      onChange={(e) => updateItem(it.key, { unit: e.target.value })}
                      placeholder="pcs/box/crate"
                    />
                  </td>
                ) : null}
                {!hasPricing ? (
                  <td>
                    <input
                      value={it.catatan}
                      onChange={(e) => updateItem(it.key, { catatan: e.target.value })}
                      placeholder="Remarks (optional)"
                    />
                  </td>
                ) : null}
                {hasPricing ? (
                  <td className="num" style={{ paddingTop: 12 }}>
                    {fmtPreview(it.qty * it.harga * (1 - it.diskonPercent / 100), currency)}
                  </td>
                ) : null}
                <td className="no-print" style={{ textAlign: 'center' }}>
                  <button type="button" onClick={() => removeItem(it.key)} className="iv-row-del" aria-label="Remove row">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" onClick={addItem} className="iv-btn no-print iv-add-row-btn">
        ➕ Add Item
      </button>

      {hasPricing ? (
        <div className="iv-totals">
          <div className="iv-totals-inner">
            <div className="iv-totals-line">
              <span>Subtotal</span>
              <span>{fmtPreview(totals.subtotal, currency)}</span>
            </div>
            <div className="iv-totals-line">
              <label>
                Overall Discount
                <input
                  type="number"
                  name="overallDiscountPercent"
                  min={0}
                  value={overallDiscountPercent}
                  onChange={(e) => setOverallDiscountPercent(Number(e.target.value) || 0)}
                />
                %
              </label>
              <span>- {fmtPreview(totals.discountAmt, currency)}</span>
            </div>
            <div className="iv-totals-line">
              <label>
                <input
                  type="checkbox"
                  name="taxEnabled"
                  checked={taxEnabled}
                  onChange={(e) => setTaxEnabled(e.target.checked)}
                />
                Tax (VAT)
                <input
                  type="number"
                  name="taxPercent"
                  min={0}
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(Number(e.target.value) || 0)}
                />
                %
              </label>
              <span>{fmtPreview(totals.taxAmt, currency)}</span>
            </div>
            <div className="iv-totals-line grand">
              <span>Total</span>
              <span>{fmtPreview(totals.grand, currency)}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
