import { notFound } from "next/navigation";
import { connectToDatabase } from "@/lib/mongodb";
import { VibecodeComponent } from "@/lib/types";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import VibecodePreviewClient, {
  SerializedVibecodeComponent,
} from "./preview-client";
import { TextHoverEffect } from "@/components/site-components/text-hover-effect";

type PageProps = {
  params: Promise<{ slug: string }>;
};

async function getVibecodeItem(slug: string) {
  const { db } = await connectToDatabase();
  const vibecode = db.collection<VibecodeComponent>("vibecode");
  return vibecode.findOne({ slug, status: "published" });
}

function serializeItem(item: VibecodeComponent): SerializedVibecodeComponent {
  return {
    ...item,
    _id: item._id?.toString(),
    createdAt: item.createdAt
      ? new Date(item.createdAt).toISOString()
      : undefined,
    updatedAt: item.updatedAt
      ? new Date(item.updatedAt).toISOString()
      : undefined,
    publishedAt: item.publishedAt
      ? new Date(item.publishedAt).toISOString()
      : undefined,
  };
}

export default async function VibecodeDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const item = await getVibecodeItem(slug);

  if (!item) {
    notFound();
  }
  const serialized = serializeItem(item);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-20 px-6 lg:px-12">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-primary font-semibold">
              Vibecode Component
            </p>
            <h1 className="text-4xl md:text-5xl font-black text-foreground">
              {item.title}
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-3xl">
              {item.description}
            </p>
          </div>
          <VibecodePreviewClient item={serialized} />
        </div>
      </main>
      <div className="items-center justify-start mx-auto  max-w-[1300px] overflow-x-hidden">
        <TextHoverEffect text="SHADWAY" />
      </div>
    </div>
  );
}
