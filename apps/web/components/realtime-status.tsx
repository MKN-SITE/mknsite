"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { connectRealtime } from "@/lib/sse";
import styles from "./realtime-status.module.css";

export function RealtimeStatus({ loginPath, tone = "default" }: { loginPath: "/login" | "/admin/login"; tone?: "default" | "inverse" }) {
  let router: ReturnType<typeof useRouter> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter();
  } catch {
    // Graceful fallback for non-AppRouter environments (e.g. SSR test runners)
  }
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const context = loginPath === "/admin/login" ? "admin" : "employee";
    const disconnect = connectRealtime(context, {
      onConnected: () => setConnected(true),
      onAccessUpdated: () => window.location.reload(),
      onSessionRevoked: () => {
        if (router) {
          router.replace(loginPath);
        } else if (typeof window !== "undefined") {
          window.location.href = loginPath;
        }
      },
      onError: () => setConnected(false)
    });

    return disconnect;
  }, [loginPath, router]);

  return (
    <span
      className={[styles.status, connected ? styles.connected : "", tone === "inverse" ? styles.inverse : ""].filter(Boolean).join(" ")}
      title={connected ? "Pembaruan langsung aktif" : "Menyambungkan pembaruan langsung"}
    >
      {connected ? "Live" : "Menyambungkan"}
    </span>
  );
}
