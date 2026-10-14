import type { Metadata } from "next";
import { ComponentStudio } from "@/components/studio/component-studio";

export const metadata: Metadata = {
  title: "Studio | Build and publish a shadcn component",
  description:
    "Write a shadcn-compatible React component in the Shadway Studio, preview it live in the browser, and publish it as an installable registry item.",
  robots: { index: false, follow: false },
};

export default function StudioPage() {
  return <ComponentStudio />;
}