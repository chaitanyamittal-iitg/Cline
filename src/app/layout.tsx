import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAFAL | Software with integrated AI for Adaptive Learning",
  description: "Adaptive learning for Classes 6-8 science: electricity and circuits.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
