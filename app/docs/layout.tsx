import "@/app/globals.css";
import { Header } from "./components/header";
import { DocsFooter } from "./components/footer";

export default function BlockLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <div className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-(--breakpoint-xl) flex-1 border-dashed border-r border-l px-4 sm:px-8">
          <div className="min-h-[calc(100%-2rem)] w-full pt-10 pb-20">
            {children}
          </div>
        </div>
      </div>
      <DocsFooter />
    </div>
  );
}
