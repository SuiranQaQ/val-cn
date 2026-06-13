import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClientRootProviders } from "@/components/client/ClientRootProviders";
import { isClientApp } from "@/lib/app-mode";
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
  title: isClientApp() ? "VALBOX" : "Valorant 国服战绩查询 - VAL CN",
  description:
    "Valorant 国服战绩查询与报告工具。作者隋然，公益开发请勿滥用。",
  authors: [{ name: "隋然" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const client = isClientApp();

  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased ${client ? "overflow-hidden" : ""}`}
    >
      <body
        className={`bg-[#0b1725] font-sans text-white ${client ? "h-full overflow-hidden" : "min-h-full"}`}
      >
        <ClientRootProviders>{children}</ClientRootProviders>
      </body>
    </html>
  );
}
