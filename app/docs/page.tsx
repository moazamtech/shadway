"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { 
  ArrowUpRight, 
  Layers, 
  Layout, 
  Grid, 
  Lock, 
  Sidebar, 
  BarChart, 
  Table as TableIcon,
  Terminal,
  Sparkles,
  Image as ImageIcon,
  UploadCloud,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type PreviewProps = { isHovered: boolean };

const categories = [
  {
    name: "Components",
    blocks: 2,
    description: "Beautiful, accessible UI components for your applications.",
    icon: Layout,
  },
  {
    name: "AI Interface",
    blocks: 4,
    description: "Chat layouts, assistants, and prompt inputs.",
    icon: Sparkles,
  },
  {
    name: "Dialogs",
    blocks: 12,
    description: "Modals, sheets, and popovers.",
    icon: Layers,
  },
  {
    name: "File Upload",
    blocks: 6,
    description: "Dropzones and media flows.",
    icon: Layout,
  },
  {
    name: "Form Layouts",
    blocks: 5,
    description: "Structured inputs and steps.",
    icon: Terminal,
  },
  {
    name: "Grid List",
    blocks: 3,
    description: "Responsive content grids.",
    icon: Grid,
  },
  {
    name: "Authentication",
    blocks: 9,
    description: "Login, signup and recovery.",
    icon: Lock,
  },
  {
    name: "Sidebar",
    blocks: 6,
    description: "Navigation shells & menus.",
    icon: Sidebar,
  },
  {
    name: "Analytics",
    blocks: 12,
    description: "Charts, KPIs, and stats.",
    icon: BarChart,
  },
  {
    name: "Data Tables",
    blocks: 2,
    description: "High-density data views.",
    icon: TableIcon,
  },
];

const AIPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full flex flex-col justify-between p-4 bg-muted/20 relative overflow-hidden font-sans">
    <div className="space-y-2">
      <div className="flex justify-end">
        <div className="bg-primary/10 text-[10px] px-2 py-1 rounded-l-lg rounded-t-lg text-foreground/80">
          Imagine a logo...
        </div>
      </div>
      <div className="flex items-start gap-2">
        <div className="relative flex-shrink-0">
          <div className="h-5 w-5 rounded-full bg-blue-500/20 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-blue-500" />
          </div>
          <motion.div 
            initial={{ scale: 1, opacity: 0.5 }}
            animate={isHovered ? { scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] } : { scale: 1, opacity: 0.5 }}
            transition={isHovered ? { duration: 2, repeat: Infinity } : { duration: 0 }}
            className="absolute inset-0 rounded-full border border-blue-500"
          />
        </div>
        <div className="h-10 w-16 rounded-md bg-muted border border-border/50 overflow-hidden flex items-center justify-center">
            <ImageIcon className="w-4 h-4 text-muted-foreground/40" />
        </div>
      </div>
    </div>
    <div className="mt-auto flex items-center gap-2 bg-background border border-border/60 rounded-full px-2 py-1.5 shadow-sm">
       <div className="h-2 w-12 bg-muted-foreground/10 rounded-full" />
       <div className="h-3 w-3 rounded-full bg-primary ml-auto" />
    </div>
  </div>
);

const DialogPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full bg-muted/20 flex items-center justify-center relative overflow-hidden">
    <div className="absolute inset-0 grid grid-cols-2 gap-2 p-4 opacity-30">
       <div className="bg-muted-foreground/20 rounded h-12" />
       <div className="bg-muted-foreground/20 rounded h-12" />
       <div className="bg-muted-foreground/20 rounded h-24 col-span-2" />
    </div>
    <motion.div 
      initial={{ opacity: 0 }}
      animate={isHovered ? { opacity: [0, 0.5, 0.5, 0] } : { opacity: 0 }}
      transition={isHovered ? { duration: 3, repeat: Infinity, times: [0, 0.2, 0.8, 1] } : { duration: 0 }}
      className="absolute inset-0 bg-background/50 backdrop-blur-[1px]"
    />
    <motion.div 
      initial={{ scale: 1, opacity: 1 }}
      animate={isHovered ? { scale: [0.9, 1, 1, 0.9], opacity: [0, 1, 1, 0] } : { scale: 1, opacity: 1 }}
      transition={isHovered ? { duration: 3, repeat: Infinity, times: [0, 0.2, 0.8, 1] } : { duration: 0 }}
      className="w-3/5 bg-card border border-border shadow-lg rounded-lg p-3 z-10 flex flex-col gap-2"
    >
       <div className="h-2 w-1/2 bg-foreground/20 rounded-full" />
       <div className="h-1.5 w-full bg-muted-foreground/10 rounded-full" />
       <div className="h-1.5 w-2/3 bg-muted-foreground/10 rounded-full" />
       <div className="flex gap-2 mt-1">
         <div className="h-4 flex-1 bg-muted rounded" />
         <div className="h-4 flex-1 bg-primary rounded" />
       </div>
    </motion.div>
  </div>
);

const FileUploadPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full bg-muted/20 flex flex-col items-center justify-center p-4 relative">
    <div className="w-full h-full border-2 border-dashed border-muted-foreground/20 rounded-lg flex flex-col items-center justify-center gap-2 bg-background/50">
      <motion.div
        initial={{ y: 0 }}
        animate={isHovered ? { y: [-2, 2, -2] } : { y: 0 }}
        transition={isHovered ? { duration: 2, repeat: Infinity } : { duration: 0 }}
      >
        <UploadCloud className="w-6 h-6 text-muted-foreground/60" />
      </motion.div>
      <div className="w-2/3 h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: "0%", opacity: 1 }}
          animate={isHovered ? { width: ["0%", "100%", "100%"], opacity: [1, 1, 0] } : { width: "0%", opacity: 1 }}
          transition={isHovered ? { duration: 2.5, repeat: Infinity } : { duration: 0 }}
          className="h-full bg-primary"
        />
      </div>
    </div>
  </div>
);

const FormPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full bg-muted/20 p-4 flex flex-col gap-3 justify-center">
    {[0, 1, 2].map((i) => (
      <motion.div 
        key={i}
        initial={{ borderColor: "var(--border)", scale: 1 }}
        animate={isHovered ? { 
          borderColor: ["var(--border)", "var(--primary)", "var(--border)"],
          scale: [1, 1.02, 1]
        } : { borderColor: "var(--border)", scale: 1 }}
        transition={isHovered ? { 
          duration: 2, 
          repeat: Infinity, 
          delay: i * 0.6,
          times: [0, 0.2, 1]
        } : { duration: 0 }}
        className="h-8 w-full bg-background border border-border rounded flex items-center px-2 shadow-sm"
      >
        <div className="h-1.5 w-1/3 bg-muted-foreground/20 rounded-full" />
      </motion.div>
    ))}
  </div>
);

const GridPreview = ({ isHovered }: PreviewProps) => {
  // Staggered Layout Animation
  return (
    <div className="w-full h-full bg-muted/20 p-4 flex items-center justify-center">
      <div className="grid grid-cols-3 gap-2 w-full max-w-[240px] aspect-video">
        {/* 1. Large Featured Item */}
        <motion.div 
           initial={{ opacity: 1, scale: 1 }}
           animate={isHovered ? { opacity: [0, 1, 1, 0], scale: [0.9, 1, 1, 0.9] } : { opacity: 1, scale: 1 }}
           transition={isHovered ? { duration: 3, repeat: Infinity, times: [0, 0.1, 0.9, 1] } : { duration: 0 }}
           className="col-span-2 row-span-2 bg-card border border-border shadow-sm rounded-md flex flex-col p-2 gap-2"
        >
            <div className="w-full h-2/3 bg-muted/50 rounded-sm" />
            <div className="w-2/3 h-1.5 bg-muted-foreground/20 rounded-full" />
            <div className="w-1/2 h-1.5 bg-muted-foreground/10 rounded-full" />
        </motion.div>

        {/* 2. Top Right Small Item */}
        <motion.div 
           initial={{ opacity: 1, x: 0 }}
           animate={isHovered ? { opacity: [0, 1, 1, 0], x: [10, 0, 0, 10] } : { opacity: 1, x: 0 }}
           transition={isHovered ? { duration: 3, repeat: Infinity, delay: 0.1, times: [0, 0.1, 0.9, 1] } : { duration: 0 }}
           className="col-span-1 row-span-1 bg-primary/10 border border-primary/20 rounded-md"
        />

        {/* 3. Bottom Right Small Item */}
        <motion.div 
           initial={{ opacity: 1, x: 0 }}
           animate={isHovered ? { opacity: [0, 1, 1, 0], x: [10, 0, 0, 10] } : { opacity: 1, x: 0 }}
           transition={isHovered ? { duration: 3, repeat: Infinity, delay: 0.2, times: [0, 0.1, 0.9, 1] } : { duration: 0 }}
           className="col-span-1 row-span-1 bg-card border border-border shadow-sm rounded-md"
        />
      </div>
    </div>
  );
};

const AuthPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full bg-muted/20 flex items-center justify-center p-4">
    <div className="w-4/5 bg-card border border-border shadow-sm rounded-lg p-3 space-y-2">
       <div className="flex justify-center mb-2">
         <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
            <Lock className="w-3 h-3 text-primary" />
         </div>
       </div>
       <div className="h-7 bg-background border border-border rounded px-2 flex items-center gap-1">
          <motion.div 
             initial={{ opacity: 1 }}
             animate={isHovered ? { opacity: [0, 1, 1, 0] } : { opacity: 1 }}
             transition={isHovered ? { duration: 2, repeat: Infinity, times: [0, 0.3, 0.8, 1] } : { duration: 0 }}
             className="flex gap-0.5"
          >
            {[0, 1, 2, 3].map(d => (
              <div key={d} className="w-1.5 h-1.5 bg-foreground rounded-full" />
            ))}
          </motion.div>
       </div>
       <motion.div 
         initial={{ scale: 1 }}
         animate={isHovered ? { scale: [1, 0.95, 1] } : { scale: 1 }}
         transition={isHovered ? { duration: 2, repeat: Infinity, times: [0.8, 0.9, 1] } : { duration: 0 }}
         className="h-7 bg-primary rounded flex items-center justify-center"
       >
         <div className="w-8 h-1.5 bg-primary-foreground/50 rounded-full" />
       </motion.div>
    </div>
  </div>
);

const SidebarPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full bg-muted/20 flex relative overflow-hidden">
    <motion.div 
      initial={{ x: 0 }}
      animate={isHovered ? { x: [-20, 0] } : { x: 0 }}
      transition={isHovered ? { duration: 0.6 } : { duration: 0 }}
      className="w-1/3 h-full bg-card border-r border-border p-2 flex flex-col gap-2 z-10"
    >
       <div className="h-4 w-4 bg-primary/20 rounded mb-2" />
       {[0, 1, 2].map((i) => (
         <motion.div 
           key={i}
           initial={{ opacity: 0.5, backgroundColor: "transparent" }}
           animate={isHovered ? { opacity: [0.5, 1, 0.5], backgroundColor: ["transparent", "rgba(0,0,0,0.05)", "transparent"] } : { opacity: 0.5, backgroundColor: "transparent" }}
           transition={isHovered ? { duration: 2, repeat: Infinity, delay: i * 0.5 } : { duration: 0 }}
           className="h-2 w-full rounded-full"
         />
       ))}
    </motion.div>
    <div className="flex-1 p-2 space-y-2 opacity-50">
       <div className="h-2 w-1/3 bg-muted-foreground/20 rounded" />
       <div className="h-16 w-full bg-background rounded border border-border/50" />
       <div className="h-16 w-full bg-background rounded border border-border/50" />
    </div>
  </div>
);

const StatsPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full bg-muted/20 p-6 flex items-end justify-between gap-2">
    {[40, 80, 60, 90, 30].map((height, i) => (
      <motion.div
        key={i}
        initial={{ height: `${height}%` }}
        animate={isHovered ? { height: [`${height}%`, `${height - 20}%`, `${height}%`] } : { height: `${height}%` }}
        transition={isHovered ? { duration: 2, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" } : { duration: 0 }}
        className="w-full bg-primary/80 rounded-t-sm opacity-80"
      />
    ))}
  </div>
);

const TablesPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full bg-muted/20 p-3 flex flex-col gap-2 overflow-hidden">
    <div className="h-6 w-full bg-background border border-border rounded flex items-center px-2">
       <div className="h-1.5 w-1/4 bg-muted-foreground/20 rounded-full" />
    </div>
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        initial={{ x: 0, backgroundColor: "rgba(255,255,255,0)" }}
        animate={isHovered ? { x: [0, 5, 0], backgroundColor: ["rgba(255,255,255,0)", "rgba(255,255,255,0.5)", "rgba(255,255,255,0)"] } : { x: 0, backgroundColor: "rgba(255,255,255,0)" }}
        transition={isHovered ? { duration: 3, repeat: Infinity, delay: i * 0.2 } : { duration: 0 }}
        className="h-6 w-full border-b border-border/40 flex items-center gap-3 px-2"
      >
        <div className="h-1.5 w-2 bg-muted-foreground/20 rounded-full" />
        <div className="h-1.5 w-1/3 bg-muted-foreground/10 rounded-full" />
        <div className="h-1.5 w-1/4 bg-muted-foreground/10 rounded-full ml-auto" />
      </motion.div>
    ))}
  </div>
);


const ComponentsPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full bg-muted/20 p-4 flex flex-col gap-3 justify-center">
    <div className="flex gap-2">
      <motion.div 
        initial={{ scale: 1, borderColor: "var(--border)" }}
        animate={isHovered ? { 
          scale: [1, 1.05, 1],
          borderColor: ["var(--border)", "var(--primary)", "var(--border)"]
        } : { scale: 1, borderColor: "var(--border)" }}
        transition={isHovered ? { duration: 2, repeat: Infinity } : { duration: 0 }}
        className="flex-1 h-12 bg-background border border-border rounded-lg flex items-center justify-center shadow-sm"
      >
        <div className="w-6 h-1.5 bg-primary rounded-full" />
      </motion.div>
      <motion.div 
        initial={{ scale: 1, backgroundColor: "var(--muted)" }}
        animate={isHovered ? { 
          scale: [1, 1.05, 1],
          backgroundColor: ["var(--muted)", "var(--primary)", "var(--muted)"]
        } : { scale: 1, backgroundColor: "var(--muted)" }}
        transition={isHovered ? { duration: 2, repeat: Infinity, delay: 0.5 } : { duration: 0 }}
        className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center"
      >
        <div className="w-4 h-4 bg-background rounded-sm" />
      </motion.div>
    </div>
    <motion.div 
      initial={{ opacity: 0.7 }}
      animate={isHovered ? { opacity: [0.7, 1, 0.7] } : { opacity: 0.7 }}
      transition={isHovered ? { duration: 2, repeat: Infinity, delay: 1 } : { duration: 0 }}
      className="h-8 bg-card border border-border rounded-lg flex items-center px-3 gap-2 shadow-sm"
    >
      <div className="w-2 h-2 bg-green-500 rounded-full" />
      <div className="w-16 h-1.5 bg-muted-foreground/20 rounded-full" />
    </motion.div>
  </div>
);

const PREVIEWS: Record<string, React.ComponentType<PreviewProps>> = {
  "Components": ComponentsPreview,
  "AI Interface": AIPreview,
  "Dialogs": DialogPreview,
  "File Upload": FileUploadPreview,
  "Form Layouts": FormPreview,
  "Grid List": GridPreview,
  "Authentication": AuthPreview,
  "Sidebar": SidebarPreview,
  "Analytics": StatsPreview,
  "Data Tables": TablesPreview,
};

// Components data
const components = [
  {
    name: "Alert",
    description: "Display important messages and notifications to users.",
    type: "registry:component"
  },
  {
    name: "Button", 
    description: "Interactive elements for user actions and navigation.",
    type: "registry:component"
  },
];

export default function BlocksPage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  return (
    <div className="w-full min-h-screen bg-background text-foreground px-4 py-12 md:px-8 md:py-16">
      {/* Header */}
      <section className="mb-16 text-center space-y-6">
        <h1 className="text-4xl md:text-7xl font-extrabold tracking-tighter">
          UI LIBRARY<span className="text-primary">.</span>
        </h1>
        <p className="mx-auto max-w-2xl text-lg md:text-xl text-muted-foreground font-light">
          Interactive component previews.
          <br className="hidden sm:block" />
          Designed for the next generation of apps.
        </p>
      </section>

      {/* Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto"
      >
        {categories.map((category, index) => (
          <Card key={category.name} category={category} index={index} />
        ))}
      </motion.div>
    </div>
  );
}

function Card({ category, index }: { category: any; index: number }) {
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 50 } },
  };

  const [isHovered, setIsHovered] = React.useState(false);

  const Preview = PREVIEWS[category.name] || AIPreview; // Fallback

  const CardContent = (
    <motion.div
      variants={itemVariants}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-all duration-300 hover:border-primary/40 hover:shadow-sm cursor-pointer"
    >
      <div className="h-44 w-full border-b border-border/40 relative bg-muted/5 group-hover:bg-muted/10 transition-colors">
        <Preview isHovered={isHovered} />
        
        <div className="absolute top-3 right-3 z-10 font-mono text-[10px] text-muted-foreground/60 bg-background/90 backdrop-blur px-2 py-1 rounded-md border border-border/40 shadow-sm">
          {String(index + 1).padStart(2, "0")}
        </div>
      </div>

      <div className="p-5 flex flex-col flex-grow">
        <div className="mb-4">
          <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            {category.name}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed">
            {category.description}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between pt-2">
          <Badge variant="secondary" className="bg-muted text-[10px] font-medium text-muted-foreground/80 px-2 py-0.5 border border-border/50">
            {category.blocks} Components
          </Badge>
          
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">
            <span>Explore</span>
            <ArrowUpRight className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        </div>
      </div>
    </motion.div>
  );

  // If it's the Components category, wrap with Link
  if (category.name === "Components") {
    return (
      <Link href="/components">
        {CardContent}
      </Link>
    );
  }

  return CardContent;
}
