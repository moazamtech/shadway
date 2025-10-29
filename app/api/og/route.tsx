import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'
export const revalidate = 3600 // Cache for 1 hour

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const title = searchParams.get('title') || 'Shadway'
    const description = searchParams.get('description') || 'Curated Shadcn UI Website Collection'
    const category = searchParams.get('category')

    // Sanitize inputs to prevent issues
    const cleanTitle = String(title).substring(0, 100).trim()
    const cleanDescription = String(description).substring(0, 150).trim()
    const cleanCategory = category ? String(category).substring(0, 50).trim() : null

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000',
            backgroundImage: 'radial-gradient(circle at 25px 25px, #333 2px, transparent 0), radial-gradient(circle at 75px 75px, #333 2px, transparent 0)',
            backgroundSize: '100px 100px',
          }}
        >
          {/* Logo/Brand */}
          <div
            style={{
              position: 'absolute',
              top: '60px',
              left: '60px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#000',
              }}
            >
              S
            </div>
            <div
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#fff',
              }}
            >
              Shadway
            </div>
          </div>

          {/* Main Content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              maxWidth: '800px',
              textAlign: 'center',
              padding: '0 60px',
            }}
          >
            {cleanCategory && (
              <div
                style={{
                  backgroundColor: '#333',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '16px',
                  marginBottom: '20px',
                }}
              >
                {cleanCategory}
              </div>
            )}

            <h1
              style={{
                fontSize: '72px',
                fontWeight: 'bold',
                color: '#fff',
                lineHeight: '1.1',
                marginBottom: '30px',
                textAlign: 'center',
              }}
            >
              {cleanTitle}
            </h1>

            <p
              style={{
                fontSize: '28px',
                color: '#ccc',
                lineHeight: '1.4',
                textAlign: 'center',
                marginBottom: '40px',
              }}
            >
              {cleanDescription}
            </p>

            {/* UI Elements */}
            <div
              style={{
                display: 'flex',
                gap: '20px',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: '60px',
                  height: '40px',
                  border: '2px solid #333',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                }}
              />
              <div
                style={{
                  width: '60px',
                  height: '40px',
                  backgroundColor: '#fff',
                  borderRadius: '8px',
                }}
              />
              <div
                style={{
                  width: '60px',
                  height: '40px',
                  border: '2px solid #666',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                }}
              />
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              position: 'absolute',
              bottom: '60px',
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              color: '#666',
              fontSize: '18px',
            }}
          >
            <span>✨ Discover beautiful Shadcn UI websites</span>
            <span>•</span>
            <span>shadway.online</span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    )
  } catch (e: any) {
    console.error('Error generating OG image:', e.message)
    return new Response('Failed to generate the image', {
      status: 500,
    })
  }
}