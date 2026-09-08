import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth-layout";

export const metadata: Metadata = { title: "Login Admin" };

export default function AdminLoginPage() {
  return <AuthLayout admin />;
}
