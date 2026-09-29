import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ayala OS",
  description: "Instagram Intelligence & Content Strategy",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-bg text-ink">{children}</body>
    </html>
  );
}
