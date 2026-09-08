"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";

export function RealtimeStatus({ loginPath }: { loginPath: "/login" | "/admin/login" }) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const stream = new EventSource(`${API_URL}/realtime/events`, { withCredentials: true });
    stream.addEventListener("connected", () => setConnected(true));
    stream.addEventListener("access.updated", () => window.location.reload());
    stream.addEventListener("session.revoked", () => {
      stream.close();
      router.replace(loginPath);
    });
    stream.onerror = () => setConnected(false);
    return () => stream.close();
  }, [loginPath, router]);

  return <span className={`realtime-status ${connected ? "connected" : ""}`} title={connected ? "Pembaruan langsung aktif" : "Menyambungkan pembaruan langsung"}>{connected ? "Live" : "Menyambungkan"}</span>;
}
