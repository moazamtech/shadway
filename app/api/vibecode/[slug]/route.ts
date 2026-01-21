import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { VibecodeComponent } from "@/lib/types";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type RouteParams = {
  params: { slug: string };
};

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { db } = await connectToDatabase();
    const vibecode = db.collection<VibecodeComponent>("vibecode");
    const item = await vibecode.findOne({
      slug: params.slug,
      status: "published",
    });

    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await vibecode.updateOne(
      { _id: item._id },
      { $inc: { viewCount: 1 }, $set: { updatedAt: new Date() } },
    );

    return NextResponse.json(item);
  } catch (error) {
    console.error("Error fetching vibecode item:", error);
    return NextResponse.json(
      { error: "Failed to fetch vibecode item" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!params.slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const vibecode = db.collection<VibecodeComponent>("vibecode");
    const result = await vibecode.deleteOne({ slug: params.slug });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Vibecode component not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ message: "Vibecode component deleted" });
  } catch (error) {
    console.error("Error deleting vibecode component:", error);
    return NextResponse.json(
      { error: "Failed to delete vibecode component" },
      { status: 500 },
    );
  }
}
