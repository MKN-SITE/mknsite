"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type PortalUser } from "@/lib/api";
import { PortalHeader } from "@/components/layout/portal-header";
import { Button } from "@/components/ui/button";
import { UserList } from "@/features/admin/components/user-list";
import { RolePermissionViewer } from "@/features/admin/components/role-permission-viewer";
import { MenuManager } from "@/features/admin/components/menu-manager";
import { AdminPortalHome, UserManagementNav } from "@/features/admin/components/admin-portal";
import { adminViewTitles, isUserManagementView, type AdminView } from "@/features/admin/lib/navigation";
import styles from "@/features/admin/components/admin-portal.module.css";
import { RealtimeStatus } from "./realtime-status";

export function AdminApp({ view = "home" }: { view?: AdminView }) {
  const router = useRouter();
  const [admin, setAdmin] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const supportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api<{ user: PortalUser }>("/auth/admin/me", { signal: controller.signal })
      .then(({ user }) => {
        if (!controller.signal.aborted) setAdmin(user);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        if (reason instanceof ApiError && reason.status === 401) router.replace("/admin/login");
        else setError("Portal admin belum dapat dimuat. Periksa koneksi lalu coba lagi.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [router, attempt]);

  // Handle outside click & Escape key for support popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (supportRef.current && !supportRef.current.contains(event.target as Node)) {
        setSupportOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSupportOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await api("/auth/admin/logout", { method: "POST" });
      router.replace("/admin/login");
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) router.replace("/admin/login");
      else setLogoutError("Gagal keluar. Sesi Anda masih aktif; silakan coba lagi.");
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <main id="main" className={styles.loading} role="status">
        <p>Memuat portal admin...</p>
      </main>
    );
  }
  if (error) {
    return (
      <main id="main" className={styles.loading}>
        <h1>Portal belum tersedia</h1>
        <p role="alert">{error}</p>
        <Button onClick={() => setAttempt(attempt + 1)}>Coba lagi</Button>
      </main>
    );
  }
  if (!admin) return null;
  if (admin.actorType !== "admin" || !admin.permissions.includes("admin.manage")) {
    return (
      <main id="main" className={styles.loading}>
        <h1>Akses tidak tersedia</h1>
        <p>Akun ini tidak memiliki izin administrasi.</p>
        <Button variant="secondary" onClick={logout} loading={loggingOut}>
          Keluar admin
        </Button>
        {logoutError && <p role="alert">{logoutError}</p>}
      </main>
    );
  }

  const inUserManagement = isUserManagementView(view);
  const title = adminViewTitles[view];
  const description =
    view === "users"
      ? "Kelola akun, status, dan penetapan role untuk setiap pengguna."
      : view === "roles"
      ? "Tinjau role dan izin yang diberikan kepada masing-masing peran."
      : view === "permissions"
      ? "Telusuri izin akses dan role yang menggunakannya."
      : view === "menus"
      ? "Susun modul dan akses menu pada portal karyawan."
      : "Tinjau informasi akun dan sesi administrator Anda.";

  return (
    <div className={styles.shell}>
      <PortalHeader
        homeHref="/admin"
        name={admin.name}
        role={admin.roles.join(", ") || "Administrator"}
        eyebrow="PORTAL ADMINISTRATOR"
        title={view === "home" ? `Selamat datang, ${admin.name.split(" ")[0]}.` : inUserManagement ? "User Management" : title}
        description={view === "home" ? "Kelola pengguna, akses tim, dan pengaturan portal MKN Site." : inUserManagement ? "Satu ruang untuk mengelola pengguna, role, dan izin akses." : description}
        status={<RealtimeStatus loginPath="/admin/login" tone="inverse" />}
        onLogout={logout}
        loggingOut={loggingOut}
      />

      <main className={`${styles.main} ${view === "home" ? styles.home : ""}`} id="main">
        {logoutError && (
          <div role="alert" className={styles.error}>
            {logoutError}
            <Button variant="danger" loading={loggingOut} onClick={logout}>
              Coba lagi
            </Button>
          </div>
        )}

        <div className={styles.canvasSheet}>
          {view === "home" ? (
            <AdminPortalHome />
          ) : (
            <>
              <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
                <Link href="/admin">Portal Admin</Link>
                <span aria-hidden="true">/</span>
                {inUserManagement && (
                  <>
                    <Link href="/admin/user-management/users">User Management</Link>
                    <span aria-hidden="true">/</span>
                  </>
                )}
                <span aria-current="page">{title}</span>
              </nav>
              <div className={inUserManagement ? styles.workspace : undefined}>
                {inUserManagement && <UserManagementNav view={view} />}
                <div className={styles.workspaceContent}>
                  <div className={styles.pageHeading}>
                    <h2>{title}</h2>
                    <p>{description}</p>
                  </div>
                  {view === "users" && <UserList currentAdmin={admin} />}
                  {(view === "roles" || view === "permissions") && <RolePermissionViewer key={view} view={view} />}
                  {view === "menus" && <MenuManager />}
                  {view === "settings" && (
                    <section className={styles.settings}>
                      <h3>Akun administrator</h3>
                      <dl>
                        <div>
                          <dt>Nama</dt>
                          <dd>{admin.name}</dd>
                        </div>
                        <div>
                          <dt>Email</dt>
                          <dd>{admin.email}</dd>
                        </div>
                        <div>
                          <dt>Role</dt>
                          <dd>{admin.roles.join(", ") || "Belum ada role"}</dd>
                        </div>
                      </dl>
                      <p>
                        Keluar dari portal admin hanya mengakhiri sesi administrator. Sesi portal karyawan dikelola secara
                        terpisah.
                      </p>
                      <Button variant="secondary" onClick={logout} loading={loggingOut}>
                        Keluar admin
                      </Button>
                    </section>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Floating Action Button (FAB Support & Helpdesk) */}
      <div className={styles.fabContainer} ref={supportRef}>
        {supportOpen && (
          <div
            className={styles.supportPopover}
            role="dialog"
            aria-labelledby="admin-support-title"
            aria-modal="false"
          >
            <div className={styles.supportHeader}>
              <div className={styles.supportHeaderTitle}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span id="admin-support-title">Pusat Bantuan & Layanan IT</span>
              </div>
              <button
                type="button"
                className={styles.supportCloseBtn}
                onClick={() => setSupportOpen(false)}
                aria-label="Tutup pusat bantuan"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className={styles.supportDesc}>
              Memerlukan bantuan teknis, eskalasi izin akses superadmin, atau kendala portal administrasi?
            </p>
            <div className={styles.supportMeta}>
              <div className={styles.supportMetaItem}>
                <span className={styles.supportMetaLabel}>Email Helpdesk</span>
                <a href="mailto:helpdesk@mknsite.online" className={styles.supportMetaValue}>
                  helpdesk@mknsite.online
                </a>
              </div>
              <div className={styles.supportMetaItem}>
                <span className={styles.supportMetaLabel}>Ekstensi</span>
                <span className={styles.supportMetaValue}>Ext. 1010 / 1012</span>
              </div>
              <div className={styles.supportMetaItem}>
                <span className={styles.supportMetaLabel}>Jam Layanan</span>
                <span className={styles.supportMetaValue}>Senin – Jumat (08:00 – 17:00)</span>
              </div>
            </div>
            <a
              href="mailto:helpdesk@mknsite.online?subject=Bantuan%20Portal%20Administrator%20MKN"
              className={styles.supportActionBtn}
            >
              Kirim Tiket Bantuan
            </a>
          </div>
        )}

        <button
          type="button"
          className={styles.fabButton}
          onClick={() => setSupportOpen((prev) => !prev)}
          aria-expanded={supportOpen}
          aria-label="Pusat Bantuan & IT Support"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
