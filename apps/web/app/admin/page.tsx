import type { Metadata } from "next";
import { AdminApp } from "@/components/admin-app";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return <AdminApp />;
}
