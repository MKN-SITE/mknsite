"use client";

import Link from "next/link";
import { Brand } from "./brand";

interface ModuleComingSoonProps {
  title: string;
  moduleName: string;
  description: string;
  iconSvg?: React.ReactNode;
}

export function ModuleComingSoon({
  title,
  moduleName,
  description,
  iconSvg
}: ModuleComingSoonProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #0b0f19 0%, #111827 50%, #0f172a 100%)",
        color: "#f8fafc",
        fontFamily: "system-ui, -apple-system, sans-serif"
      }}
    >
      {/* Top Navbar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          backdropFilter: "blur(12px)",
          background: "rgba(15, 23, 42, 0.6)"
        }}
      >
        <Brand />
        <Link
          href="/portal"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 500,
            color: "#94a3b8",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            textDecoration: "none",
            transition: "all 0.2s"
          }}
        >
          ← Kembali ke Portal
        </Link>
      </header>

      {/* Main Content Card */}
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px"
        }}
      >
        <div
          style={{
            maxWidth: "540px",
            width: "100%",
            textAlign: "center",
            padding: "48px 32px",
            borderRadius: "16px",
            background: "rgba(30, 41, 59, 0.7)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(16px)"
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              margin: "0 auto 24px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(234, 88, 12, 0.2) 0%, rgba(249, 115, 22, 0.05) 100%)",
              border: "1px solid rgba(249, 115, 22, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fb923c"
            }}
          >
            {iconSvg || (
              <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            )}
          </div>

          <span
            style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: "9999px",
              fontSize: "12px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              background: "rgba(249, 115, 22, 0.15)",
              color: "#fb923c",
              border: "1px solid rgba(249, 115, 22, 0.3)",
              marginBottom: "16px"
            }}
          >
            {moduleName} • Segera Hadir
          </span>

          <h1
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "#f8fafc",
              marginBottom: "12px",
              letterSpacing: "-0.02em"
            }}
          >
            {title}
          </h1>

          <p
            style={{
              fontSize: "15px",
              lineHeight: 1.6,
              color: "#94a3b8",
              marginBottom: "32px"
            }}
          >
            {description}
          </p>

          <Link
            href="/portal"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "12px 28px",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
              boxShadow: "0 4px 14px rgba(234, 88, 12, 0.35)",
              textDecoration: "none",
              transition: "transform 0.15s, box-shadow 0.15s"
            }}
          >
            Kembali ke Beranda Portal
          </Link>
        </div>
      </main>
    </div>
  );
}
