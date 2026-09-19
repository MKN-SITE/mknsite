import type { Metadata } from "next";
import { OpsTelcoApp } from "@/features/ops-telco/components/ops-telco-app";

export const metadata: Metadata = {
  title: "Inspeksi Double Lanyard | OPS Telco"
};

export default function Page() {
  return <OpsTelcoApp activeSection="inspeksi-double-lanyard" />;
}
