import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Work_Sans } from "next/font/google";
import { Pwa } from "@/components/pwa";
import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow-condensed",
});
const body = Work_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-work-sans" });

export const metadata: Metadata = {
  title: { default: "Five Rounds", template: "%s · Five Rounds" },
  description: "Competition prep for grapplers: conditioning, strength, BJJ load, weight and fuel.",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Five Rounds", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4f8" },
    { media: "(prefers-color-scheme: dark)", color: "#14121b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh pr-[max(16px,env(safe-area-inset-right))] pl-[max(16px,env(safe-area-inset-left))] antialiased">
        <Pwa>{children}</Pwa>
      </body>
    </html>
  );
}
