import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Analytics } from "@vercel/analytics/next";
import { StructuredData } from "@/components/structured-data";
import { generateSEOMetadata } from "@/lib/seo";
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  ...generateSEOMetadata({
    title: "Shadway - Curated Shadcn UI Website Collection",
    description: "Discover beautiful websites and components built with Shadcn UI. A curated collection of modern interfaces and design inspiration for developers and designers.",
    keywords: [
      "shadcn ui figma",
      "Shadway",
      "Shadway Shadcn",
      "Shadcn shadway",
      "Shadcn docs",
      "Shadcn components",
      "Shadcn latest",
      "shadcn/ui install",
      "shadcn ui theme generator",
      "shadcn ui templates",
      "react component library",
      "shadcn card component",
      "shadcn install components",
      "music player component in react js",
      "react carousel component",
      "react pure component",
      "react dynamic component",
      "shadcn figma",
    ],
  }),
  other: {
    'application-name': 'Shadway',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'Shadway',
    'format-detection': 'telephone=no',
    'mobile-web-app-capable': 'yes',
    'msapplication-config': '/browserconfig.xml',
    'msapplication-TileColor': '#000000',
    'msapplication-tap-highlight': 'no',
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Shadway RSS Feed"
          href="/feed.xml"
        />
        <link
          rel="alternate"
          type="application/feed+json"
          title="Shadway JSON Feed"
          href="/feed.json"
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <Providers>
          <StructuredData type="website" />
          <StructuredData type="organization" />
          {children}
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
