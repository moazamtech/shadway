import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

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

    const { db } = await connectToDatabase();
    const websites = db.collection('websites');

    // Update sequences based on new order
    const updatePromises = websiteIds.map((id: string, index: number) => {
      return websites.updateOne(
        { _id: new ObjectId(id) },
        { $set: { sequence: index, updatedAt: new Date() } }
      );
    });

    await Promise.all(updatePromises);

    return NextResponse.json({ message: 'Website order updated successfully' });
  } catch (error) {
    console.error('Error updating website order:', error);
    return NextResponse.json(
      { error: 'Failed to update website order' },
      { status: 500 }
    );
  }
}