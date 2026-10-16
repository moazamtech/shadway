import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These ship native binaries (esbuild, Tailwind's oxide scanner, Chrome via
  // puppeteer). They are build-time tools that run on the server, so they must
  // stay external rather than be bundled into the route handlers.
  serverExternalPackages: ["esbuild", "tailwindcss", "puppeteer"],

  // Next 16 blocks cross-origin requests to dev resources (including HMR)
  // unless the host is listed here. Serving on 127.0.0.1 while the app is
  // reached by that same host made the websocket refuse to connect, so the
  // client never hydrated and the feed stayed on its loading skeleton.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // `eslint` and `typescript` config blocks were removed in Next 16. Build-time
  // type and lint failures are now caught by `next lint` / `tsc --noEmit` in CI
  // rather than silenced here, so a real error cannot hide behind a flag.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    minimumCacheTTL: 3600,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    domains: [],
    unoptimized: true,
    formats: ['image/webp'],
  },
};

export default nextConfig;
