import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/brand";
import heroWorkers from "@/public/assets/hero-workers.jpg";
import climbersImg from "@/public/assets/field-climbers.png";
import droneImg from "@/public/assets/hero-workers-drone.jpg";
import wideImg from "@/public/assets/hero-workers-wide.jpg";
import surveyImg from "@/public/assets/field-survey.png";

export default function PublicPage() {
  return (
    <>
      <header className="public-nav">
        <Brand />
        <nav className="nav-actions" aria-label="Navigasi utama">
          <a className="text-link" href="#kapabilitas">Kapabilitas</a>
          <a className="text-link" href="#operasi-lapangan">Operasi Lapangan</a>
          <Link className="button button-primary" href="/login">Masuk portal</Link>
        </nav>
      </header>
      <main id="main">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Satu ruang kerja operasional</p>
            <h1>Tim bergerak dengan <span>arah yang sama.</span></h1>
            <p>Kelola pekerjaan HR, operasi telco, workshop, dan proyek dalam satu portal terkontrol PT Multi Kontrol Nusantara.</p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/login">Masuk ke portal</Link>
              <a className="button button-secondary" href="#operasi-lapangan">Lihat dokumentasi lapangan</a>
            </div>
          </div>
          <div className="hero-media">
            <Image
              src={heroWorkers}
              alt="Teknisi telekomunikasi PT Multi Kontrol Nusantara melakukan instalasi dan alignment antena microwave di tower site"
              priority
              sizes="(max-width: 900px) 100vw, 55vw"
            />
            <div className="hero-note">
              <strong>Operasi Lapangan PT MKN</strong>
              <span>Teknisi telekomunikasi dalam aktivitas alignment & pemeliharaan tower site.</span>
            </div>
          </div>
        </section>

        <section className="public-section" id="operasi-lapangan">
          <div className="section-header">
            <p className="eyebrow">Infrastruktur & Lapangan</p>
            <h2>Dokumentasi Pekerja & Aktivitas Site</h2>
            <p className="section-intro">Dedikasi tim PT Multi Kontrol Nusantara menjaga keandalan jaringan telekomunikasi dan fasilitas operasional di seluruh wilayah kerja.</p>
          </div>
          <div className="field-grid">
            <article className="field-card">
              <div className="field-image-wrap hex-wrap">
                <Image src={climbersImg} alt="Tim rigger tower PT MKN bersertifikasi keselamatan kerja" className="field-image hex-image" />
              </div>
              <div className="field-info">
                <span className="field-tag">Rigging & Climbing</span>
                <h3>Teknisi Ketinggian Tower</h3>
                <p>Pekerjaan berkualifikasi tinggi dengan standar K3 ketat untuk instalasi, rigging, dan perawatan struktur tower telekomunikasi.</p>
              </div>
            </article>

            <article className="field-card">
              <div className="field-image-wrap">
                <Image src={droneImg} alt="Inspeksi transmisi dan antena repeater melalui pantauan udara" className="field-image" />
              </div>
              <div className="field-info">
                <span className="field-tag">Aerial Survey</span>
                <h3>Pemantauan Link Radio</h3>
                <p>Inspeksi berkala pada tower transmisi, feeder, dan sistem antenna repeater di area perbukitan dan remote site.</p>
              </div>
            </article>

            <article className="field-card">
              <div className="field-image-wrap hex-wrap">
                <Image src={surveyImg} alt="Tim teknisi survey ground infrastructure dan shelter tower site" className="field-image hex-image" />
              </div>
              <div className="field-info">
                <span className="field-tag">Site Engineering</span>
                <h3>Ground Survey & Shelter</h3>
                <p>Verifikasi rutin kondisi shelter, perangkat catudaya, grounding, dan stabilitas struktur tapak tower di lapangan.</p>
              </div>
            </article>

            <article className="field-card">
              <div className="field-image-wrap">
                <Image src={wideImg} alt="Alignment perangkat microwave link di tower platform" className="field-image" />
              </div>
              <div className="field-info">
                <span className="field-tag">Microwave OSP</span>
                <h3>Alignment Microwave Dish</h3>
                <p>Optimalisasi pointing antena microwave link untuk menjamin performa konektivitas data dan komunikasi operasional bebas gangguan.</p>
              </div>
            </article>
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
      <footer className="public-footer"><span>© 2026 PT Multi Kontrol Nusantara — MKN Site</span><Link href="/admin/login">Akses administrator</Link></footer>
    </>
  );
}
