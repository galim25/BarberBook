import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import { SerwistProvider } from "@serwist/next/react";
import { AppUpdater } from "@/components/AppUpdater";
import { InstallPrompt } from "@/components/InstallPrompt";
import { getBuildId } from "@/lib/buildId";
import "./globals.css";

const rubik = Rubik({ subsets: ["hebrew", "latin"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "BarberBook",
  description: "מערכת ניהול תורים למספרה",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BarberBook",
  },
};

export const viewport: Viewport = {
  themeColor: "#508186",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.className} h-full antialiased`}>
      <body className="bg-cream min-h-full flex flex-col">
        <SerwistProvider swUrl="/sw.js" disable={process.env.NODE_ENV !== "production"}>
          {children}
          <InstallPrompt />
          <AppUpdater buildId={getBuildId()} />
        </SerwistProvider>
      </body>
    </html>
  );
}
