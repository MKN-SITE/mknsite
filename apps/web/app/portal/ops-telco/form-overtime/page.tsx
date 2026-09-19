import type { Metadata } from "next";
import { OpsTelcoApp } from "@/features/ops-telco/components/ops-telco-app";

export const metadata: Metadata = { title: "Form Overtime | OPS Telco" };

export default function Page() {
  return <OpsTelcoApp activeSection="form-overtime" />;
}
