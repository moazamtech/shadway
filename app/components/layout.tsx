import "@/app/globals.css";
import { BorderBeam } from "@/components/ui/borderbeam";
import { Header } from "../docs/components/header";
import { DocsFooter } from "../docs/components/footer";

export default function ComponentsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <div className="flex flex-1 flex-col">
        <div className="relative mx-auto w-full max-w-(--breakpoint-xl) flex-1 border-dashed border-r border-l px-4 sm:px-8 overflow-hidden">
          <BorderBeam borderWidth={1} reverse initialOffset={10} className="from-transparent via-blue-500 to-transparent"/>
          <BorderBeam borderWidth={1} className="from-transparent via-blue-500 to-transparent"/>
          <div className="min-h-[calc(100%-2rem)] w-full pt-10 pb-20">
            {children}
          </div>
        </div>
      </div>
      <DocsFooter />
    </div>
  );
}
