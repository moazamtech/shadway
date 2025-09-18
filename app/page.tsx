import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Layers,
  Globe} from "lucide-react";
import Image from "next/image";

export default function Home() {
  const featuredWebsites = [
    {
      name: "Mvpblocks",
      description: "Copy, paste, customize—and launch your idea faster than ever. Mvpblocks is a fully open-source, developer-first component library.",
      url: "https://blocks.mvp-subha.me/",
      image: "https://i.postimg.cc/Wz9JFxdW/mvpblocksog.webp",
      category: "Components"
    },
    {
      name: "React Bits",
      description: "An open source collection of high quality, animated, interactive & fully customizable React components for building stunning, memorable user interfaces.",
      url: "https://www.reactbits.dev/",
      image: "https://reactbits.dev/og-pic.png",
      category: "Animated"
    },
    {
      name: "Commerce UI",
      description: "The Commerce UI is a set of components and hooks that can be used to build a custom storefront for your commerce site.",
      url: "https://ui.stackzero.co/",
      image: "https://ui.stackzero.co/opengraph-image.jpg?72735195b426f1bf",
      category: "Commerce"
    },
    {
      name: "Skiper UI",
      description: "Discover 73+ premium React components built on shadcn/ui. From scroll effects to interactive animations, enhance your Next.js projects with our unique component library.",
      url: "https://skiper-ui.com/",
      image: "https://skiper-ui.com/og.png",
      category: "Premium"
    },
    {
      name: "Shadcn UI",
      description: "Beautifully designed components that you can copy and paste into your apps. Accessible. Customizable. Open Source.",
      url: "https://ui.shadcn.com/",
      image: "https://ui.shadcn.com/og?title=The%20Foundation%20for%20your%20Design%20System&description=A%20set%20of%20beautifully%20designed%20components%20that%20you%20can%20customize%2C%20extend%2C%20and%20build%20on.%20Start%20here%20then%20make%20it%20your%20own.%20Open%20Source.%20Open%20Code.",
      category: "Official"
    },
    {
      name: "Magic UI",
      description: "20+ free and open-source animated components built with React, Typescript, Tailwind CSS, and Framer Motion. Perfect companion to shadcn/ui.",
      url: "https://magicui.design/",
      image: "https://magicui.design/og",
      category: "Animated"
    },
    {
      name: "Aceternity UI",
      description: "Copy paste the most trending components and use them in your websites without having to worry about styling and animations.",
      url: "https://ui.aceternity.com/",
      image: "https://aceternity.com/cdn-cgi/image/width=3840/https://assets.aceternity.com/pro/aceternity-landing.webp",
      category: "Components"
    },
    {
      name: "Tremor",
      description: "The React library to build dashboards fast. Modular components built on top of Tailwind CSS. Fully open-source.",
      url: "https://tremor.so/",
      image: "https://tremor.so/opengraph-image.png?f5bbf8e00be369e2",
      category: "Dashboard"
    },
    {
      name: "NextUI (HeroUI)",
      description: "Beautiful, fast and modern React UI library that allows you to create beautiful websites regardless of your design experience.",
      url: "https://heroui.com/",
      image: "https://www.heroui.com/heroui.jpg",
      category: "Components"
    },
    {
      name: "Taxonomy",
      description: "An open source application built using the new router, server components and everything new in Next.js 13.",
      url: "https://tx.shadcn.com/",
      image: "https://tx-ag2297lx7-shadcn-pro.vercel.app/opengraph-image.jpg?a25ca70e900445ed",
      category: "Template"
    },
    {
      name: "Plate",
      description: "The rich-text editor for React. Build complex editor experiences with pre-built components.",
      url: "https://platejs.org/",
      image: "https://platejs.org/og?title=Build%20your%20rich-text%20editor&description=A%20set%20of%20beautifully-designed%2C%20customizable%20plugins%20and%20components%20to%20help%20you%20build%20your%20rich-text%20editor.%20Open%20Source.",
      category: "Editor"
    },
    {
      name: "Shadcn Blocks",
      description: "Ready-to-use shadcn/ui blocks that you can copy and paste into your projects. Built with React and Tailwind CSS.",
      url: "https://ui.shadcn.com/blocks",
      image: "https://ui.shadcn.com/og?title=The%20Foundation%20for%20your%20Design%20System&description=A%20set%20of%20beautifully%20designed%20components%20that%20you%20can%20customize%2C%20extend%2C%20and%20build%20on.%20Start%20here%20then%20make%20it%20your%20own.%20Open%20Source.%20Open%20Code.",
      category: "Blocks"
    },
    {
      name: "Shadcn Charts",
      description: "Charts built using shadcn/ui and Recharts. Copy and paste into your apps.",
      url: "https://ui.shadcn.com/charts",
      image: "https://ui.shadcn.com/og?title=Beautiful%20Charts%20%26%20Graphs&description=A%20collection%20of%20ready-to-use%20chart%20components%20built%20with%20Recharts.%20From%20basic%20charts%20to%20rich%20data%20displays%2C%20copy%20and%20paste%20into%20your%20apps.",
      category: "Charts"
    },
    {
      name: "Novel",
      description: "An open-source Notion-style WYSIWYG editor with AI-powered autocompletions built with Tiptap and Vercel AI SDK.",
      url: "https://novel.sh/",
      image: "https://novel.sh/opengraph-image.png?73cb1c6d8589016e",
      category: "Editor"
    },
    {
      name: "Craft UI",
      description: "Building blocks for your Next.js project. Copy-paste components built with Tailwind CSS and shadcn/ui.",
      url: "https://craft.mxkaske.dev/",
      image: "https://craft.mxkaske.dev/api/og?title=craft.mxkaske.dev&description=Never.%20Stop.%20Crafting.",
      category: "Components"
    },
    {
      name: "Shadcn Extension",
      description: "An extension library for shadcn/ui. Add more components and utilities to your project.",
      url: "https://shadcn-extension.vercel.app/",
      image: "https://shadcn-extension-landing.vercel.app/og.png",
      category: "Extension"
    },
    {
      name: "Origin UI",
      description: "Beautiful UI components built on top of shadcn/ui and Tailwind CSS. Copy, paste, and customize.",
      url: "https://originui.com/",
      image: "https://originui.com/opengraph-image.jpg?2c969d23ed72e3ae",
      category: "Components"
    },
    {
      name: "Cult UI",
      description: "A curated collection of the best shadcn/ui components from the community. High quality and production ready.",
      url: "https://www.cult-ui.com/",
      image: "https://cult-ui.com/og.png",
      category: "Community"
    },
    {
      name: "Components.work",
      description: "Collection of Typescript React components for Next JS built using Tailwind and shadcn/ui. Created by Bridger Tower.",
      url: "https://components.work/",
      image: "https://components.work/opengraph-image.jpg",
      category: "Components"
    },
    {
      name: "Lina",
      description: "A responsive scroll area that feels native on touch, and custom where it matters.",
      url: "https://lina.sameer.sh/",
      image: "https://lina.sameer.sh/og-image.png",
      category: "Components"
    }
  ];


  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
    

      {/* Featured Websites Section */}
      <section id="websites" className="py-20 bg-muted/30">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Shadcn UI Ecosystem</h2>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Explore the complete ecosystem of websites, tools, and components built with Shadcn UI
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredWebsites.map((website, index) => (
              <Card key={index} className="group hover:shadow-xl transition-all duration-300 overflow-hidden border-0 bg-card/50 backdrop-blur h-full flex flex-col rounded-xl">
                {/* Image */}
                <div className="relative h-56 bg-muted overflow-hidden rounded-t-xl">
                  <Image
                    src={website.image}
                    alt={`${website.name} preview`}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    priority={index < 6}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  <Badge
                    variant="secondary"
                    className="absolute top-4 right-4 bg-background/90 backdrop-blur text-foreground border-0 text-xs rounded-lg"
                  >
                    {website.category}
                  </Badge>
                </div>

                <CardHeader className="space-y-3 p-6 flex-grow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <Globe className="w-5 h-5 text-primary flex-shrink-0" />
                      <CardTitle className="text-lg font-bold leading-tight">{website.name}</CardTitle>
                    </div>
                  </div>
                  <CardDescription className="text-sm leading-relaxed text-muted-foreground line-clamp-3">
                    {website.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-6 pt-0 mt-auto">
                  <Button
                    size="sm"
                    asChild
                    className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200 rounded-lg"
                  >
                    <a href={website.url} target="_blank" rel="noopener noreferrer">
                      Visit Website
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container max-w-4xl mx-auto px-4">
          <Card className="bg-primary text-primary-foreground border-0 overflow-hidden relative rounded-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/80" />
            <CardContent className="relative p-12 md:p-16 text-center">
              <div className="space-y-6">
                <h2 className="text-3xl md:text-4xl font-bold">Start Building Today</h2>
                <p className="text-xl md:text-2xl opacity-90 max-w-2xl mx-auto leading-relaxed">
                  Get inspired by these beautiful websites and start building your own amazing interfaces with Shadcn UI.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                  <Button size="lg" variant="secondary" className="px-8 py-4 text-lg">
                    <Layers className="w-5 h-5 mr-2" />
                    Get Started
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground hover:text-primary px-8 py-4 text-lg"
                    asChild
                  >
                    <a href="https://ui.shadcn.com" target="_blank" rel="noopener noreferrer">
                      View Documentation
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-16 bg-muted/20">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Layers className="w-6 h-6 text-primary-foreground" />
                </div>
                <span className="font-bold text-2xl">Shadcn UI Hub</span>
              </div>
              <p className="text-muted-foreground max-w-md leading-relaxed">
                The ultimate collection of Shadcn UI components, websites, and tools.
                Discover, explore, and get inspired by beautiful interfaces.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4 text-lg">Resources</h3>
              <div className="space-y-3">
                <a href="https://ui.shadcn.com" className="block text-muted-foreground hover:text-foreground transition-colors">Documentation</a>
                <a href="https://ui.shadcn.com/docs/components" className="block text-muted-foreground hover:text-foreground transition-colors">Components</a>
                <a href="https://ui.shadcn.com/examples" className="block text-muted-foreground hover:text-foreground transition-colors">Examples</a>
                <a href="https://ui.shadcn.com/themes" className="block text-muted-foreground hover:text-foreground transition-colors">Themes</a>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4 text-lg">Community</h3>
              <div className="space-y-3">
                <a href="https://github.com/shadcn-ui/ui" className="block text-muted-foreground hover:text-foreground transition-colors">GitHub</a>
                <a href="https://twitter.com/shadcn" className="block text-muted-foreground hover:text-foreground transition-colors">Twitter</a>
                <a href="https://discord.gg/shadcn" className="block text-muted-foreground hover:text-foreground transition-colors">Discord</a>
                <a href="https://github.com/shadcn-ui/ui/discussions" className="block text-muted-foreground hover:text-foreground transition-colors">Discussions</a>
              </div>
            </div>
          </div>

          <div className="border-t border-border mt-12 pt-8 text-center">
            <p className="text-muted-foreground">
              Built with ❤️ using Shadcn UI components. Not affiliated with shadcn.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}