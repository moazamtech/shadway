import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { deleteSubmission, updateSubmission } from '@/lib/db/content';
import { Submission } from '@/lib/types';

/**
 * The ids a submission can have.
 *
 * The catalogue was written for Mongo, where a key was an ObjectId, so the
 * submissions that were copied across keep their twenty-four hex characters
 * and the ones written since carry a UUID. An id that is neither is not a key
 * this table can answer for.
 */
const SUBMISSION_ID =
  /^(?:[0-9a-f]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function isSubmissionId(id: string | undefined): boolean {
  return Boolean(id && SUBMISSION_ID.test(id));
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

    const data = (await request.json()) as Partial<Submission>;
    const { status } = data;

    if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    if (!isSubmissionId(id)) {
      // Mongo threw here when the id was not an ObjectId, and the throw became
      // this route's own five hundred. The ids are text now, so nothing throws
      // by itself, and the check is written out so that a request for an id
      // that cannot exist still fails the way it failed before.
      throw new Error(`"${id}" is not a submission id`);
    }

    const submission = await updateSubmission(id, { status });

    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Submission updated successfully' });
  } catch (error) {
    console.error('Error updating submission:', error);
    return NextResponse.json(
      { error: 'Failed to update submission' },
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

    if (!isSubmissionId(id)) {
      throw new Error(`"${id}" is not a submission id`);
    }

    const deleted = await deleteSubmission(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Submission deleted successfully' });
  } catch (error) {
    console.error('Error deleting submission:', error);
    return NextResponse.json(
      { error: 'Failed to delete submission' },
      { status: 500 }
    );
  }
}
