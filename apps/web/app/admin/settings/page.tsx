import type { Metadata } from "next";
import { AdminApp } from "@/components/admin-app";
export const metadata: Metadata = { title: "Pengaturan | Admin" };
export default function Page() { return <AdminApp view="settings" />; }
