import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IntelliDoc AI",
  description: "AI-powered document intelligence platform for OCR, quality checks, translation, search, and print recommendations."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
