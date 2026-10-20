import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { insertWebsite, listWebsites } from '@/lib/db/content';
import { Website } from '@/lib/types';

/**
 * A row as the document the API has always answered with.
 *
 * The row carries its key under the name the column has, and the document has
 * always carried it as `_id`. They are the same string, and only the one the
 * clients know goes out, so an answer cannot tell which database it came from.
 */
function asDocument(row: Website & { id?: string }): Website {
  const { id, ...document } = row;
  return { _id: id, ...document };
}

/**
 * The key of a row that was just written.
 *
 * The accessors answer with the document, and the document carries its key as
 * `_id`. The shared type allows the key to be missing, so it is read out
 * rather than asserted: a row that came back without a key was not written.
 */
function keyOf(document: Website): string {
  const key = document._id;
  if (!key) {
    throw new Error('a website came back without a key');
  }
  return key;
}

export async function GET() {
  try {
    const allWebsites = await listWebsites();

    return NextResponse.json(allWebsites.map(asDocument));
  } catch (error) {
    console.error('Error fetching websites:', error);
    return NextResponse.json(
      { error: 'Failed to fetch websites' },
      { status: 500 }
    );
  }
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

    const data = await request.json();
    const { name, description, url, image, category, tags, featured, sequence } = data;

    if (!name || !description || !url || !image || !category) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const website = await insertWebsite({
      name,
      description,
      url,
      image,
      category,
      tags: tags || [],
      featured: featured || false,
      sequence: sequence || 0
    });

    return NextResponse.json(
      { message: 'Website created successfully', websiteId: keyOf(website) },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating website:', error);
    return NextResponse.json(
      { error: 'Failed to create website' },
      { status: 500 }
    );
  }
}
