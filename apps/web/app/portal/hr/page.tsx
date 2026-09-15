import type { Metadata } from "next";
import { HrApp } from "@/features/hr/components/hr-app";

export const metadata: Metadata = { title: "Menu HR" };

export default function HrPage() {
  return <HrApp />;
}
