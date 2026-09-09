"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { connectRealtime } from "@/lib/sse";

export function RealtimeStatus({ loginPath }: { loginPath: "/login" | "/admin/login" }) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const context = loginPath === "/admin/login" ? "admin" : "employee";
    const disconnect = connectRealtime(context, {
      onConnected: () => setConnected(true),
      onAccessUpdated: () => window.location.reload(),
      onSessionRevoked: () => {
        router.replace(loginPath);
      },
      onError: () => setConnected(false)
    });

    return disconnect;
  }, [loginPath, router]);

  return (
    <span
      className={`realtime-status ${connected ? "connected" : ""}`}
      title={connected ? "Pembaruan langsung aktif" : "Menyambungkan pembaruan langsung"}
    >
      {connected ? "Live" : "Menyambungkan"}
    </span>
  );
}
