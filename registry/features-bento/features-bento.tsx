"use client";

import { motion } from "framer-motion";
import { 
  Cpu, 
  Globe, 
  Zap, 
  ShieldCheck, 
  Rocket, 
  BarChart3 
} from "lucide-react";

const features = [
  {
    title: "Global Edge Network",
    description: "Deploy your application to over 300+ edge locations worldwide for lightning fast latency.",
    icon: Globe,
    className: "md:col-span-2",
    gradient: "from-blue-500/20 via-cyan-500/20 to-teal-500/20",
  },
  {
    title: "Instant Scaling",
    description: "Handle millions of requests with zero configuration.",
    icon: Zap,
    className: "md:col-span-1",
    gradient: "from-purple-500/20 via-pink-500/20 to-red-500/20",
  },
  {
    title: "Enterprise Security",
    description: "Bank-grade encryption and DDoS protection included.",
    icon: ShieldCheck,
    className: "md:col-span-1",
    gradient: "from-amber-500/20 via-orange-500/20 to-yellow-500/20",
  },
  {
    title: "Real-time Analytics",
    description: "Track performance metrics and user behavior in real-time.",
    icon: BarChart3,
    className: "md:col-span-2",
    gradient: "from-emerald-500/20 via-green-500/20 to-lime-500/20",
  },
];

export function FeaturesBento() {
  return (
    <section className="py-24 px-4 md:px-8 bg-background text-foreground overflow-hidden">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary"
          >
            <Rocket className="mr-2 h-3.5 w-3.5" />
            Powerful Features
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-5xl font-black tracking-tight"
          >
            Everything you need to <span className="text-primary">scale</span>.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-muted-foreground"
          >
            Our platform provides the infrastructure and tools you need to build next-generation applications.
          </motion.p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`group relative overflow-hidden rounded-3xl border border-border/50 bg-card p-8 hover:border-border transition-colors duration-500 ${feature.className}`}
            >
              {/* Background Gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-700 ${feature.gradient}`} />
              
              {/* Content */}
              <div className="relative z-10 flex flex-col h-full justify-between gap-8">
                <div className="p-3 w-fit rounded-2xl bg-background/50 border border-border/50 backdrop-blur-sm group-hover:scale-110 transition-transform duration-500">
                  <feature.icon className="w-6 h-6 text-foreground" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold tracking-tight">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>

              {/* Decorative Blur */}
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-colors duration-700" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
