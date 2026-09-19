import type { Metadata } from "next";
import { OpsTelcoApp } from "@/features/ops-telco/components/ops-telco-app";

export const metadata: Metadata = {
  title: "Inspeksi Padlock | OPS Telco"
};

export default function Page() {
  return <OpsTelcoApp activeSection="inspeksi-padlock" />;
}
