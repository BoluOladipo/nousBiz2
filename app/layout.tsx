import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import DashboardNavigation from "./dashboard/dashboard-navigation";
import PwaInstallPrompt from "./pwa-install-prompt";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NousBiz",
  description: "Business management by Nous Technology Limited.",
  applicationName: "NousBiz",
  appleWebApp: {
    capable: true,
    title: "NousBiz",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <DashboardNavigation />
        <PwaInstallPrompt />
        {children}
      </body>
    </html>
  );
}
