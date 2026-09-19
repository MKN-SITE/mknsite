import type { NextConfig } from "next";

const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const nextConfig: NextConfig = {
  turbopack: {},
  poweredByHeader: false,
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300
      };
    }
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/api-backend/:path*",
        destination: `${apiUrl}/:path*`
      },
      {
        source: "/uploads/:path*",
        destination: `${apiUrl}/uploads/:path*`
      }
    ];
  },
  async redirects() {
    return [
      { source: "/portal/hr", destination: "/portal/ops-telco", permanent: true },
      { source: "/portal/hr/oncall", destination: "/portal/ops-telco/form-oncall", permanent: true },
      { source: "/portal/hr/overtime", destination: "/portal/ops-telco/form-overtime", permanent: true },
      { source: "/portal/hr/cuti", destination: "/portal/ops-telco/form-cuti", permanent: true }
    ];
  }
};

export default nextConfig;
