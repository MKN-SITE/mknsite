import type { Metadata } from "next";
import { ModuleComingSoon } from "@/components/module-coming-soon";

export const metadata: Metadata = {
  title: "Manajemen Proyek — MKN Site",
  description: "Modul Manajemen Proyek dan Milestone PT Multi Kontrol Nusantara"
};

export default function ProjectPage() {
  return (
    <ModuleComingSoon
      title="Modul Proyek Sedang Dikembangkan"
      moduleName="Manajemen Proyek"
      description="Fitur pelacakan timeline pekerjaan, progress mingguan, alokasi manpower, dan pelaporan milestone proyek klien sedang disiapkan untuk rilis berikutnya."
      iconSvg={
        <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      }
    />
  );
}
