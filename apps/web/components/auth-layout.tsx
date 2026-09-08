import Image from "next/image";
import Link from "next/link";
import { Brand } from "./brand";
import { LoginForm } from "./login-form";
import heroImage from "@/public/assets/hero-operations.png";

export function AuthLayout({ admin = false }: { admin?: boolean }) {
  return (
    <main className="auth-page" id="main">
      <aside className="auth-aside" aria-hidden="true">
        <Image src={heroImage} alt="" fill sizes="50vw" />
        <div className="auth-aside-content">
          <Brand />
          <div className="auth-aside-copy">
            <h2>{admin ? "Kontrol sistem tetap terpisah." : "Pekerjaan penting, dalam satu tempat."}</h2>
            <p>{admin ? "Ruang khusus untuk mengelola akses, role, menu, pengguna, dan perubahan sistem." : "Masuk menggunakan akun kerja. Modul yang tersedia mengikuti role dan tanggung jawab Anda."}</p>
          </div>
        </div>
      </aside>
      <section className="auth-main">
        <div className="auth-card">
          <Link className="auth-back" href="/">Kembali ke halaman publik</Link>
          <h1>{admin ? "Login Admin" : "Selamat datang"}</h1>
          <p className="auth-subtitle">{admin ? "Gunakan kredensial administrator yang terpisah." : "Masuk untuk membuka ruang kerja Anda."}</p>
          <LoginForm admin={admin} />
          <div className="admin-separation">
            {admin ? "Login ini tidak menggunakan sesi portal karyawan. " : "Perlu mengatur pengguna atau izin? "}
            <Link href={admin ? "/login" : "/admin/login"}>{admin ? "Login sebagai karyawan" : "Buka login admin"}</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
