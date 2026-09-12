import Link from "next/link";
import { PortalIcon } from "@/features/portal/components/portal-icons";
import { userManagementLinks, type AdminView } from "../lib/navigation";
import { useUsers } from "../hooks/use-users";
import { useRoles } from "../hooks/use-roles";
import { useMenus } from "../hooks/use-menus";
import styles from "./admin-portal.module.css";

export function AdminPortalHome() {
  const { pagination: userPagination, loading: usersLoading } = useUsers({ pageSize: 1 });
  const { roles, loading: rolesLoading } = useRoles();
  const { menus, loading: menusLoading } = useMenus();

  return (
    <section aria-labelledby="admin-categories">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.kicker}>RUANG ADMINISTRASI</p>
          <h2 id="admin-categories">Semua pengaturan, satu tempat.</h2>
        </div>
        <span className={styles.sectionHint}>Pilih kategori untuk mulai mengelola.</span>
      </div>

      <div className={styles.summaryBar}>
        <div className={styles.summaryItem}>
          <div className={styles.summaryIcon}>
            <PortalIcon name="users" size={22} />
          </div>
          <div className={styles.summaryText}>
            <strong>Manajemen Akses</strong>
            <span>
              {usersLoading || rolesLoading
                ? "Kelola akun pengguna, penetapan role, dan izin sistem RBAC"
                : `${userPagination.total} Pengguna • ${roles.length} Role Terdaftar`}
            </span>
          </div>
        </div>
        <div className={styles.summaryDivider} aria-hidden="true" />
        <div className={styles.summaryItem}>
          <div className={`${styles.summaryIcon} ${styles.menuIconWrap}`}>
            <PortalIcon name="folder-kanban" size={22} />
          </div>
          <div className={styles.summaryText}>
            <strong>Modul Portal</strong>
            <span>
              {menusLoading
                ? "Tata letak modul dinamis & indikator lencana portal karyawan"
                : `${menus.length} Modul Aktif Terintegrasi`}
            </span>
          </div>
        </div>
        <div className={styles.summaryDivider} aria-hidden="true" />
        <div className={styles.summaryItem}>
          <div className={`${styles.summaryIcon} ${styles.settingsIconWrap}`}>
            <PortalIcon name="shield" size={22} />
          </div>
          <div className={styles.summaryText}>
            <strong>Keamanan &amp; Audit</strong>
            <span>Proteksi Superadministrator dan audit log sistem aktif</span>
          </div>
        </div>
      </div>

      <div className={styles.categoryGrid}>
        {/* Category 1: User Management */}
        <Link href="/admin/user-management/users" className={styles.category}>
          <div className={styles.cardTop}>
            <div className={styles.categoryIcon}>
              <PortalIcon name="users" size={26} />
            </div>
            <span className={styles.arrow} aria-hidden="true">↗</span>
          </div>
          <span className={styles.categoryName}>User Management</span>
          <span className={styles.categoryDescription}>
            Kelola akun pengguna, penetapan peran, dan matriks izin akses tim.
          </span>
          <div className={styles.categoryTags}>
            <span>Pengguna</span>
            <span>Role</span>
            <span>Izin</span>
          </div>
          <div className={styles.categoryFooter}>
            <span>Buka User Management</span>
            <span aria-hidden="true">→</span>
          </div>
        </Link>

        {/* Category 2: Menu Portal */}
        <Link href="/admin/menus" className={styles.category}>
          <div className={styles.cardTop}>
            <div className={styles.categoryIcon}>
              <PortalIcon name="folder-kanban" size={26} />
            </div>
            <span className={styles.arrow} aria-hidden="true">↗</span>
          </div>
          <span className={styles.categoryName}>Menu Portal</span>
          <span className={styles.categoryDescription}>
            Atur modul dinamis, tautan operasional, dan urutan portal karyawan.
          </span>
          <div className={styles.categoryTags}>
            <span>Modul</span>
            <span>Urutan</span>
            <span>Lencana</span>
          </div>
          <div className={styles.categoryFooter}>
            <span>Buka Menu Portal</span>
            <span aria-hidden="true">→</span>
          </div>
        </Link>

        {/* Category 3: Pengaturan */}
        <Link href="/admin/settings" className={styles.category}>
          <div className={styles.cardTop}>
            <div className={styles.categoryIcon}>
              <PortalIcon name="settings" size={26} />
            </div>
            <span className={styles.arrow} aria-hidden="true">↗</span>
          </div>
          <span className={styles.categoryName}>Pengaturan</span>
          <span className={styles.categoryDescription}>
            Tinjau profil admin, hak akses aktif, dan konfigurasi keamanan sesi.
          </span>
          <div className={styles.categoryTags}>
            <span>Sesi</span>
            <span>Akun</span>
            <span>Keamanan</span>
          </div>
          <div className={styles.categoryFooter}>
            <span>Buka Pengaturan</span>
            <span aria-hidden="true">→</span>
          </div>
        </Link>
      </div>

      <p className={styles.homeNote}>
        <PortalIcon name="shield" size={16} /> Akses administrasi mengikuti izin akun Anda.
      </p>
    </section>
  );
}

export function UserManagementNav({ view }: { view: AdminView }) {
  return (
    <nav className={styles.moduleNav} aria-label="User Management">
      <div className={styles.moduleIdentity}>
        <span className={styles.smallIcon}>
          <PortalIcon name="users" size={24} />
        </span>
        <div>
          <strong>User Management</strong>
          <span>Kelola tim &amp; akses</span>
        </div>
      </div>
      <ul className={styles.moduleLinks}>
        {userManagementLinks.map((link) => (
          <li key={link.view}>
            <Link
              href={link.href}
              className={`${styles.moduleLink} ${view === link.view ? styles.activeLink : ""}`}
              aria-current={view === link.view ? "page" : undefined}
            >
              <PortalIcon name={link.icon} size={20} />
              <span>
                <strong>{link.label}</strong>
                <small>{link.description}</small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className={styles.navNote}>Tetapkan role melalui detail pengguna untuk mengatur akses tim.</p>
    </nav>
  );
}
