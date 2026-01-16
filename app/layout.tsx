// app/layout.tsx
import type { Metadata } from "next";
// ★変更: Google Fonts から Inter と Noto Sans JP を読み込む
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"], // 必要な太さを指定
  variable: "--font-noto-sans-jp",
  preload: false,
});

export const metadata: Metadata = {
  title: "GAKU-HUB OS",
  description: "Workspace & Booking Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      {/* ★変更: bodyにフォントクラスを適用 */}
      <body className={`${inter.variable} ${notoSansJP.variable} font-sans bg-gray-50 text-gray-900`}>
        {children}
      </body>
    </html>
  );
}