import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/brand";
import heroImage from "@/public/assets/hero-operations.png";

export default function PublicPage() {
  return (
    <>
      <header className="public-nav">
        <Brand />
        <nav className="nav-actions" aria-label="Navigasi utama">
          <a className="text-link" href="#kapabilitas">Kapabilitas</a>
          <Link className="button button-primary" href="/login">Masuk portal</Link>
        </nav>
      </header>
      <main id="main">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Satu ruang kerja operasional</p>
            <h1>Tim bergerak dengan <span>arah yang sama.</span></h1>
            <p>Kelola pekerjaan HR, operasi telco, workshop, dan proyek dalam satu portal terkontrol.</p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/login">Masuk ke portal</Link>
              <a className="button button-secondary" href="#kapabilitas">Pelajari sistem</a>
            </div>
          </div>
          <div className="hero-media">
            <Image src={heroImage} alt="Teknisi telekomunikasi memeriksa pekerjaan lapangan melalui tablet" priority sizes="(max-width: 900px) 100vw, 55vw" />
            <div className="hero-note"><strong>Akses sesuai tanggung jawab</strong><span>Setiap anggota tim hanya melihat modul dan data yang diizinkan.</span></div>
          </div>
        </section>
        <section className="public-section" id="kapabilitas">
          <h2>Dari administrasi sampai pekerjaan lapangan.</h2>
          <p className="section-intro">Informasi penting tetap dekat dengan tim yang membutuhkannya, sementara kontrol sistem berada di ruang admin tersendiri.</p>
          <div className="capability-grid">
            <article className="capability"><span className="capability-code">OPS</span><h3>Operasi Telco dan Workshop</h3><p>Pantau aktivitas site, preventive maintenance, peralatan, material, dan pekerjaan workshop tanpa mencampur hak akses antarunit.</p></article>
            <article className="capability"><span className="capability-code">HR</span><h3>Human Resources</h3><p>Kelola data karyawan, kehadiran, cuti, dan dokumen personalia.</p></article>
            <article className="capability"><span className="capability-code">PRJ</span><h3>Project</h3><p>Satukan progres, penanggung jawab, dokumen, dan tindak lanjut proyek.</p></article>
          </div>
        </section>
      </main>
      <footer className="public-footer"><span>© 2026 MKN Site</span><Link href="/admin/login">Akses administrator</Link></footer>
    </>
  );
}
