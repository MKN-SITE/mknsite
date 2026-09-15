import type { Metadata } from "next";
import { HrApp } from "@/features/hr/components/hr-app";

export const metadata: Metadata = { title: "Form Cuti | HR" };

export default function CutiPage() {
  return <HrApp activeSection="cuti" />;
}
