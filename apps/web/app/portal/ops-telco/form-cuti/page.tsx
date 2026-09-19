import type { Metadata } from "next";
import { OpsTelcoApp } from "@/features/ops-telco/components/ops-telco-app";

export const metadata: Metadata = { title: "Form Cuti | OPS Telco" };

export default function Page() {
  return <OpsTelcoApp activeSection="form-cuti" />;
}
