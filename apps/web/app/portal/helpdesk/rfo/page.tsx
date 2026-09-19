import type { Metadata } from "next";
import { HelpdeskApp } from "@/features/helpdesk/components/helpdesk-app";

export const metadata: Metadata = {
  title: "Reason For Outage (RFO) | Portal Helpdesk",
  description: "Laporan resmi investigasi padamnya link dan gangguan jaringan telco"
};

export default function Page() {
  return <HelpdeskApp initialSection="rfo" />;
}
