"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, PortalUser } from "@/lib/api";
import { connectRealtime } from "@/lib/sse";
import { MenuGrid } from "@/features/portal/components/menu-grid";

export function PortalApp() {
  const router = useRouter();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: PortalUser }>("/auth/me")
      .then(({ user }) => setUser(user))
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  // Realtime session management: if session.revoked, redirect to login
  useEffect(() => {
    const disconnect = connectRealtime("employee", {
      onSessionRevoked: () => {
        router.replace("/login");
      }
    });

    return () => {
      disconnect();
    };
  }, [router]);

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="loading-page">
        <div className="loading-block" />
        <div className="loading-block short" />
      </main>
    );
  }

  if (!user) return null;

  return <MenuGrid user={user} onLogout={logout} />;
}

