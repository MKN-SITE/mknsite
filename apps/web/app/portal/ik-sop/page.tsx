import type { Metadata } from "next";
import { IkSopApp } from "@/features/ik-sop/components/ik-sop-app";

export const metadata: Metadata = {
  title: "IK & SOP — MKN Site",
  description: "Pusat Instruksi Kerja MKN dan Prosedur Standar KPC"
};

export default function IkSopPage() {
  return <IkSopApp />;
}
