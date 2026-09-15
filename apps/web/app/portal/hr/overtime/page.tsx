import type { Metadata } from "next";
import { HrApp } from "@/features/hr/components/hr-app";

export const metadata: Metadata = { title: "Form Overtime | HR" };

export default function OvertimePage() {
  return <HrApp activeSection="overtime" />;
}
