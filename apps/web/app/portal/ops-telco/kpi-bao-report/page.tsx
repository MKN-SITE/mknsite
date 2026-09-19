import type { Metadata } from "next";
import { OpsTelcoApp } from "@/features/ops-telco/components/ops-telco-app";

export const metadata: Metadata = {
  title: "KPI & BAO Sangatta Report | OPS Telco"
};

export default function Page() {
  return <OpsTelcoApp activeSection="kpi-bao-report" />;
}
