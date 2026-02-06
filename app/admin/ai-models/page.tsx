"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { AdminLayout } from "../components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type ModelInfo = {
  model: string;
  source?: "db" | "env";
  updatedAt?: string | null;
};

const PRESETS = [
  "openai/gpt-5",
  "meituan/longcat-flash-chat",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "deepseek/deepseek-v3.1",
  "deepseek/deepseek-r1",
];

export default function AdminAiModelsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [model, setModel] = useState("");

  const isAdmin = session?.user?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    const run = async () => {
      setLoading(true);
      try {
        const resp = await fetch("/api/admin/ai-model");
        if (!resp.ok) throw new Error("Failed to load model");
        const data = (await resp.json()) as ModelInfo;
        setInfo(data);
        setModel(data.model || "");
      } catch (e) {
        console.error(e);
        toast.error("Failed to load model settings");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [isAdmin]);

  const normalizedModel = useMemo(() => model.trim(), [model]);
  const save = async () => {
    if (!normalizedModel) {
      toast.error("Model is required");
      return;
    }
    setSaving(true);
    try {
      const resp = await fetch("/api/admin/ai-model", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: normalizedModel,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        toast.error(data?.error || "Failed to save model");
        return;
      }
      setInfo((prev) => ({
        ...(prev || { model: normalizedModel }),
        model: data.model || normalizedModel,
        source: "db",
        updatedAt: data.updatedAt || null,
      }));
      toast.success("Model updated");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save model");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">AI Model</h1>
            <p className="text-sm text-muted-foreground">
              Set the model used by the component generator.
            </p>
          </div>
          {info?.source ? (
            <Badge variant={info.source === "db" ? "default" : "secondary"}>
              {info.source === "db" ? "DB override" : "ENV default"}
            </Badge>
          ) : null}
        </div>

        <div className="rounded-xl border border-border/60 bg-background p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="ai-model">
              Model ID
            </label>
            <Input
              id="ai-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="openai/gpt-5"
              disabled={loading || saving}
            />
            {info?.updatedAt ? (
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(info.updatedAt).toLocaleString()}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p}
                type="button"
                variant={p === normalizedModel ? "default" : "secondary"}
                size="sm"
                onClick={() => setModel(p)}
                disabled={loading || saving}
              >
                {p}
              </Button>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setModel(info?.model || "");
              }}
              disabled={loading || saving}
            >
              Reset
            </Button>
            <Button type="button" onClick={save} disabled={loading || saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
