import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { Template } from '@/lib/types';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const templates = db.collection<Template>('templates');
    const allTemplates = await templates.find({}).sort({ sequence: 1, createdAt: -1 }).toArray();

    return NextResponse.json(allTemplates);
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

    const { db } = await connectToDatabase();
    const templates = db.collection<Template>('templates');

    const newTemplate: Omit<Template, '_id'> = {
      name,
      description,
      image,
      demoUrl,
      purchaseUrl,
      price: price || 0,
      featured: featured || false,
      sequence: sequence || 0,
      downloads: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await templates.insertOne(newTemplate);

    return NextResponse.json(
      { message: 'Template created successfully', templateId: result.insertedId },
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