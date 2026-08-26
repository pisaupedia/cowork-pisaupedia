import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { countStagesForVendor, listExternalVendors } from '@/lib/repo/vendors';
import { listUsersForVendor, listAdmins } from '@/lib/repo/users';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';
import { SubmitButton } from '@/components/submit-button';
import {
  createAdminAction,
  createVendorAction,
  deleteAdminAction,
  deleteUserAction,
  deleteVendorAction,
  resetAdminPasswordAction,
  resetVendorPasswordAction,
  updateVendorAction,
} from './actions';

export default async function VendorsPage() {
  const user = await requireUser();
  if (user.role !== 'ADMIN') redirect('/dashboard');

  const vendors = listExternalVendors();
  const admins = listAdmins();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Vendor &amp; Pengguna</h1>
        <p className="text-sm text-black/55">
          Onboarding vendor dilakukan oleh admin — vendor tidak mendaftar sendiri. Satu vendor bisa ditugaskan ke
          lebih dari satu divisi saat membuat pesanan baru.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-5">
        <h2 className="font-heading text-sm font-semibold">Daftar Vendor</h2>
        {vendors.length === 0 ? (
          <p className="text-sm text-black/55">Belum ada vendor.</p>
        ) : (
          vendors.map((v) => {
            const accounts = listUsersForVendor(v.id);
            // Setiap vendor hanya punya satu akun (dibuat sekaligus saat vendor
            // dibuat — lihat createVendorAction), jadi form Edit Vendor di bawah
            // sekaligus mengedit akun ini dalam satu form, bukan dua form terpisah.
            const account = accounts[0];
            const stageCount = countStagesForVendor(v.id);
            return (
              <div key={v.id} className="flex flex-col gap-2 rounded-lg border border-black/10 px-3.5 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{v.nama}</div>
                    <div className="text-xs text-black/50">{v.kontak ?? 'Tidak ada kontak'}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold text-[var(--brand-blue)]">
                        Edit Vendor &amp; Akun
                      </summary>
                      <form
                        action={updateVendorAction}
                        className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-black/10 bg-white p-2.5"
                      >
                        <input type="hidden" name="id" value={v.id} />
                        {account ? <input type="hidden" name="userId" value={account.id} /> : null}
                        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
                          Nama Vendor / Akun
                          <input
                            name="nama"
                            defaultValue={v.nama}
                            required
                            className="rounded-md border border-black/15 px-2.5 py-1.5 text-sm font-normal text-black outline-none focus:border-[var(--brand-blue)]"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
                          Kontak
                          <input
                            name="kontak"
                            defaultValue={v.kontak ?? ''}
                            placeholder="Opsional"
                            className="rounded-md border border-black/15 px-2.5 py-1.5 text-sm font-normal text-black outline-none focus:border-[var(--brand-blue)]"
                          />
                        </label>
                        {account ? (
                          <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
                            Username
                            <input
                              name="username"
                              defaultValue={account.username}
                              required
                              className="rounded-md border border-black/15 px-2.5 py-1.5 text-sm font-normal text-black outline-none focus:border-[var(--brand-blue)]"
                            />
                          </label>
                        ) : null}
                        <button
                          type="submit"
                          className="rounded-md bg-[var(--brand-blue)] px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Simpan
                        </button>
                      </form>
                    </details>
                    {stageCount > 0 ? (
                      <span
                        className="text-xs text-black/50"
                        title={`Vendor ini masih ditugaskan pada ${stageCount} tahap pesanan yang belum selesai.`}
                      >
                        Ditugaskan ({stageCount}) — tidak bisa dihapus
                      </span>
                    ) : (
                      <form action={deleteVendorAction}>
                        <input type="hidden" name="id" value={v.id} />
                        <ConfirmDeleteButton
                          label="Hapus Vendor"
                          triggerClassName="text-xs font-semibold text-red-600"
                          title="Hapus Vendor"
                          description={`Vendor "${v.nama}" beserta akun login-nya akan dihapus permanen.`}
                        />
                      </form>
                    )}
                  </div>
                </div>
                {accounts.length === 0 ? (
                  <div className="text-xs text-black/55">Belum ada akun login.</div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {accounts.map((acc) => (
                      <div key={acc.id} className="flex flex-wrap items-center gap-2 rounded-md bg-black/[0.03] px-2.5 py-1.5">
                        <span className="text-xs font-medium text-black/70">@{acc.username}</span>
                        <div className="ml-auto flex flex-wrap items-center gap-3">
                          <details>
                            <summary className="cursor-pointer text-xs font-semibold text-[var(--brand-blue)]">
                              Reset Password
                            </summary>
                            <form
                              action={resetVendorPasswordAction}
                              className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-black/10 bg-white p-2.5"
                            >
                              <input type="hidden" name="userId" value={acc.id} />
                              <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
                                Password Baru
                                <input
                                  name="newPassword"
                                  type="password"
                                  required
                                  minLength={6}
                                  placeholder="Min. 6 karakter"
                                  className="rounded-md border border-black/15 px-2.5 py-1.5 text-sm font-normal text-black outline-none focus:border-[var(--brand-blue)]"
                                />
                              </label>
                              <button
                                type="submit"
                                className="rounded-md bg-[var(--brand-blue)] px-3 py-1.5 text-xs font-semibold text-white"
                              >
                                Simpan
                              </button>
                            </form>
                          </details>
                          <form action={deleteUserAction}>
                            <input type="hidden" name="id" value={acc.id} />
                            <ConfirmDeleteButton
                              label="Hapus Akun"
                              triggerClassName="text-xs font-semibold text-red-600"
                              title="Hapus Akun"
                              description={`Akun login @${acc.username} akan dihapus permanen. Riwayat lama (catatan/lampiran) tetap tersimpan.`}
                            />
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-5">
        <h2 className="font-heading text-sm font-semibold">Tambah Vendor Baru</h2>
        <form action={createVendorAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <LabeledInput name="nama" label="Nama Vendor / Akun" required />
          <LabeledInput name="kontak" label="Kontak (opsional)" />
          <LabeledInput name="username" label="Username Login" required />
          <LabeledInput name="password" label="Password" type="password" required />
          <SubmitButton
            pendingText="Menyimpan…"
            className="sm:col-span-2 mt-1 w-fit rounded-lg bg-[var(--brand-blue)] px-4 py-2 text-sm font-semibold text-white"
          >
            Tambah Vendor
          </SubmitButton>
        </form>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-5">
        <div>
          <h2 className="font-heading text-sm font-semibold">Akun Admin</h2>
          <p className="text-xs text-black/55">
            Sebelumnya aplikasi ini hanya bisa punya satu akun admin — kalau admin itu lupa password atau tidak bisa
            akses, operasional bisa terhenti total. Buat minimal satu admin cadangan di sini. Admin terakhir yang
            tersisa tidak bisa dihapus.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          {admins.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-md bg-black/[0.03] px-2.5 py-1.5">
              <span className="text-xs font-medium text-black/70">
                {a.name} <span className="text-black/55">· @{a.username}</span>
                {a.id === user.id ? <span className="text-black/50"> (Anda)</span> : null}
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-3">
                <details>
                  <summary className="cursor-pointer text-xs font-semibold text-[var(--brand-blue)]">
                    Reset Password
                  </summary>
                  <form
                    action={resetAdminPasswordAction}
                    className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-black/10 bg-white p-2.5"
                  >
                    <input type="hidden" name="userId" value={a.id} />
                    <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
                      Password Baru
                      <input
                        name="newPassword"
                        type="password"
                        required
                        minLength={6}
                        placeholder="Min. 6 karakter"
                        className="rounded-md border border-black/15 px-2.5 py-1.5 text-sm font-normal text-black outline-none focus:border-[var(--brand-blue)]"
                      />
                    </label>
                    <SubmitButton
                      pendingText="Menyimpan…"
                      className="rounded-md bg-[var(--brand-blue)] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Simpan
                    </SubmitButton>
                  </form>
                </details>
                {admins.length > 1 ? (
                  <form action={deleteAdminAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <ConfirmDeleteButton
                      label="Hapus Akun"
                      triggerClassName="text-xs font-semibold text-red-600"
                      title="Hapus Akun Admin"
                      description={`Akun admin "${a.name}" akan dihapus permanen.`}
                    />
                  </form>
                ) : (
                  <span className="text-xs text-black/50" title="Admin terakhir yang tersisa tidak bisa dihapus.">
                    Admin terakhir — tidak bisa dihapus
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <details className="rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2.5">
          <summary className="cursor-pointer text-xs font-semibold text-[var(--brand-blue)]">
            + Tambah Admin Baru
          </summary>
          <form action={createAdminAction} className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <LabeledInput name="name" label="Nama" required />
            <LabeledInput name="username" label="Username Login" required />
            <LabeledInput name="password" label="Password" type="password" required />
            <SubmitButton
              pendingText="Menyimpan…"
              className="sm:col-span-3 mt-1 w-fit rounded-lg bg-[var(--brand-blue)] px-4 py-2 text-sm font-semibold text-white"
            >
              Tambah Admin
            </SubmitButton>
          </form>
        </details>
      </div>
    </div>
  );
}

function LabeledInput({
  name,
  label,
  type = 'text',
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        className="rounded-lg border border-black/15 px-3 py-2 text-sm font-normal text-black outline-none focus:border-[var(--brand-blue)]"
      />
    </label>
  );
}
