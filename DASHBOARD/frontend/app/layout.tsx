import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = IBM_Plex_Sans_Thai({
  variable: "--font-sans",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "แดชบอร์ดปาล์มน้ำมัน",
  description: "เนื้อที่ยืนต้น เนื้อที่ให้ผล ผลผลิต และผลผลิตต่อไร่ของปาล์มน้ำมันไทย รายประเทศ ภาค และจังหวัด จากฐานข้อมูล MySQL",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
