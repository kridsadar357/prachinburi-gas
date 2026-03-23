import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ค้นหาปั๊มน้ำมันปราจีนบุรี - PWA",
  description: "ค้นหาปั๊มน้ำมันในจังหวัดปราจีนบุรี พร้อมสถานะความพร้อมน้ำมันแบบเรียลไทม์ ขับเคลื่อนโดย Crowdsourcing",
  keywords: ["ปั๊มน้ำมัน", "ปราจีนบุรี", "ประเทศไทย", "น้ำมัน", "PWA", "คราวด์ซอร์สซิง"],
  authors: [{ name: "ทีมค้นหาปั๊มน้ำมัน" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ค้นหาปั๊มน้ำมัน"
  },
  formatDetection: {
    telephone: false
  },
  openGraph: {
    title: "ค้นหาปั๊มน้ำมันปราจีนบุรี",
    description: "ค้นหาปั๊มน้ำมันในจังหวัดปราจีนบุรี พร้อมสถานะความพร้อมน้ำมันแบบเรียลไทม์",
    type: "website",
    locale: "th_TH"
  },
  twitter: {
    card: "summary_large_image",
    title: "ค้นหาปั๊มน้ำมันปราจีนบุรี",
    description: "ค้นหาปั๊มน้ำมันในจังหวัดปราจีนบุรี พร้อมสถานะความพร้อมน้ำมันแบบเรียลไทม์",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#10b981" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" }
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-hidden`}
      >
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
