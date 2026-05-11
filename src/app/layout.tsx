import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "原価計算＋栄養成分表示 MVP",
  description: "洋菓子店・飲食店向けの原価計算と栄養成分表示MVP",
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
