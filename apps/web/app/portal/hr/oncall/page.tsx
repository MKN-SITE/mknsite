import type { Metadata } from "next";
import { HrApp } from "@/features/hr/components/hr-app";

export const metadata: Metadata = { title: "Form Oncall | HR" };

export default function OncallPage() {
  return <HrApp activeSection="oncall" />;
}
