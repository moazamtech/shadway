import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { insertTemplate, listTemplates } from '@/lib/db/content';
import { Template } from '@/lib/types';

/**
 * A row as the document the API has always answered with.
 *
 * The row carries its key under the name the column has, and the document has
 * always carried it as `_id`. They are the same string, and only the one the
 * clients know goes out, so an answer cannot tell which database it came from.
 */
function asDocument(row: Template & { id?: string }): Template {
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
function keyOf(document: Template): string {
  const key = document._id;
  if (!key) {
    throw new Error('a template came back without a key');
  }
  return key;
}

export async function GET() {
  try {
    const allTemplates = await listTemplates();

    return NextResponse.json(allTemplates.map(asDocument));
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates. Please try again later.' },
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
    const {
      name,
      description,
      image,
      demoUrl,
      purchaseUrl,
      price,
      featured,
      sequence
    } = data;

    if (!name || !description || !image || !demoUrl || !purchaseUrl || price === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const template = await insertTemplate({
      name,
      description,
      image,
      demoUrl,
      purchaseUrl,
      price: price || 0,
      featured: featured || false,
      sequence: sequence || 0,
      downloads: 0
    });

    return NextResponse.json(
      { message: 'Template created successfully', templateId: keyOf(template) },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
