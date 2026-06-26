import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "パティスリー経営ナビ",
  title: "パティスリー経営ナビ",
  description:
    "原価計算・レジ売上・粗利分析・商圏分析をもとに、洋菓子店の経営判断をサポートするアプリです。",
  appleWebApp: {
    capable: true,
    title: "パティスリー経営ナビ",
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/patisserie-keiei-navi-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "パティスリー経営ナビ",
    description:
      "原価・売上・粗利・商圏から、次の一手が見える。小さな洋菓子店のためのAI経営判断アプリ。",
    type: "website",
    locale: "ja_JP",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
