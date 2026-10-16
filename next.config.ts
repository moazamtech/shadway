import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Babel must stay external so its runtime `require()` graph works on the server.
  serverExternalPackages: ["@babel/core"],
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
