import type { Metadata } from "next";
import { MasterSistemApp } from "@/features/master-sistem/components/master-sistem-app";

export const metadata: Metadata = {
  title: "Portal Master Sistem | MKN Site",
  description: "Pusat Data Master Perusahaan, Infrastruktur Site, dan List Tower Telekomunikasi"
};

export default function MasterSistemPage() {
  return <MasterSistemApp />;
}
