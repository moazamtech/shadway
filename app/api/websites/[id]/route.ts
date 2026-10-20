import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { deleteWebsite, getWebsite, updateWebsite } from '@/lib/db/content';
import { Website } from '@/lib/types';

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

/**
 * A row as the document the API has always answered with.
 *
 * The row carries its key under the name the column has, and the document has
 * always carried it as `_id`. They are the same string, and only the one the
 * clients know goes out, so an answer cannot tell which database it came from.
 */
function asDocument(row: Website & { id?: string }): Website {
  const { id, ...document } = row;
  return { ...document, _id: id };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isWebsiteId(id)) {
      // Mongo threw here when the id was not an ObjectId, and the throw became
      // this route's own five hundred. The ids are text now, so nothing throws
      // by itself, and the check is written out so that a request for an id
      // that cannot exist still fails the way it failed before.
      throw new Error(`"${id}" is not a website id`);
    }

    const website = await getWebsite(id);

    if (!website) {
      return NextResponse.json(
        { error: 'Website not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(asDocument(website));
  } catch (error) {
    console.error('Error fetching website:', error);
    return NextResponse.json(
      { error: 'Failed to fetch website' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const data = (await request.json()) as Partial<Website>;
    const { name, description, url, image, category, tags, featured, sequence } = data;

    if (!name || !description || !url || !image || !category) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!isWebsiteId(id)) {
      throw new Error(`"${id}" is not a website id`);
    }

    const website = await updateWebsite(id, {
      name,
      description,
      url,
      image,
      category,
      tags: tags || [],
      featured: featured || false,
      sequence: sequence !== undefined ? sequence : 0
    });

    if (!website) {
      return NextResponse.json(
        { error: 'Website not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Website updated successfully' });
  } catch (error) {
    console.error('Error updating website:', error);
    return NextResponse.json(
      { error: 'Failed to update website' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!isWebsiteId(id)) {
      throw new Error(`"${id}" is not a website id`);
    }

    const deleted = await deleteWebsite(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Website not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Website deleted successfully' });
  } catch (error) {
    console.error('Error deleting website:', error);
    return NextResponse.json(
      { error: 'Failed to delete website' },
      { status: 500 }
    );
  }
}
