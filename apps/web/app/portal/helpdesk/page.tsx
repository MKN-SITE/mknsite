import type { Metadata } from "next";
import { HelpdeskApp } from "@/features/helpdesk/components/helpdesk-app";

export const metadata: Metadata = {
  title: "Portal Helpdesk | MKN Site",
  description: "Pusat Layanan Bantuan IT, Tiket Gangguan, dan Pelaporan Reason For Outage (RFO)"
};

export default function Page() {
  return <HelpdeskApp initialSection="dashboard" />;
}
