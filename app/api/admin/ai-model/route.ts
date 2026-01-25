import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

const MODEL_CONFIG_ID = "ai_generate_component_model";

function normalizeModelId(input: string) {
  const trimmed = input.trim();
  const noSuffix = trimmed.replace(/:free$/i, "");
  if (noSuffix === "deepseek/deepseek-v3.2")
    return "deepseek/deepseek-v3.2-exp";
  return noSuffix;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fromEnv = process.env.AI_GENERATE_COMPONENT_MODEL || "openai/gpt-5";
  const { db } = await connectToDatabase();
  const config = db.collection<{
    _id: string;
    value: string;
    updatedAt?: Date;
  }>("config");
  const modelDoc = await config.findOne({ _id: MODEL_CONFIG_ID });
  const active = normalizeModelId(modelDoc?.value || fromEnv);

  return NextResponse.json({
    model: active,
    source: modelDoc?.value ? "db" : "env",
    updatedAt: modelDoc?.updatedAt ? modelDoc.updatedAt.toISOString() : null,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const rawModel = typeof body?.model === "string" ? body.model : undefined;

  const { db } = await connectToDatabase();
  const config = db.collection<{ _id: string; value: string; updatedAt: Date }>(
    "config",
  );
  const now = new Date();
  const response: Record<string, unknown> = { updatedAt: now.toISOString() };

  if (rawModel !== undefined) {
    const model = normalizeModelId(rawModel);
    if (!model) {
      return NextResponse.json({ error: "Model is required" }, { status: 400 });
    }
    await config.updateOne(
      { _id: MODEL_CONFIG_ID },
      { $set: { value: model, updatedAt: now } },
      { upsert: true },
    );
    response.model = model;
  }

  return NextResponse.json(response);
}
