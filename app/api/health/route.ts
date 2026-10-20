import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

/**
 * Is the deployment alive?
 *
 * The check is the database: everything this app serves comes out of it, so a
 * database that cannot be reached is a site that cannot answer. The question is
 * asked with the smallest possible query — one row of one table — because a
 * health check that is slow is a health check that lies.
 */
export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set — the database is not configured.');
    }

    const query = neon(process.env.DATABASE_URL);
    await query`select 1`;

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json({
      status: 'unhealthy',
      database: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}