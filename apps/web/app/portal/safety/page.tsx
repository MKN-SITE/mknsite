import type { Metadata } from "next";
import { SafetyWorkspace } from "@/features/safety/components/safety-workspace";

export const metadata: Metadata = {
  title: "Safety | MKN Site",
  description: "Pengurusan Permit KPC, Matrix Training, dan Pesan Keselamatan Kerja MKN Site"
};

export default function SafetyPage() {
  return <SafetyWorkspace />;
}
