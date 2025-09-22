import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/navbar";

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
  title: {
    default: "Shadway - Curated Shadcn UI Website Collection",
    template: "%s | Shadway"
  },
  description: "Discover beautiful websites and components built with Shadcn UI. A curated collection of modern interfaces and design inspiration for developers and designers.",
  keywords: [
    "shadcn ui",
    "react components",
    "ui library",
    "design system",
    "nextjs",
    "tailwind css",
    "modern ui",
    "web design",
    "interface design",
    "component library"
  ],
  authors: [{ name: "Moazam Butt", url: "https://x.com/loxtmozzi" }],
  creator: "Moazam Butt",
  publisher: "Shadway",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://shadway.vercel.app"), // Replace with your actual domain
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://shadway.vercel.app", // Replace with your actual domain
    title: "Shadway - Curated Shadcn UI Website Collection",
    description: "Discover beautiful websites and components built with Shadcn UI. A curated collection of modern interfaces and design inspiration.",
    siteName: "Shadway",
    images: [
      {
        url: "/og-image.png", // You'll need to add this image
        width: 1200,
        height: 630,
        alt: "Shadway - Curated Shadcn UI Collection",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Shadway - Curated Shadcn UI Website Collection",
    description: "Discover beautiful websites and components built with Shadcn UI. A curated collection of modern interfaces and design inspiration.",
    creator: "@loxtmozzi",
    images: ["/og-image.png"], // Same image as OpenGraph
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  manifest: "/manifest.json", // You can create this later for PWA
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#000000" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning suppressContentEditableWarning contentEditable>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
