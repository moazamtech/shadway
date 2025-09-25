import { NextResponse } from 'next/server'

export async function GET() {
  const manifest = {
    name: 'Shadway - Curated Shadcn UI Website Collection',
    short_name: 'Shadway',
    description: 'Discover beautiful websites and components built with Shadcn UI. A curated collection of modern interfaces and design inspiration.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    orientation: 'portrait-primary',
    scope: '/',
    lang: 'en-US',
    categories: ['productivity', 'developer', 'design'],
    icons: [
      {
        src: '/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png'
      },
      {
        src: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png'
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png'
      },
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      }
    ],
    shortcuts: [
      {
        name: 'Submit Website',
        short_name: 'Submit',
        description: 'Submit your Shadcn UI website',
        url: '/submit',
        icons: [
          {
            src: '/favicon-32x32.png',
            sizes: '32x32'
          }
        ]
      },
      {
        name: 'Browse Templates',
        short_name: 'Templates',
        description: 'Browse premium templates',
        url: '/template',
        icons: [
          {
            src: '/favicon-32x32.png',
            sizes: '32x32'
          }
        ]
      }
    ],
    screenshots: [
      {
        src: '/og-image.png',
        type: 'image/png',
        sizes: '1200x630',
        form_factor: 'wide',
        label: 'Shadway Homepage'
      }
    ]
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}