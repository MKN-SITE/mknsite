import type { Metadata } from "next";
import { HelpdeskApp } from "@/features/helpdesk/components/helpdesk-app";

export const metadata: Metadata = {
  title: "Tiket Gangguan & Layanan | Portal Helpdesk",
  description: "Daftar tiket gangguan operasional dan permintaan bantuan teknis"
};

export default function Page() {
  return <HelpdeskApp initialSection="tickets" />;
}
