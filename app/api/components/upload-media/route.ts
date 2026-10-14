import { NextResponse } from "next/server";
import { uploadBufferToCloudinary } from "@/lib/cloudinary";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const kind = String(formData.get("kind") || "image");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (file.size > 10_000_000) {
      return NextResponse.json({ error: "Media file is too large" }, { status: 413 });
    }

    const uploaded = await uploadBufferToCloudinary(
      await file.arrayBuffer(),
      file.name,
      `shadway-component-${kind}-${Date.now()}`,
    );

    return NextResponse.json({ url: uploaded });
  } catch (error) {
    console.error("Component media upload failed:", error);
    return NextResponse.json({ error: "Media upload failed" }, { status: 500 });
  }
}
