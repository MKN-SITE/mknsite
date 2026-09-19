import { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Brand } from "./brand";
import { LoginForm } from "./login-form";
import authBgImage from "@/public/assets/hero-workers-drone.jpg";

export function AuthLayout({
  admin = false,
  title,
  subtitle,
  children,
  wide = false,
  backHref = "/",
  backLabel = "Kembali ke halaman publik",
  hideSeparation = false
}: {
  admin?: boolean;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  wide?: boolean;
  backHref?: string;
  backLabel?: string;
  hideSeparation?: boolean;
}) {
  const displayTitle = title ?? (admin ? "Login Admin" : "Selamat datang");
  const displaySubtitle = subtitle ?? (admin ? "Gunakan kredensial administrator yang terpisah." : "Masuk untuk membuka ruang kerja Anda.");

  return (
    <main className="auth-page" id="main">
      <aside className="auth-aside" aria-hidden="true">
        <Image src={authBgImage} alt="Operasi Lapangan PT Multi Kontrol Nusantara" fill sizes="50vw" priority />
        <div className="auth-aside-content">
          <Brand />
          <div className="auth-aside-copy">
            <h2>{admin ? "Kontrol sistem tetap terpisah." : "Pekerjaan penting, dalam satu tempat."}</h2>
            <p>{admin ? "Ruang khusus untuk mengelola akses, role, menu, pengguna, dan perubahan sistem." : "Masuk menggunakan akun kerja. Modul yang tersedia mengikuti role dan tanggung jawab Anda."}</p>
          </div>
        </div>
      </aside>
      <section className="auth-main">
        <div className={`auth-card ${wide ? "auth-card-wide" : ""}`}>
          <Link className="auth-back" href={backHref}>{backLabel}</Link>
          <h1>{displayTitle}</h1>
          {displaySubtitle && <p className="auth-subtitle">{displaySubtitle}</p>}
          {children ?? <LoginForm admin={admin} />}
          {!hideSeparation && !children && (
            <div className="admin-separation">
              {admin ? "Login ini tidak menggunakan sesi karyawan. " : "Perlu mengatur pengguna atau izin? "}
              <Link href={admin ? "/login" : "/admin/login"}>{admin ? "Login sebagai karyawan" : "Buka login admin"}</Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
