import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { buildOrderDetail } from '@/lib/view';
import { formatTanggal } from '@/lib/derive';
import {
  uploadAttachmentAction,
  markCompleteAction,
  markPaidAction,
  addNoteAction,
  updateStageCostAction,
  addDesignPhotosAction,
} from './actions';

const TABS = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'riwayat', label: 'Riwayat Tahap & Catatan' },
  { key: 'lampiran', label: 'Lampiran' },
] as const;

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { tab } = await searchParams;

  const detail = buildOrderDetail(id, user);
  if (!detail) notFound();

  const activeTab = tab === 'riwayat' || tab === 'lampiran' || tab === 'laporan' ? tab : 'ringkasan';

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Link href="/dashboard" className="flex w-fit items-center gap-1 text-sm font-semibold text-black/55">
        &larr; Kembali
      </Link>

      <div className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="font-heading text-2xl font-semibold">{detail.order.kode}</div>
            <div className="text-sm text-black/55">
              {detail.order.jenis} · {detail.order.jumlah} unit · Divisi saat ini: {detail.currentDivisi}
            </div>
          </div>
          <span className="rounded-full px-3 py-1.5 text-sm font-semibold" style={{ background: detail.badgeBg, color: detail.badgeFg }}>
            {detail.badgeLabel}
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
          <div className="h-full rounded-full bg-[var(--brand-blue)]" style={{ width: `${detail.progress}%` }} />
        </div>

        <div className="flex flex-col gap-2.5 rounded-xl border border-black/10 bg-black/[0.02] p-3.5">
          <div>
            <h2 className="font-heading text-sm font-semibold">Desain Pisau (Foto Referensi)</h2>
            <p className="text-xs text-black/55">
              Terlihat oleh semua divisi/vendor yang mengerjakan pesanan ini — bukan hanya divisi yang sedang
              berjalan sekarang.
            </p>
          </div>
          {detail.designPhotos.length === 0 ? (
            <p className="text-xs italic text-black/45">Belum ada foto desain diunggah.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {detail.designPhotos.map((p) => (
                <a
                  key={p.id}
                  href={`/api/design-photos/${p.id}`}
                  target="_blank"
                  className="group flex flex-col gap-1 overflow-hidden rounded-lg border border-black/10 bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/design-photos/${p.id}`}
                    alt={p.nama}
                    className="aspect-square w-full object-cover transition group-hover:opacity-90"
                  />
                  <div className="px-2 pb-1.5 text-[10px] text-black/45">
                    {p.oleh} · {formatTanggal(p.createdAt)}
                  </div>
                </a>
              ))}
            </div>
          )}
          {detail.canManageDesignPhotos ? (
            <details className="rounded-lg border border-black/10 bg-white px-3 py-2">
              <summary className="cursor-pointer text-xs font-semibold text-black/60">+ Tambah Foto Desain</summary>
              <form action={addDesignPhotosAction} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="hidden" name="orderId" value={detail.order.id} />
                <input
                  type="file"
                  name="desainFoto"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  required
                  className="text-xs"
                />
                <button type="submit" className="rounded-md bg-[var(--brand-blue)] px-3 py-1.5 text-xs font-semibold text-white">
                  Unggah
                </button>
              </form>
            </details>
          ) : null}
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-black/10">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/orders/${id}?tab=${t.key}`}
              className={
                'whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ' +
                (activeTab === t.key ? 'border-[var(--brand-blue)] text-[var(--brand-blue)]' : 'border-transparent text-black/55')
              }
            >
              {t.label}
            </Link>
          ))}
          {detail.showReport ? (
            <Link
              href={`/orders/${id}?tab=laporan`}
              className={
                'whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ' +
                (activeTab === 'laporan' ? 'border-[var(--brand-blue)] text-[var(--brand-blue)]' : 'border-transparent text-black/55')
              }
            >
              Laporan Riwayat
            </Link>
          ) : null}
        </div>

        {activeTab === 'ringkasan' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Pelanggan" value={detail.pelangganDisplay} />
            <Field label="Kontak" value={detail.kontakDisplay} />
            <Field label="Harga Jual" value={detail.hargaDisplay} />
            {detail.hargaModalDisplay !== null ? <Field label="Harga Modal (Total)" value={detail.hargaModalDisplay} /> : null}
            <Field label="Tanggal Masuk" value={formatTanggal(detail.order.tanggal_masuk)} />
            <Field label="Deadline" value={formatTanggal(detail.order.deadline)} />
          </div>
        ) : null}

        {activeTab === 'riwayat' ? (
          <div className="flex flex-col gap-3">
            {detail.stages.map((stage) => (
              <div key={stage.id} className="flex flex-col gap-2 rounded-xl border border-black/10 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: dotColor(stage.status) }} />
                    <span className="font-heading text-sm font-semibold">{stage.nama}</span>
                  </div>
                  <span className="text-xs text-black/55">{stage.statusLabel}</span>
                </div>
                <div className="text-xs text-black/55">Pelaksana: {stage.vendorDisplay}</div>

                {stage.restricted ? (
                  <p className="text-xs italic text-black/45">Detail tahap ini tidak ditampilkan untuk vendor.</p>
                ) : null}

                {stage.canUpload ? (
                  <div className="flex flex-col gap-2 rounded-lg border border-[oklch(0.85_0.05_65)] bg-[oklch(0.96_0.03_65)] p-3">
                    <p className="text-xs text-[oklch(0.4_0.09_65)]">
                      Aturan: foto bukti wajib diunggah sebelum tahap ini bisa ditandai selesai.
                    </p>
                    <form action={uploadAttachmentAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="stageId" value={stage.id} />
                      <input type="file" name="file" accept="image/*,.pdf,.doc,.docx,.txt" required className="text-xs" />
                      <button type="submit" className="rounded-md bg-[var(--brand-blue)] px-3 py-1.5 text-xs font-semibold text-white">
                        Unggah
                      </button>
                    </form>
                    <p className="text-[11px] italic text-[oklch(0.5_0.09_65)]">
                      Bisa dari kamera langsung (pilih &quot;Ambil Foto&quot; di dialog file pada perangkat mobile) atau
                      galeri. Foto sebaiknya dikompres di sisi perangkat sebelum diunggah bila koneksi lambat.
                    </p>
                    {stage.canComplete ? (
                      <form action={markCompleteAction}>
                        <input type="hidden" name="stageId" value={stage.id} />
                        <button type="submit" className="flex items-center gap-1.5 rounded-md bg-[oklch(0.5_0.12_142)] px-3 py-1.5 text-xs font-semibold text-white">
                          Tandai Tahap Selesai
                        </button>
                      </form>
                    ) : (
                      <p className="text-xs text-black/45">
                        {stage.fotoCount === 0 ? 'Belum ada foto bukti diunggah.' : ''}
                      </p>
                    )}
                  </div>
                ) : null}

                {stage.showHonor ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/[0.03] p-2.5">
                    <span className="text-xs">
                      Honor vendor tahap ini: <strong>{stage.honorJumlahLabel}</strong>
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                        style={{ background: stage.honorBadgeBg, color: stage.honorBadgeFg }}
                      >
                        {stage.honorStatusLabel}
                      </span>
                      {stage.canMarkPaid ? (
                        <form action={markPaidAction}>
                          <input type="hidden" name="stageId" value={stage.id} />
                          <button type="submit" className="rounded-md bg-[var(--brand-blue)] px-2.5 py-1 text-[11px] font-semibold text-white">
                            Tandai Sudah Dibayar
                          </button>
                        </form>
                      ) : null}
                    </span>
                  </div>
                ) : null}

                {stage.canEditCosts && (stage.materialCostLabel || stage.showShippingExtra) ? (
                  <div className="flex flex-wrap gap-3 rounded-lg bg-black/[0.03] p-2.5 text-xs">
                    {stage.materialCostLabel ? (
                      <span>
                        {stage.materialCostLabel}: <strong>{stage.materialCostDisplay}</strong>
                      </span>
                    ) : null}
                    {stage.showShippingExtra ? (
                      <>
                        <span>
                          Harga Shipping: <strong>{stage.shippingCostDisplay}</strong>
                        </span>
                        <span>
                          Extra Cost: <strong>{stage.extraCostDisplay}</strong>
                        </span>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {stage.canEditCosts ? (
                  <details className="rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold text-black/60">
                      Edit Honor &amp; Harga Modal (admin)
                    </summary>
                    <form action={updateStageCostAction} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input type="hidden" name="stageId" value={stage.id} />
                      <label className="flex flex-col gap-1 text-[11px] font-medium text-black/60">
                        Honor Vendor (Rp)
                        <input
                          name="honorJumlah"
                          type="number"
                          min={0}
                          step={1000}
                          defaultValue={stage.honorJumlahRaw}
                          className="rounded-md border border-black/15 px-2.5 py-1.5 text-xs font-normal text-black outline-none focus:border-[var(--brand-blue)]"
                        />
                      </label>
                      {stage.materialCostLabel ? (
                        <label className="flex flex-col gap-1 text-[11px] font-medium text-black/60">
                          {stage.materialCostLabel} (Rp)
                          <input
                            name="materialCost"
                            type="number"
                            min={0}
                            step={1000}
                            defaultValue={stage.materialCostRaw}
                            className="rounded-md border border-black/15 px-2.5 py-1.5 text-xs font-normal text-black outline-none focus:border-[var(--brand-blue)]"
                          />
                        </label>
                      ) : null}
                      {stage.showShippingExtra ? (
                        <>
                          <label className="flex flex-col gap-1 text-[11px] font-medium text-black/60">
                            Harga Shipping (Rp)
                            <input
                              name="shippingCost"
                              type="number"
                              min={0}
                              step={1000}
                              defaultValue={stage.shippingCostRaw}
                              className="rounded-md border border-black/15 px-2.5 py-1.5 text-xs font-normal text-black outline-none focus:border-[var(--brand-blue)]"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-[11px] font-medium text-black/60">
                            Extra Cost (Rp)
                            <input
                              name="extraCost"
                              type="number"
                              min={0}
                              step={1000}
                              defaultValue={stage.extraCostRaw}
                              className="rounded-md border border-black/15 px-2.5 py-1.5 text-xs font-normal text-black outline-none focus:border-[var(--brand-blue)]"
                            />
                          </label>
                        </>
                      ) : null}
                      <button
                        type="submit"
                        className="w-fit rounded-md bg-[var(--brand-blue)] px-3 py-1.5 text-xs font-semibold text-white sm:col-span-2"
                      >
                        Simpan
                      </button>
                    </form>
                  </details>
                ) : null}

                {stage.notes.map((n) => (
                  <div key={n.id} className="rounded-lg bg-black/[0.03] p-2.5">
                    <div className="mb-0.5 flex justify-between text-[11px] text-black/50">
                      <span className="font-semibold">{n.penulis}</span>
                      <span>{formatTanggal(n.createdAt)}</span>
                    </div>
                    <div className="text-sm text-black/80">{n.teks}</div>
                  </div>
                ))}

                {stage.isOwn ? (
                  <form action={addNoteAction} className="flex gap-2">
                    <input type="hidden" name="stageId" value={stage.id} />
                    <input
                      type="text"
                      name="teks"
                      placeholder="Tambah catatan…"
                      className="flex-grow rounded-md border border-black/15 px-2.5 py-1.5 text-xs outline-none focus:border-[var(--brand-blue)]"
                    />
                    <button type="submit" className="rounded-md border border-black/15 px-3 py-1.5 text-xs font-semibold">
                      Kirim
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {activeTab === 'lampiran' ? (
          <div className="flex flex-col gap-4">
            {detail.stages.map((stage) => (
              <div key={stage.id} className="flex flex-col gap-2">
                <div className="font-heading text-[13px] font-semibold text-black/70">{stage.nama}</div>
                {stage.restricted ? (
                  <p className="text-xs italic text-black/45">Lampiran tahap ini tidak ditampilkan untuk vendor.</p>
                ) : stage.attachments.length === 0 ? (
                  <p className="text-xs text-black/45">Belum ada lampiran.</p>
                ) : (
                  stage.attachments.map((a) => (
                    <a
                      key={a.id}
                      href={`/api/files/${a.id}`}
                      target="_blank"
                      className="flex items-center gap-2.5 rounded-lg border border-black/10 px-3 py-2 text-sm hover:border-[var(--brand-blue)]"
                    >
                      {a.tipe === 'foto' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/files/${a.id}`}
                          alt={a.nama}
                          className="h-10 w-10 flex-shrink-0 rounded-md border border-black/10 object-cover"
                        />
                      ) : null}
                      <span className="min-w-0 flex-grow truncate">{a.nama}</span>
                      <span className="flex-shrink-0 text-[11px] text-black/45">
                        {a.oleh} · {formatTanggal(a.createdAt)}
                      </span>
                      {a.pendingSync ? (
                        <span className="flex-shrink-0 rounded-full bg-[oklch(0.94_0.06_80)] px-2 py-0.5 text-[10px] font-semibold text-[oklch(0.42_0.1_65)]">
                          Menunggu Sinkronisasi
                        </span>
                      ) : null}
                    </a>
                  ))
                )}
              </div>
            ))}
          </div>
        ) : null}

        {activeTab === 'laporan' && detail.showReport && detail.report ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 rounded-xl bg-[oklch(0.94_0.045_142)] p-4">
              <p className="text-sm font-semibold text-[oklch(0.36_0.09_142)]">
                Pekerjaan sudah selesai dari awal hingga akhir — laporan riwayat lengkap di bawah.
              </p>
              <div className="flex flex-wrap gap-4 text-xs text-[oklch(0.4_0.09_142)]">
                <span>Mulai: {formatTanggal(detail.order.tanggal_masuk)}</span>
                <span>{detail.report.fotoCount} foto bukti</span>
                <span>{detail.report.dokumenCount} dokumen</span>
                <span>{detail.report.catatanCount} catatan</span>
                <span>{detail.report.honorTotalLabel} total honor vendor</span>
                <span>{detail.report.hargaModalTotalLabel} total harga modal</span>
              </div>
            </div>
            {detail.stages.map((stage) => (
              <div key={stage.id} className="flex flex-col gap-2 rounded-xl border border-black/10 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-heading text-sm font-semibold">{stage.nama}</span>
                  <span className="text-xs text-black/55">Pelaksana: {stage.vendorDisplay}</span>
                </div>
                {stage.showHonor ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span>
                      Honor vendor: <strong>{stage.honorJumlahLabel}</strong>
                    </span>
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: stage.honorBadgeBg, color: stage.honorBadgeFg }}>
                      {stage.honorStatusLabel}
                    </span>
                  </div>
                ) : null}
                {stage.materialCostLabel ? (
                  <div className="text-xs">
                    {stage.materialCostLabel}: <strong>{stage.materialCostDisplay}</strong>
                  </div>
                ) : null}
                {stage.showShippingExtra ? (
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span>
                      Harga Shipping: <strong>{stage.shippingCostDisplay}</strong>
                    </span>
                    <span>
                      Extra Cost: <strong>{stage.extraCostDisplay}</strong>
                    </span>
                  </div>
                ) : null}
                {stage.notes.map((n) => (
                  <div key={n.id} className="rounded-lg bg-black/[0.03] p-2.5">
                    <div className="mb-0.5 flex justify-between text-[11px] text-black/50">
                      <span className="font-semibold">{n.penulis}</span>
                      <span>{formatTanggal(n.createdAt)}</span>
                    </div>
                    <div className="text-sm text-black/80">{n.teks}</div>
                  </div>
                ))}
                {stage.attachments.map((a) => (
                  <a key={a.id} href={`/api/files/${a.id}`} target="_blank" className="flex items-center gap-2.5 rounded-lg border border-black/10 px-3 py-2 text-sm">
                    {a.tipe === 'foto' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/files/${a.id}`}
                        alt={a.nama}
                        className="h-10 w-10 flex-shrink-0 rounded-md border border-black/10 object-cover"
                      />
                    ) : null}
                    <span className="min-w-0 flex-grow truncate">{a.nama}</span>
                    <span className="flex-shrink-0 text-[11px] text-black/45">{a.oleh}</span>
                  </a>
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-black/55">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function dotColor(status: 'MENUNGGU' | 'BERJALAN' | 'SELESAI') {
  if (status === 'SELESAI') return 'oklch(0.6 0.13 142)';
  if (status === 'BERJALAN') return 'oklch(0.72 0.15 65)';
  return 'oklch(0.8 0.01 255)';
}
