import { NextResponse } from "next/server";
import { getConfigValue } from "@/lib/db/content";

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
    const stored = await getConfigValue<string>(MODEL_CONFIG_ID);
    const active = normalizeModelId(stored || fromEnv);
    return NextResponse.json({ model: active });
  } catch {
    // A database that is not there must not take the model down with it: the
    // environment is the fallback, and the answer is the same one the route
    // gave when Mongo was unreachable.
    return NextResponse.json({ model: normalizeModelId(fromEnv) });
  }
}
