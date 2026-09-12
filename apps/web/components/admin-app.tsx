"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

let cachedAdmin: PortalUser | null = null;
let inFlightAdminMe: Promise<PortalUser> | null = null;

export function clearAdminSessionCache() {
  cachedAdmin = null;
  inFlightAdminMe = null;
}

export function AdminApp({ view = "home" }: { view?: AdminView }) {
  const router = useRouter();
  const [admin, setAdmin] = useState<PortalUser | null>(() => cachedAdmin);
  const [loading, setLoading] = useState<boolean>(() => cachedAdmin === null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (cachedAdmin === null) {
      setLoading(true);
    }
    setError(null);

    const req = inFlightAdminMe || (inFlightAdminMe = api<{ user: PortalUser }>("/auth/admin/me")
      .then(({ user }) => {
        cachedAdmin = user;
        inFlightAdminMe = null;
        return user;
      })
      .catch((err) => {
        inFlightAdminMe = null;
        throw err;
      }));

    req
      .then((user) => {
        if (!active) return;
        setAdmin(user);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 401) {
          cachedAdmin = null;
          router.replace("/admin/login");
        } else if (!cachedAdmin) {
          setError("Portal admin belum dapat dimuat. Periksa koneksi lalu coba lagi.");
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router, attempt]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await api("/auth/admin/logout", { method: "POST" });
      clearAdminSessionCache();
      router.replace("/admin/login");
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        clearAdminSessionCache();
        router.replace("/admin/login");
      } else {
        setLogoutError("Gagal keluar. Sesi Anda masih aktif; silakan coba lagi.");
      }
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
                    <Link href="/admin/user-management/users" scroll={false}>User Management</Link>
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
                  {(view === "roles" || view === "permissions") && (
                    <RolePermissionViewer
                      key={view}
                      view={view}
                      canManage={admin.permissions.includes("admin.security.manage")}
                    />
                  )}
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

    </div>
  );
}
