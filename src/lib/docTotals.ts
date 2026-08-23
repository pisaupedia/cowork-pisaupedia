// Logika total dokumen niaga (invoice/quotation) — dipakai baik di server
// (Server Action, untuk hitung ulang grand_total yang benar-benar disimpan)
// maupun di client (DocumentEditor, untuk pratinjau live saat mengetik).
// Sengaja pure function tanpa dependency DB/DOM supaya bisa diimpor dari
// kedua sisi. Rumus mengikuti aplikasi invoice standalone sebelumnya:
//   lineTotal = qty * harga * (1 - diskonPercent/100)
//   subtotal = sum(lineTotal)
//   discountAmt = subtotal * overallDiscountPercent/100
//   afterDiscount = subtotal - discountAmt
//   taxAmt = taxEnabled ? afterDiscount * taxPercent/100 : 0
//   grand = afterDiscount + taxAmt

export interface DocTotalItemInput {
  qty: number;
  harga?: number;
  diskonPercent?: number;
}

export interface DocTotals {
  subtotal: number;
  discountAmt: number;
  taxAmt: number;
  grand: number;
}

export function lineTotal(item: DocTotalItemInput): number {
  const qty = Number.isFinite(item.qty) ? item.qty : 0;
  const harga = Number.isFinite(item.harga ?? 0) ? item.harga ?? 0 : 0;
  const disc = Number.isFinite(item.diskonPercent ?? 0) ? item.diskonPercent ?? 0 : 0;
  return qty * harga * (1 - disc / 100);
}

export function computeDocumentTotals(
  items: DocTotalItemInput[],
  overallDiscountPercent: number,
  taxEnabled: boolean,
  taxPercent: number
): DocTotals {
  const subtotal = items.reduce((sum, it) => sum + lineTotal(it), 0);
  const discountAmt = subtotal * (overallDiscountPercent || 0) / 100;
  const afterDiscount = subtotal - discountAmt;
  const taxAmt = taxEnabled ? (afterDiscount * (taxPercent || 0)) / 100 : 0;
  const grand = afterDiscount + taxAmt;
  return { subtotal, discountAmt, taxAmt, grand };
}
