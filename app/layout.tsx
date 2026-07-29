import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/ToastProvider";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "WAZIQOH Super App V4.0",
  description: "Sistem Manajemen Zakat, Infaq, Shodaqoh & Muamalah KMB Mesir",
  icons: {
    icon: [
      { url: "https://dsjkuzirvaniunhwwnml.supabase.co/storage/v1/object/public/assets/icon.png", sizes: "any" },
    ],
    apple: [
      { url: "https://dsjkuzirvaniunhwwnml.supabase.co/storage/v1/object/public/assets/icon.png" },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="icon" href="https://dsjkuzirvaniunhwwnml.supabase.co/storage/v1/object/public/assets/icon.png" />
        <link rel="apple-touch-icon" href="https://dsjkuzirvaniunhwwnml.supabase.co/storage/v1/object/public/assets/icon.png" />
      </head>
      <body className={inter.className}>
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}