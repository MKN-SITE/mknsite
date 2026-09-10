import Link from "next/link";
import { PortalIcon } from "@/features/portal/components/portal-icons";
import { userManagementLinks, type AdminView } from "../lib/navigation";
import styles from "./admin-portal.module.css";

export function AdminPortalHome() {
  return (
    <section aria-labelledby="admin-categories">
      <div className={styles.sectionHeading}><div><p className={styles.kicker}>RUANG ADMINISTRASI</p><h2 id="admin-categories">Semua pengaturan, satu tempat.</h2></div><span className={styles.sectionHint}>Pilih kategori untuk mulai mengelola.</span></div>
      <div className={styles.categoryGrid}>
        <Link href="/admin/user-management/users" className={`${styles.category} ${styles.primaryCategory}`}>
          <span className={styles.cardTop}><span className={styles.categoryIcon}><PortalIcon name="users" size={32} /></span><span className={styles.arrow} aria-hidden="true">↗</span></span>
          <span className={styles.categoryName}>User Management</span>
          <span className={styles.categoryDescription}>Kelola akun, peran, dan izin akses tim dalam satu ruang kerja.</span>
          <span className={styles.categoryTags}><span>Pengguna</span><span>Role</span><span>Izin</span></span>
          <span className={styles.categoryFooter}>Buka User Management <span aria-hidden="true">→</span></span>
        </Link>
        <div className={styles.secondaryCategories}>
          <Link href="/admin/menus" className={styles.smallCategory}><span className={styles.smallIcon}><PortalIcon name="folder-kanban" size={24} /></span><span><strong>Menu Portal</strong><span>Atur modul yang tampil di portal karyawan.</span></span><span className={styles.arrow} aria-hidden="true">↗</span></Link>
          <Link href="/admin/settings" className={styles.smallCategory}><span className={styles.smallIcon}><PortalIcon name="settings" size={24} /></span><span><strong>Pengaturan</strong><span>Informasi akun dan sesi administrator.</span></span><span className={styles.arrow} aria-hidden="true">↗</span></Link>
        </div>
      </div>
      <p className={styles.homeNote}><PortalIcon name="shield" size={16} /> Akses administrasi mengikuti izin akun Anda.</p>
    </section>
  );
}

export function UserManagementNav({ view }: { view: AdminView }) {
  return <nav className={styles.moduleNav} aria-label="User Management">
    <div className={styles.moduleIdentity}><span className={styles.smallIcon}><PortalIcon name="users" size={24} /></span><div><strong>User Management</strong><span>Kelola tim & akses</span></div></div>
    <ul className={styles.moduleLinks}>{userManagementLinks.map((link) => <li key={link.view}>
      <Link href={link.href} className={`${styles.moduleLink} ${view === link.view ? styles.activeLink : ""}`} aria-current={view === link.view ? "page" : undefined}>
        <PortalIcon name={link.icon} size={20} /><span><strong>{link.label}</strong><small>{link.description}</small></span>
      </Link>
    </li>)}</ul>
    <p className={styles.navNote}>Tetapkan role melalui detail pengguna untuk mengatur akses tim.</p>
  </nav>;
}
