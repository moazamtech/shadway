import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import "@vscode/codicons/dist/codicon.css";
import { Providers } from "@/components/providers";
import { Analytics } from "@vercel/analytics/next";
import { StructuredData } from "@/components/structured-data";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { generateSEOMetadata } from "@/lib/seo";
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  ...generateSEOMetadata({
    title: "Shadway | Shadcn UI Inspiration, Components, and Templates",
    description:
      "Discover curated Shadcn UI websites, reusable components, docs, and AI-generated blocks to build modern React and Next.js interfaces faster.",
    keywords: [
      "shadway",
      "shadcn ui inspiration",
      "shadcn ui examples",
      "shadcn ui components",
      "shadcn ui docs",
      "shadcn ui component library",
      "shadcn ui website templates",
      "shadcn ui blocks",
      "shadcn ui snippets",
      "shadcn ui sections",
      "shadcn ui registry",
      "shadcn/ui install",
      "shadcn ui templates",
      "react component library",
      "next.js ui components",
      "nextjs component library",
      "nextjs shadcn components",
      "tailwind css components",
      "tailwind ui components",
      "tailwind react components",
      "typescript react components",
      "ai component generator",
      "ai ui generator",
      "ai code generation for react",
      "vibecode components",
      "component generator for nextjs",
      "modern ui components",
      "responsive ui components",
      "production ready ui components",
      "frontend design inspiration",
      "website ui showcase",
    ],
  }),
  other: {
    "application-name": "Shadway",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "Shadway",
    "format-detection": "telephone=no",
    "mobile-web-app-capable": "yes",
    "msapplication-config": "/browserconfig.xml",
    "msapplication-TileColor": "#000000",
    "msapplication-tap-highlight": "no",
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
          rel="icon"
          href="/favicon-32x32.png"
          type="image/png"
          sizes="32x32"
        />
        <link
          rel="icon"
          href="/favicon-16x16.png"
          type="image/png"
          sizes="16x16"
        />
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
        className={`${inter.variable} ${jetbrainsMono.variable} ${playfairDisplay.variable} font-sans antialiased`}
      >
        <Providers>
          <StructuredData type="website" />
          <StructuredData type="organization" />
          {children}
          <Analytics />
          <SpeedInsights />
        </Providers>
      </body>
    </html>
  );
}
