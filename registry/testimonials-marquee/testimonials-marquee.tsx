"use client";

import React from "react";
import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Product Designer @ Stripe",
    content: "This library has completely transformed how we build internal tools. The attention to detail is unmatched.",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
  },
  {
    name: "Alex Rivera",
    role: "CTO @ Vercel",
    content: "Ideally, every project would start with this foundation. It's clean, performant, and absolutely stunning.",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
  },
  {
    name: "Jordan Lee",
    role: "Frontend Lead @ Airbnb",
    content: "The animations are buttery smooth and the code is a joy to work with. Highly recommended.",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan",
  },
  {
    name: "Emily Zhang",
    role: "Developer Advocate",
    content: "I've never seen a component library this polished right out of the box. True craftsmanship.",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emily",
  },
  {
    name: "David Kim",
    role: "Indie Hacker",
    content: "Shipped my SaaS in record time thanks to these blocks. The bento grids are a game changer.",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=David",
  },
];

const MarqueeCard = ({ testimonial }: { testimonial: typeof testimonials[0] }) => (
  <div className="relative w-[350px] flex-shrink-0 rounded-2xl border border-border/60 bg-card p-6 shadow-sm mx-3">
    <Quote className="absolute top-6 right-6 h-4 w-4 text-muted-foreground/20" />
    <div className="flex flex-col gap-4">
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="h-4 w-4 fill-amber-500 text-amber-500" />
        ))}
      </div>
      <p className="text-muted-foreground leading-relaxed">
        "{testimonial.content}"
      </p>
      <div className="flex items-center gap-3 mt-2">
        <div className="h-10 w-10 overflow-hidden rounded-full border border-border bg-muted">
          <img src={testimonial.avatar} alt={testimonial.name} className="h-full w-full object-cover" />
        </div>
        <div>
          <h4 className="font-semibold text-sm">{testimonial.name}</h4>
          <p className="text-xs text-muted-foreground">{testimonial.role}</p>
        </div>
      </div>
    </div>
  </div>
);

export function TestimonialsMarquee() {
  return (
    <section className="py-24 bg-background overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-4 md:px-8 mb-16 text-center">
        <h2 className="text-4xl font-black tracking-tight mb-4">Loved by <span className="text-primary">Builders</span></h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Join thousands of developers building the future of the web.
        </p>
      </div>

      <div className="flex flex-col gap-6 mask-linear-fade">
        {/* Row 1: Left to Right */}
        <div className="flex overflow-hidden">
          <motion.div
            animate={{ x: [0, -1000] }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            className="flex"
          >
            {[...testimonials, ...testimonials, ...testimonials].map((t, i) => (
              <MarqueeCard key={`row1-${i}`} testimonial={t} />
            ))}
          </motion.div>
        </div>

        {/* Row 2: Right to Left */}
        <div className="flex overflow-hidden">
          <motion.div
            animate={{ x: [-1000, 0] }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            className="flex"
          >
            {[...testimonials, ...testimonials, ...testimonials].map((t, i) => (
              <MarqueeCard key={`row2-${i}`} testimonial={t} />
            ))}
          </motion.div>
        </div>
      </div>
      
      {/* Fade Edges */}
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
    </section>
  );
}
