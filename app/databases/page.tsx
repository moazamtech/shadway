"use client"

import { useState } from "react";
import { motion } from "framer-motion";
import { Database, Search, ExternalLink, Star, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import Link from "next/link";
import Image from "next/image";
import { addRefParameter } from "@/lib/utils/url";

interface DatabaseOption {
  name: string;
  description: string;
  icon: string;
  features: string[];
  category: "SQL" | "NoSQL" | "Cloud" | "Graph" | "Vector" | "Cache";
  popularity: "High" | "Medium" | "Growing";
  url: string;
  nextjsCompatible: boolean;
  color: string;
}

const databases: DatabaseOption[] = [
  {
    name: "PostgreSQL",
    description: "Advanced open-source relational database with excellent Next.js support via Prisma, Drizzle, or pg",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg",
    features: ["ACID compliant", "JSON support", "Full-text search", "Prisma ORM"],
    category: "SQL",
    popularity: "High",
    url: "https://www.postgresql.org/",
    nextjsCompatible: true,
    color: "from-blue-500 to-blue-700"
  },
  {
    name: "MongoDB",
    description: "Popular NoSQL database perfect for Next.js applications with Mongoose or native driver",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg",
    features: ["Flexible schema", "Horizontal scaling", "Atlas cloud", "Aggregation pipeline"],
    category: "NoSQL",
    popularity: "High",
    url: "https://www.mongodb.com/",
    nextjsCompatible: true,
    color: "from-green-500 to-green-700"
  },
  {
    name: "MySQL",
    description: "World's most popular open-source relational database with excellent Next.js integration",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mysql/mysql-original.svg",
    features: ["High performance", "Replication", "ACID transactions", "PlanetScale support"],
    category: "SQL",
    popularity: "High",
    url: "https://www.mysql.com/",
    nextjsCompatible: true,
    color: "from-orange-500 to-orange-700"
  },
  {
    name: "Supabase",
    description: "Open-source Firebase alternative with PostgreSQL, authentication, and real-time subscriptions",
    icon: "https://supabase.com/favicon/favicon-32x32.png",
    features: ["Real-time", "Auth built-in", "Storage", "Edge functions"],
    category: "Cloud",
    popularity: "Growing",
    url: "https://supabase.com/",
    nextjsCompatible: true,
    color: "from-emerald-500 to-teal-700"
  },
  {
    name: "Firebase",
    description: "Google's platform with Firestore NoSQL database and real-time capabilities",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/firebase/firebase-plain.svg",
    features: ["Real-time sync", "Authentication", "Cloud functions", "Hosting"],
    category: "Cloud",
    popularity: "High",
    url: "https://firebase.google.com/",
    nextjsCompatible: true,
    color: "from-yellow-500 to-orange-600"
  },
  {
    name: "Redis",
    description: "In-memory data structure store for caching, session management, and real-time applications",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/redis/redis-original.svg",
    features: ["Sub-millisecond latency", "Pub/Sub", "Streams", "Upstash serverless"],
    category: "Cache",
    popularity: "High",
    url: "https://redis.io/",
    nextjsCompatible: true,
    color: "from-red-500 to-red-700"
  },
  {
    name: "Prisma",
    description: "Next-generation ORM for Node.js and TypeScript, works with PostgreSQL, MySQL, SQLite, and more",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/prisma/prisma-original.svg",
    features: ["Type-safe", "Auto-completion", "Migrations", "Studio GUI"],
    category: "SQL",
    popularity: "Growing",
    url: "https://www.prisma.io/",
    nextjsCompatible: true,
    color: "from-indigo-500 to-purple-700"
  },
  {
    name: "PlanetScale",
    description: "Serverless MySQL platform with branching, non-blocking schema changes, and excellent Next.js support",
    icon: "https://planetscale.com/favicon.ico",
    features: ["Database branching", "Zero downtime", "Horizontal sharding", "Free tier"],
    category: "Cloud",
    popularity: "Growing",
    url: "https://planetscale.com/",
    nextjsCompatible: true,
    color: "from-purple-500 to-pink-700"
  },
  {
    name: "Neo4j",
    description: "Leading graph database for connected data and relationship-heavy applications",
    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/neo4j/neo4j-original.svg",
    features: ["Graph queries", "ACID compliant", "Cypher query language", "Aura cloud"],
    category: "Graph",
    popularity: "Medium",
    url: "https://neo4j.com/",
    nextjsCompatible: true,
    color: "from-cyan-500 to-blue-700"
  },
  {
    name: "Pinecone",
    description: "Vector database for AI applications, perfect for semantic search and recommendation systems",
    icon: "https://www.pinecone.io/favicon.ico",
    features: ["Vector search", "Low latency", "Scalable", "AI/ML ready"],
    category: "Vector",
    popularity: "Growing",
    url: "https://www.pinecone.io/",
    nextjsCompatible: true,
    color: "from-violet-500 to-purple-700"
  },
  {
    name: "Upstash",
    description: "Serverless Redis and Kafka for edge functions, perfect for Next.js Edge Runtime",
    icon: "https://images.seeklogo.com/logo-png/45/1/upstash-icon-logo-png_seeklogo-453818.png",
    features: ["Edge compatible", "Pay-per-request", "Redis & Kafka", "Low latency"],
    category: "Cloud",
    popularity: "Growing",
    url: "https://upstash.com/",
    nextjsCompatible: true,
    color: "from-teal-500 to-cyan-700"
  },
  {
    name: "CockroachDB",
    description: "Distributed SQL database that survives disasters with excellent PostgreSQL compatibility",
    icon: "https://www.cockroachlabs.com/favicon.ico",
    features: ["Distributed", "PostgreSQL compatible", "Automatic scaling", "Geo-replication"],
    category: "SQL",
    popularity: "Medium",
    url: "https://www.cockroachlabs.com/",
    nextjsCompatible: true,
    color: "from-blue-600 to-indigo-700"
  },
  {
    name: "Neon",
    description: "Serverless Postgres with instant branching, autoscaling, and bottomless storage for Next.js",
    icon: "https://neon.tech/favicon.ico",
    features: ["Serverless", "Instant branching", "Autoscaling", "Free tier"],
    category: "Cloud",
    popularity: "Growing",
    url: "https://neon.tech/",
    nextjsCompatible: true,
    color: "from-cyan-500 to-blue-600"
  },
  {
    name: "Convex",
    description: "Backend platform with real-time database, serverless functions, and built-in auth for Next.js",
    icon: "https://convex.dev/favicon.ico",
    features: ["Real-time sync", "TypeScript-first", "Serverless functions", "Reactive queries"],
    category: "Cloud",
    popularity: "Growing",
    url: "https://www.convex.dev/",
    nextjsCompatible: true,
    color: "from-orange-500 to-red-600"
  },
  {
    name: "Drizzle ORM",
    description: "TypeScript ORM with zero-cost abstractions for PostgreSQL, MySQL, and SQLite in Next.js",
    icon: "https://orm.drizzle.team/favicon.ico",
    features: ["Type-safe", "Zero overhead", "SQL-like syntax", "Edge runtime ready"],
    category: "SQL",
    popularity: "Growing",
    url: "https://orm.drizzle.team/",
    nextjsCompatible: true,
    color: "from-green-500 to-emerald-700"
  },
  {
    name: "Xata",
    description: "Serverless database platform with PostgreSQL, full-text search, and file attachments",
    icon: "https://xata.io/favicon.ico",
    features: ["PostgreSQL-based", "Full-text search", "File storage", "Branching"],
    category: "Cloud",
    popularity: "Growing",
    url: "https://xata.io/",
    nextjsCompatible: true,
    color: "from-purple-500 to-indigo-600"
  },
  {
    name: "Turso",
    description: "Edge-hosted distributed SQLite database built on libSQL, perfect for low-latency apps",
    icon: "https://turso.tech/favicon.ico",
    features: ["Edge hosting", "SQLite compatible", "Multi-region", "Pay-per-request"],
    category: "Cloud",
    popularity: "Growing",
    url: "https://turso.tech/",
    nextjsCompatible: true,
    color: "from-teal-500 to-cyan-600"
  },
  {
    name: "FaunaDB",
    description: "Distributed document-relational database with global transactions and GraphQL API",
    icon: "https://fauna.com/favicon.ico",
    features: ["Global distribution", "GraphQL native", "ACID transactions", "Serverless"],
    category: "NoSQL",
    popularity: "Medium",
    url: "https://fauna.com/",
    nextjsCompatible: true,
    color: "from-violet-500 to-purple-600"
  },
  {
    name: "DynamoDB",
    description: "AWS fully managed NoSQL database with single-digit millisecond performance at any scale",
    icon: "https://a0.awsstatic.com/libra-css/images/site/fav/favicon.ico",
    features: ["Fully managed", "Single-digit ms latency", "Auto-scaling", "AWS integration"],
    category: "NoSQL",
    popularity: "High",
    url: "https://aws.amazon.com/dynamodb/",
    nextjsCompatible: true,
    color: "from-yellow-600 to-orange-700"
  },
  {
    name: "Vercel KV",
    description: "Durable Redis database built on Upstash, optimized for Vercel deployments and Edge",
    icon: "https://vercel.com/favicon.ico",
    features: ["Edge-optimized", "Redis compatible", "Zero config", "Vercel integration"],
    category: "Cache",
    popularity: "Growing",
    url: "https://vercel.com/storage/kv",
    nextjsCompatible: true,
    color: "from-black to-gray-700"
  },
  {
    name: "Vercel Postgres",
    description: "Serverless SQL database powered by Neon, optimized for Vercel and Next.js Edge",
    icon: "https://vercel.com/favicon.ico",
    features: ["Serverless", "PostgreSQL", "Zero config", "Edge runtime"],
    category: "Cloud",
    popularity: "Growing",
    url: "https://vercel.com/storage/postgres",
    nextjsCompatible: true,
    color: "from-gray-900 to-gray-700"
  },
  {
    name: "Railway",
    description: "Platform with PostgreSQL, MySQL, MongoDB, and Redis databases with instant provisioning",
    icon: "https://railway.app/favicon.ico",
    features: ["Multi-database", "Instant deploy", "Zero config", "Auto backups"],
    category: "Cloud",
    popularity: "Growing",
    url: "https://railway.app/",
    nextjsCompatible: true,
    color: "from-pink-500 to-rose-600"
  },
  {
    name: "Qdrant",
    description: "High-performance vector database for AI applications with filtering and payload support",
    icon: "https://qdrant.tech/favicon.ico",
    features: ["Vector search", "Filtering", "Hybrid search", "Open source"],
    category: "Vector",
    popularity: "Growing",
    url: "https://qdrant.tech/",
    nextjsCompatible: true,
    color: "from-red-500 to-pink-600"
  },
  {
    name: "Weaviate",
    description: "Open-source vector database for semantic search and AI applications with ML models",
    icon: "https://weaviate.io/favicon.ico",
    features: ["Vector search", "ML models", "GraphQL API", "Hybrid search"],
    category: "Vector",
    popularity: "Growing",
    url: "https://weaviate.io/",
    nextjsCompatible: true,
    color: "from-green-600 to-teal-600"
  },
];

export default function DatabasesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = ["All", "SQL", "NoSQL", "Cloud", "Graph", "Vector", "Cache"];

  const filteredDatabases = databases.filter((db) => {
    const matchesSearch =
      db.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      db.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      db.features.some(f => f.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === "All" || db.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
      {/* Background geometric pattern */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="background-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#background-grid)" />
        </svg>
      </div>

      <Navbar />

      {/* Content Wrapper with Side Lines */}
      <div className="relative flex flex-col justify-start items-center w-full min-h-screen">
        <div className="w-full max-w-none px-4 sm:px-6 md:px-8 lg:px-12 lg:max-w-[1270px] lg:w-[1360px] relative">
          {/* Enhanced Left vertical line with geometric elements */}
          <div className="hidden sm:block w-[1px] h-full absolute left-4 sm:left-6 md:left-8 lg:left-0 top-0 bg-border/30 z-0">
            {/* Decorative elements along the line */}
            <div className="absolute top-32 left-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
            <div className="absolute top-64 left-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
            <div className="absolute top-96 left-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
          </div>

          {/* Enhanced Right vertical line with geometric elements */}
          <div className="hidden sm:block w-[1px] h-full absolute right-4 sm:right-6 md:right-8 lg:right-0 top-0 bg-border/30 z-0">
            {/* Decorative elements along the line */}
            <div className="absolute top-40 right-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
            <div className="absolute top-72 right-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
            <div className="absolute top-[400px] right-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
          </div>

          {/* Left decorative dashed border - outside of main lines */}
          <div
            className="absolute dark:opacity-[0.15] opacity-[0.2] left-[-60px] top-0 w-[60px] h-full border border-dashed dark:border-[#eee] border-[#000]/70 hidden xl:block pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(-45deg, transparent, transparent 2px, currentcolor 2px, currentcolor 3px, transparent 3px, transparent 6px)",
            }}
          ></div>

          {/* Right decorative dashed border - outside of main lines */}
          <div
            className="absolute dark:opacity-[0.15] opacity-[0.2] right-[-60px] top-0 w-[60px] h-full border border-dashed dark:border-[#eee] border-[#000]/70 hidden xl:block pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(-45deg, transparent, transparent 2px, currentcolor 2px, currentcolor 3px, transparent 3px, transparent 6px)",
            }}
          ></div>

          {/* Hero Section */}
          <div className="relative pt-32 pb-16 px-4 z-10">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-primary/10 backdrop-blur-sm border border-primary/20">
              <Database className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
              Next.js Databases
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Explore the best database solutions compatible with Next.js From SQL to NoSQL, find the perfect data store for your application.
            </p>
          </motion.div>

          {/* Search and Filter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-12 space-y-6"
          >
            {/* Search */}
            <div className="max-w-2xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search databases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 text-base rounded-2xl backdrop-blur-xl bg-background/40 border-border/30"
              />
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap justify-center gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                    selectedCategory === category
                      ? "bg-primary text-primary-foreground shadow-lg scale-105"
                      : "bg-background/40 backdrop-blur-xl border border-border/30 text-muted-foreground hover:text-foreground hover:bg-background/60 hover:scale-105"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

          {/* Database Cards */}
          <div className="relative max-w-7xl mx-auto px-4 pb-24 z-10">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                visible: {
                  transition: {
                    staggerChildren: 0.05,
                  },
                },
              }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
          {filteredDatabases.map((db, index) => (
            <motion.div
              key={db.name}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
            >
              <Link href={addRefParameter(db.url)} target="_blank" rel="noopener noreferrer">
                <div className="h-full p-6 rounded-2xl backdrop-blur-xl bg-background/40 border border-border/30 cursor-pointer">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-xl shadow-lg`}>
                        <Image
                          src={db.icon}
                          alt={db.name}
                          width={24}
                          height={24}
                          className="w-6 h-6 invert dark:invert-0"
                        />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-foreground">
                          {db.name}
                        </h3>
                        <span className="text-xs text-muted-foreground">{db.category}</span>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {db.description}
                  </p>

                  {/* Features */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {db.features.slice(0, 3).map((feature) => (
                      <span
                        key={feature}
                        className="px-2 py-1 text-xs rounded-lg bg-primary/10 text-primary border border-primary/20"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-border/30">
                    <div className="flex items-center space-x-2">
                      {db.popularity === "High" ? (
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      ) : db.popularity === "Growing" ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : null}
                      <span className="text-xs text-muted-foreground">{db.popularity}</span>
                    </div>
                    <span className="text-xs text-primary font-medium">Next.js Ready</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>

            {filteredDatabases.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <Database className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-xl text-muted-foreground">No databases found matching your search.</p>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
