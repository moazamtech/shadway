import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { insertSubmission, listSubmissions } from '@/lib/db/content';
import { Submission } from '@/lib/types';

/**
 * A row as the document the API has always answered with.
 *
 * The row carries its key under the name the column has, and the document has
 * always carried it as `_id`. They are the same string, and only the one the
 * clients know goes out, so an answer cannot tell which database it came from.
 */
function asDocument(row: Submission & { id?: string }): Submission {
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
function keyOf(document: Submission): string {
  const key = document._id;
  if (!key) {
    throw new Error('a submission came back without a key');
  }
  return key;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const allSubmissions = await listSubmissions();

    return NextResponse.json(allSubmissions.map(asDocument));
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { name, email, websiteName, websiteUrl, description, category, githubUrl } = data;

    if (!name || !email || !websiteName || !websiteUrl || !description || !category) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const submission = await insertSubmission({
      name,
      email,
      websiteName,
      websiteUrl,
      description,
      category,
      githubUrl: githubUrl || undefined,
      status: 'pending'
    });

    return NextResponse.json(
      { message: 'Submission created successfully', submissionId: keyOf(submission) },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating submission:', error);
    return NextResponse.json(
      { error: 'Failed to create submission' },
      { status: 500 }
    );
  }
}
