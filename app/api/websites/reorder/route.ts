import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { reorderWebsites } from '@/lib/db/content';

/**
 * The ids a website can have.
 *
 * The catalogue was written for Mongo, where a key was an ObjectId, so the
 * websites that were copied across keep their twenty-four hex characters and
 * the ones written since carry a UUID. An id that is neither is not a key
 * this table can answer for.
 */
const WEBSITE_ID =
  /^(?:[0-9a-f]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function isWebsiteId(id: string | undefined): boolean {
  return Boolean(id && WEBSITE_ID.test(id));
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { websiteIds } = await request.json();

    if (!Array.isArray(websiteIds) || websiteIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid website IDs array' },
        { status: 400 }
      );
    }

    for (const id of websiteIds) {
      if (!isWebsiteId(id)) {
        // Mongo built an ObjectId out of every id in the list, and the first
        // one it could not build threw and became this route's own five
        // hundred. The ids are text now, so nothing throws by itself, and the
        // check is written out to keep the answer the same.
        throw new Error(`"${id}" is not a website id`);
      }
    }

    // Update sequences based on new order
    await reorderWebsites(websiteIds);

    return NextResponse.json({ message: 'Website order updated successfully' });
  } catch (error) {
    console.error('Error updating website order:', error);
    return NextResponse.json(
      { error: 'Failed to update website order' },
      { status: 500 }
    );
  }
}
