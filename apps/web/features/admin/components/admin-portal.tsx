import Link from "next/link";
import { PortalIcon } from "@/features/portal/components/portal-icons";
import { userManagementLinks, type AdminView } from "../lib/navigation";
import styles from "./admin-portal.module.css";

export function AdminPortalHome() {
  return (
    <section aria-labelledby="admin-categories">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.kicker}>RUANG ADMINISTRASI</p>
          <h2 id="admin-categories">Semua pengaturan, satu tempat.</h2>
        </div>
        <span className={styles.sectionHint}>Pilih kategori untuk mulai mengelola.</span>
      </div>

      <div className={styles.categoryGrid}>
        {/* Category 1: User Management */}
        <Link href="/admin/user-management/users" className={`${styles.category} ${styles.primaryCategory}`}>
          <div className={styles.cardTop}>
            <div className={styles.categoryIcon}>
              <PortalIcon name="users" size={32} />
            </div>
            <span className={styles.arrow} aria-hidden="true">↗</span>
          </div>
          <span className={styles.categoryName}>User Management</span>
          <span className={styles.categoryDescription}>
            Kelola akun, peran, dan izin akses tim dalam satu ruang kerja.
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
            <div className={`${styles.categoryIcon} ${styles.menuIconWrap}`}>
              <PortalIcon name="folder-kanban" size={32} />
            </div>
            <span className={styles.arrow} aria-hidden="true">↗</span>
          </div>
          <span className={styles.categoryName}>Menu Portal</span>
          <span className={styles.categoryDescription}>
            Atur modul yang tampil di portal karyawan.
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
            <div className={`${styles.categoryIcon} ${styles.settingsIconWrap}`}>
              <PortalIcon name="settings" size={32} />
            </div>
            <span className={styles.arrow} aria-hidden="true">↗</span>
          </div>
          <span className={styles.categoryName}>Pengaturan</span>
          <span className={styles.categoryDescription}>
            Informasi akun dan sesi administrator.
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
