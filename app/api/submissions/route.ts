import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { Submission } from '@/lib/types';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { db } = await connectToDatabase();
    const submissions = db.collection<Submission>('submissions');

    const allSubmissions = await submissions.find({}).sort({ createdAt: -1 }).toArray();

    return NextResponse.json(allSubmissions);
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

    const { db } = await connectToDatabase();
    const submissions = db.collection<Submission>('submissions');

    const newSubmission: Omit<Submission, '_id'> = {
      name,
      email,
      websiteName,
      websiteUrl,
      description,
      category,
      githubUrl: githubUrl || undefined,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await submissions.insertOne(newSubmission);

    return NextResponse.json(
      { message: 'Submission created successfully', submissionId: result.insertedId },
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