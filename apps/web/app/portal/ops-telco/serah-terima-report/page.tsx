import type { Metadata } from "next";
import { OpsTelcoApp } from "@/features/ops-telco/components/ops-telco-app";

export const metadata: Metadata = {
  title: "Laporan Serah Terima | OPS Telco"
};

export default function Page() {
  return <OpsTelcoApp activeSection="serah-terima-report" />;
}
