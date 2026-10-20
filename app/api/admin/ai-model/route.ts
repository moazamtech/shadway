import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { setConfigValue } from "@/lib/db/content";
import { db } from "@/lib/db/postgres";
import { config } from "@/lib/db/schema";

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

  // The accessor answers with the value alone, and this route has to say when
  // the value was last written, so the row is read here.
  const rows = await db()
    .select()
    .from(config)
    .where(eq(config.id, MODEL_CONFIG_ID))
    .limit(1);
  const modelDoc = rows[0];
  const stored = modelDoc?.value;
  const storedModel = typeof stored === "string" ? stored : null;
  const active = normalizeModelId(storedModel || fromEnv);

  return NextResponse.json({
    model: active,
    source: stored ? "db" : "env",
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

  // The connection is opened here, where Mongo opened it, so that a missing
  // DATABASE_URL fails the way a missing MONGODB_URI failed instead of
  // answering a request that was never written.
  db();

  const now = new Date();
  const response: Record<string, unknown> = { updatedAt: now.toISOString() };

  if (rawModel !== undefined) {
    const model = normalizeModelId(rawModel);
    if (!model) {
      return NextResponse.json({ error: "Model is required" }, { status: 400 });
    }
    await setConfigValue(MODEL_CONFIG_ID, model);
    response.model = model;
  }

  return NextResponse.json(response);
}
