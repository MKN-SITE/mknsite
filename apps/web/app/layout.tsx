import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "MKN Site", template: "%s | MKN Site" },
  description: "Satu ruang kerja untuk HR, operasi telco, workshop, dan proyek."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <a className="skip-link" href="#main">Lewati ke konten</a>
        {children}
      </body>
    </html>
  );
}
