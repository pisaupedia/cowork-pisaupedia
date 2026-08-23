'use client';

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="iv-btn primary no-print">
      🖨️ Print / Save PDF
    </button>
  );
}
