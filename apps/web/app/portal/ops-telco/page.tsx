import type { Metadata } from "next";
import { OpsTelcoApp } from "@/features/ops-telco/components/ops-telco-app";

export const metadata: Metadata = { title: "OPS Telco" };

export default function OpsTelcoPage() {
  return <OpsTelcoApp />;
}
