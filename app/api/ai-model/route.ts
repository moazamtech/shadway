import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

const MODEL_CONFIG_ID = "ai_generate_component_model";

function normalizeModelId(input: string) {
  const trimmed = input.trim();
  const noSuffix = trimmed.replace(/:free$/i, "");
  if (noSuffix === "deepseek/deepseek-v3.2") return "deepseek/deepseek-v3.2-exp";
  return noSuffix;
}

export async function GET() {
  const fromEnv = process.env.AI_GENERATE_COMPONENT_MODEL || "openai/gpt-5";

  try {
    const { db } = await connectToDatabase();
    const config = db.collection<{ _id: string; value: string }>("config");
    const doc = await config.findOne({ _id: MODEL_CONFIG_ID });
    const active = normalizeModelId(doc?.value || fromEnv);
    return NextResponse.json({ model: active });
  } catch {
    return NextResponse.json({ model: normalizeModelId(fromEnv) });
  }
}
