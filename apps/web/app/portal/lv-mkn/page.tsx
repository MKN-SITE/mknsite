import type { Metadata } from "next";
import { LvWorkspace } from "@/features/lv-mkn/components/lv-workspace";

export const metadata: Metadata = {
  title: "LV MKN | MKN Site",
  description: "Sistem Pelacakan GPS, Kecepatan, dan Commissioning Unit Lapangan MKN Site"
};

export default function LvMknPage() {
  return <LvWorkspace />;
}
