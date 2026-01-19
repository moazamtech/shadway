"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Editor from "@monaco-editor/react";
import { 
  ArrowLeft, 
  Save, 
  AlertCircle,
  Code2,
  Tag,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const CATEGORIES = [
  { value: "ui", label: "UI Component (shadcn/ui style)" },
  { value: "hero", label: "Hero Block" },
  { value: "contact", label: "Contact Block" },
  { value: "footer", label: "Footer Block" },
  { value: "about", label: "About Block" },
  { value: "feature", label: "Feature Block" },
  { value: "pricing", label: "Pricing Block" },
  { value: "general", label: "General Component" },
];

export default function NewComponentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    title: "",
    description: "",
    category: "general",
    code: `import React from "react";

export function MyComponent() {
  return (
    <div className="p-4 border rounded-lg bg-card">
      <h3 className="text-xl font-bold">Hello World</h3>
      <p className="text-muted-foreground">Generated via Shadway Admin</p>
    </div>
  );
}`,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Basic validation
    if (!formData.name || !formData.category || !formData.code) {
      setError("Name, category, and code are required.");
      setLoading(false);
      return;
    }

    // Sanitize name (lowercase, no spaces)
    const sanitizedName = formData.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

    try {
      const response = await fetch("/api/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          name: sanitizedName,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Component saved successfully!");
        router.push("/admin/components");
      } else {
        setError(result.error || "Failed to save component.");
      }
    } catch (err) {
      console.error("Error saving component:", err);
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/admin/components")}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Component</h1>
          <p className="text-muted-foreground">
            Create and register a new component in your library.
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <div className="space-y-4 bg-card p-4 rounded-xl border">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                Registry Name
              </Label>
              <Input
                id="name"
                placeholder="e.g. hero-v1"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
              <p className="text-[10px] text-muted-foreground">
                Lowercase and hyphens only.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" />
                Category
              </Label>
              <Select
                value={formData.category}
                onValueChange={(val) => setFormData(prev => ({ ...prev, category: val }))}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Display Title</Label>
              <Input
                id="title"
                placeholder="e.g. Modern Hero Section"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="How this component should be used..."
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 gap-2 text-lg" 
            disabled={loading}
          >
            <Save className="w-5 h-5" />
            {loading ? "Saving..." : "Save Component"}
          </Button>
        </div>

        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-lg font-semibold">
              <Code2 className="w-5 h-5 text-primary" />
              Source Code
            </Label>
            <Badge variant="outline" className="font-mono">TypeScript / React</Badge>
          </div>
          <div className="border rounded-xl overflow-hidden h-[600px] shadow-sm">
            <Editor
              height="100%"
              defaultLanguage="typescript"
              theme="vs-dark"
              value={formData.code}
              onChange={(val) => setFormData(prev => ({ ...prev, code: val || "" }))}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: "on",
                roundedSelection: true,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 20, bottom: 20 },
              }}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
