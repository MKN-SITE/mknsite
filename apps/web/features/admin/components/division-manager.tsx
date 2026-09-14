"use client";

import { useMemo, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { SearchBar } from "@/components/ui/search-bar";
import { useDivisions, type DivisionSummaryDto } from "../hooks/use-divisions";
import styles from "./division-manager.module.css";

export function DivisionManager({ canManage = true }: { canManage?: boolean }) {
  const { divisions, loading, error, refresh } = useDivisions();

  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<{ item?: DivisionSummaryDto } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DivisionSummaryDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const query = search.trim().toLowerCase();
  const visibleDivisions = useMemo(() => {
    if (!query) return divisions;
    return divisions.filter((div) => {
      const nameMatch = div.name.toLowerCase().includes(query);
      const descMatch = div.description?.toLowerCase().includes(query);
      return nameMatch || descMatch;
    });
  }, [divisions, query]);

  async function submitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || saving) return;

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();

    if (!name) {
      setFormError("Nama divisi wajib diisi.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      if (editor.item) {
        await api(`/admin/divisions/${editor.item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name, description: description || null })
        });
        setNotice(`Divisi "${name}" berhasil diperbarui.`);
      } else {
        await api("/admin/divisions", {
          method: "POST",
          body: JSON.stringify({ name, description: description || null })
        });
        setNotice(`Divisi "${name}" berhasil ditambahkan.`);
      }

      setEditor(null);
      await refresh();
    } catch (err: any) {
      setFormError(err instanceof ApiError ? err.message : "Gagal menyimpan data divisi.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || saving) return;

    setSaving(true);
    setFormError(null);

    try {
      await api(`/admin/divisions/${deleteTarget.id}`, {
        method: "DELETE"
      });
      setNotice(`Divisi "${deleteTarget.name}" berhasil dihapus.`);
      setDeleteTarget(null);
      await refresh();
    } catch (err: any) {
      setFormError(err instanceof ApiError ? err.message : "Gagal menghapus divisi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.card} aria-label="Manajemen Divisi">
      <div className={styles.heading}>
        <div>
          <p className={styles.kicker}>DIVISI ORGANISASI</p>
          <h3 className={styles.title}>Master Divisi &amp; Unit Kerja</h3>
          <p className={styles.subtitle}>
            Kelola daftar departemen dan unit kerja perusahaan. Pengguna dapat dikelompokkan ke dalam divisi untuk mempermudah tata kelola organisasi.
          </p>
        </div>

        {canManage && (
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setFormError(null);
              setEditor({});
            }}
          >
            + Tambah Divisi
          </Button>
        )}
      </div>

      {notice && (
        <div className={styles.notice} role="status">
          <span>{notice}</span>
          <button
            type="button"
            className={styles.noticeClose}
            onClick={() => setNotice(null)}
            aria-label="Tutup pemberitahuan"
          >
            ×
          </button>
        </div>
      )}

      <div className={styles.toolbar}>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Cari nama atau deskripsi divisi..."
          className={styles.searchBar}
        />
        <Button variant="secondary" size="sm" loading={loading} loadingText="Memuat..." onClick={refresh}>
          Muat ulang
        </Button>
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={refresh}>
            Coba lagi
          </Button>
        </div>
      )}

      {loading && (
        <div className={styles.skeletonGrid} aria-label="Memuat divisi..." data-skeleton="true">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      )}

      {!loading && !error && (
        <>
          <p className={styles.summary} role="status">
            {visibleDivisions.length} divisi {query ? "ditemukan" : "terdaftar"}
          </p>

          {visibleDivisions.length === 0 ? (
            <EmptyState
              title={query ? "Tidak ada hasil" : "Belum ada divisi"}
              description={
                query
                  ? "Coba gunakan kata kunci pencarian nama atau deskripsi yang lain."
                  : "Tambahkan divisi pertama untuk mulai mengelompokkan pengguna."
              }
            />
          ) : (
            <div className={styles.grid}>
              {visibleDivisions.map((div) => (
                <article key={div.id} className={styles.itemCard}>
                  <div>
                    <div className={styles.itemHead}>
                      <h4 className={styles.itemName}>{div.name}</h4>
                      <Badge variant={div.userCount > 0 ? "accent" : "neutral"}>
                        {div.userCount} anggota
                      </Badge>
                    </div>
                    <p className={styles.itemDesc}>
                      {div.description || "Tidak ada keterangan deskripsi."}
                    </p>
                  </div>

                  <div className={styles.metrics}>
                    <span style={{ fontSize: "11px", color: "var(--ink-soft)" }}>
                      ID: #{div.id}
                    </span>
                    {canManage && (
                      <div className={styles.actions}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setFormError(null);
                            setEditor({ item: div });
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={div.userCount > 0}
                          title={
                            div.userCount > 0
                              ? `Divisi masih memiliki ${div.userCount} anggota aktif`
                              : "Hapus divisi ini"
                          }
                          onClick={() => {
                            setFormError(null);
                            setDeleteTarget(div);
                          }}
                        >
                          Hapus
                        </Button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal Tambah / Edit Divisi */}
      <Modal
        open={Boolean(editor)}
        onClose={() => !saving && setEditor(null)}
        title={editor?.item ? `Edit Divisi — ${editor.item.name}` : "Tambah Divisi Baru"}
        size="md"
        footer={
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", width: "100%" }}>
            <Button variant="secondary" disabled={saving} onClick={() => setEditor(null)}>
              Batal
            </Button>
            <Button type="submit" form="division-editor-form" loading={saving} loadingText="Menyimpan...">
              Simpan
            </Button>
          </div>
        }
      >
        {editor && (
          <form id="division-editor-form" className={styles.form} onSubmit={submitEditor}>
            <FormField
              label="Nama Divisi"
              name="name"
              required
              maxLength={100}
              defaultValue={editor.item?.name ?? ""}
              placeholder="cth. Logistik & Supply Chain"
              disabled={saving}
            />

            <FormField
              label="Deskripsi Divisi"
              name="description"
              maxLength={255}
              defaultValue={editor.item?.description ?? ""}
              placeholder="cth. Bertanggung jawab atas logistik material lapangan..."
              disabled={saving}
            />

            {editor.item && editor.item.userCount > 0 && (
              <div className={`${styles.notice}`} style={{ fontSize: "11px", padding: "8px 12px" }}>
                <span>
                  ℹ️ Mengubah nama divisi akan otomatis memperbarui penugasan pada{" "}
                  <strong>{editor.item.userCount} pengguna</strong> yang terdaftar.
                </span>
              </div>
            )}

            {formError && (
              <p className={styles.formError} role="alert">
                {formError}
              </p>
            )}
          </form>
        )}
      </Modal>

      {/* Modal Hapus Divisi */}
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => !saving && setDeleteTarget(null)}
        title={`Hapus Divisi?`}
        size="sm"
        footer={
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", width: "100%" }}>
            <Button variant="secondary" disabled={saving} onClick={() => setDeleteTarget(null)}>
              Batal
            </Button>
            <Button
              variant="danger"
              loading={saving}
              loadingText="Menghapus..."
              onClick={confirmDelete}
            >
              Hapus permanen
            </Button>
          </div>
        }
      >
        <div>
          <p className={styles.confirmText}>
            Divisi <strong>{deleteTarget?.name}</strong> akan dihapus secara permanen.
          </p>
          <p className={styles.confirmSubtext}>
            Tindakan ini hanya dapat dilakukan bila divisi tidak memiliki anggota karyawan aktif.
          </p>
          {formError && (
            <p className={styles.formError} style={{ marginTop: "8px" }} role="alert">
              {formError}
            </p>
          )}
        </div>
      </Modal>
    </section>
  );
}
