import { NextRequest } from 'next/server';

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

class RateLimiter {
  private requests: Map<string, { count: number; reset: number }> = new Map();
  private limit: number;
  private windowMs: number;

  constructor(limit: number = 100, windowMs: number = 15 * 60 * 1000) { // 100 requests per 15 minutes
    this.limit = limit;
    this.windowMs = windowMs;
  }

  check(identifier: string): RateLimitResult {
    const now = Date.now();
    const record = this.requests.get(identifier);

    if (!record || now > record.reset) {
      // New window
      this.requests.set(identifier, { count: 1, reset: now + this.windowMs });
      return {
        success: true,
        remaining: this.limit - 1,
        reset: now + this.windowMs,
      };
    }

    if (record.count >= this.limit) {
      // Rate limit exceeded
      return {
        success: false,
        remaining: 0,
        reset: record.reset,
      };
    }

    // Increment count
    record.count++;
    this.requests.set(identifier, record);

    return {
      success: true,
      remaining: this.limit - record.count,
      reset: record.reset,
    };
  }

  // Clean up expired entries periodically
  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.requests) {
      if (now > value.reset) {
        this.requests.delete(key);
      }
    }
  }
}

// Create different rate limiters for different endpoints
export const authRateLimiter = new RateLimiter(5, 15 * 60 * 1000); // 5 login attempts per 15 minutes
export const apiRateLimiter = new RateLimiter(100, 15 * 60 * 1000); // 100 API requests per 15 minutes
export const metadataRateLimiter = new RateLimiter(10, 60 * 1000); // 10 metadata requests per minute

export function getClientIP(request: NextRequest): string {
  // Get IP from various headers (considering proxies)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (realIP) {
    return realIP;
  }

  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback to connection remote address
  return request.ip || 'unknown';
}

// Cleanup expired entries every hour
setInterval(() => {
  authRateLimiter.cleanup();
  apiRateLimiter.cleanup();
  metadataRateLimiter.cleanup();
}, 60 * 60 * 1000);