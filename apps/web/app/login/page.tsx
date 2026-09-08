import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth-layout";

export const metadata: Metadata = { title: "Login Karyawan" };

export default function LoginPage() {
  return <AuthLayout />;
}
