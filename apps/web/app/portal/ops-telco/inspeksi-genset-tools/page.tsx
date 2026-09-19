import type { Metadata } from "next";
import { OpsTelcoApp } from "@/features/ops-telco/components/ops-telco-app";

export const metadata: Metadata = {
  title: "Inspeksi Genset Tool | OPS Telco"
};

export default function Page() {
  return <OpsTelcoApp activeSection="inspeksi-genset-tools" />;
}
