import type { Metadata } from "next";
import { PersonalWorkspace } from "@/features/personal/components/personal-workspace";

export const metadata: Metadata = {
  title: "Personal | MKN Site",
  description: "Data diri personal, riwayat kontrak kerja, dan status perpanjangan kontrak karyawan MKN Site"
};

export default function PersonalPage() {
  return <PersonalWorkspace />;
}
