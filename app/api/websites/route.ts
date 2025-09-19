import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { Website } from '@/lib/types';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const websites = db.collection<Website>('websites');

    const allWebsites = await websites.find({}).sort({ createdAt: -1 }).toArray();

    return NextResponse.json(allWebsites);
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
    const { name, description, url, image, category, tags, featured } = data;

    if (!name || !description || !url || !image || !category) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const websites = db.collection<Website>('websites');

    const newWebsite: Omit<Website, '_id'> = {
      name,
      description,
      url,
      image,
      category,
      tags: tags || [],
      featured: featured || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await websites.insertOne(newWebsite);

    return NextResponse.json(
      { message: 'Website created successfully', websiteId: result.insertedId },
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