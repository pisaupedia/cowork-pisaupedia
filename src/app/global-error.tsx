'use client';

/**
 * Jaring pengaman TERAKHIR — hanya aktif kalau root layout sendiri (yang
 * merender <html>/<body>) gagal me-render, kasus yang sangat jarang terjadi.
 * Karena root layout tidak ikut jalan, file ini WAJIB menulis tag
 * <html>/<body> sendiri (aturan Next.js untuk global-error.tsx).
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', background: '#f7f8fa', margin: 0 }}>
        <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ maxWidth: 420, background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #f0d0cc' }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>⚠️ Terjadi Kesalahan Fatal</h1>
            <p style={{ fontSize: 14, color: '#444', margin: '0 0 16px' }}>
              {error.message || 'Aplikasi mengalami kesalahan yang tidak terduga.'}
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                background: 'oklch(0.52 0.14 255)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Muat Ulang
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
