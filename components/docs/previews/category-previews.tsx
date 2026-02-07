"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Lock,
  Sparkles,
  Image as ImageIcon,
  UploadCloud,
  Send,
} from "lucide-react";

export type PreviewProps = { isHovered: boolean };

/* ─── HERO: Holographic Depth ─────────────────────────────────────────
   Parallax layers float apart on hover + vertical scan line           */
export const HeroPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full flex flex-col items-center justify-center p-5 relative overflow-hidden">
    <div
      className="absolute inset-0 opacity-[0.03]"
      style={{
        backgroundImage:
          "radial-gradient(circle, currentColor 1px, transparent 1px)",
        backgroundSize: "14px 14px",
      }}
    />

    <motion.div
      className="z-20 flex flex-col items-center gap-1.5"
      animate={isHovered ? { y: -10 } : { y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
    >
      <div className="h-3.5 w-24 bg-foreground/10 rounded-full" />
      <div className="h-2 w-16 bg-muted-foreground/8 rounded-full" />
    </motion.div>

    <motion.div
      className="z-10 flex gap-2 mt-3"
      animate={isHovered ? { y: -3 } : { y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.03 }}
    >
      <div className="h-6 w-14 bg-primary rounded-md shadow-sm" />
      <div className="h-6 w-14 bg-background border border-border rounded-md" />
    </motion.div>

    <motion.div
      className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-primary/15 to-transparent blur-xl"
      animate={isHovered ? { opacity: 1 } : { opacity: 0.15 }}
      transition={{ duration: 0.6 }}
    />

    <motion.div
      className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      initial={{ top: 0 }}
      animate={isHovered ? { top: ["0%", "100%"] } : { top: "0%" }}
      transition={
        isHovered
          ? { duration: 2.5, repeat: Infinity, ease: "linear" }
          : { duration: 0.3 }
      }
      style={{ opacity: isHovered ? 1 : 0 }}
    />
  </div>
);

/* ─── CONTACT: Signal Pulse ───────────────────────────────────────────
   Concentric ripple rings radiating from a central beacon             */
export const ContactPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className="absolute rounded-full border border-primary/20"
        initial={{ width: 16, height: 16, opacity: 0 }}
        animate={
          isHovered
            ? { width: [16, 140], height: [16, 140], opacity: [0.5, 0] }
            : { width: 16, height: 16, opacity: 0 }
        }
        transition={
          isHovered
            ? { duration: 2.5, repeat: Infinity, delay: i * 0.7, ease: "easeOut" }
            : { duration: 0.3 }
        }
      />
    ))}

    <div className="relative z-10 flex flex-col items-center gap-2.5">
      <motion.div
        className="w-7 h-7 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center"
        animate={isHovered ? { scale: [1, 1.15, 1] } : { scale: 1 }}
        transition={isHovered ? { duration: 2, repeat: Infinity } : {}}
      >
        <Send className="w-3 h-3 text-primary" />
      </motion.div>
      <div className="w-24 space-y-1.5">
        <div className="h-5 bg-background border border-border rounded px-1.5 flex items-center">
          <div className="h-1 w-2/3 bg-muted-foreground/15 rounded-full" />
        </div>
        <div className="h-4 bg-primary rounded flex items-center justify-center">
          <div className="w-6 h-1 bg-primary-foreground/40 rounded-full" />
        </div>
      </div>
    </div>
  </div>
);

/* ─── FOOTER: Data Horizon ────────────────────────────────────────────
   Column layout with diagonal shimmer sweep + pulsing social dots     */
export const FooterPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full p-4 flex flex-col relative overflow-hidden">
    <div className="flex-1 flex gap-6 mt-1">
      {[0, 1].map((col) => (
        <div key={col} className="flex-1 space-y-2">
          <div className="h-2 w-1/2 bg-muted-foreground/20 rounded-full" />
          {[0, 1, 2].map((row) => (
            <motion.div
              key={row}
              className="h-1 rounded-full bg-muted-foreground/8"
              style={{ width: `${65 + row * 10}%` }}
              animate={isHovered ? { opacity: [0.4, 0.9, 0.4] } : { opacity: 0.4 }}
              transition={
                isHovered
                  ? { duration: 2, repeat: Infinity, delay: (col * 3 + row) * 0.15 }
                  : {}
              }
            />
          ))}
        </div>
      ))}
    </div>

    <div className="mt-auto pt-3 border-t border-border/40 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-primary/10" />
        <div className="h-1.5 w-12 bg-muted-foreground/15 rounded-full" />
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="h-3.5 w-3.5 rounded-full bg-muted-foreground/20"
            animate={
              isHovered
                ? { scale: [1, 1.3, 1], opacity: [0.3, 0.8, 0.3] }
                : { scale: 1, opacity: 0.3 }
            }
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.25 }}
          />
        ))}
      </div>
    </div>

    <motion.div
      className="absolute top-0 left-0 w-1/3 h-full bg-gradient-to-r from-transparent via-primary/[0.05] to-transparent -skew-x-12"
      animate={isHovered ? { x: ["-100%", "400%"] } : { x: "-100%" }}
      transition={
        isHovered
          ? { duration: 2.5, repeat: Infinity, ease: "linear" }
          : { duration: 0 }
      }
    />
  </div>
);

/* ─── ABOUT: Orbital ──────────────────────────────────────────────────
   Profile placeholder with orbiting particle dots                     */
export const AboutPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full flex items-center justify-center gap-4 p-4 relative overflow-hidden">
    <div className="relative">
      <div className="w-16 h-16 bg-muted border border-border rounded-lg flex items-center justify-center">
        <ImageIcon className="w-5 h-5 text-muted-foreground/20" />
      </div>
      <motion.div
        className="absolute -inset-3"
        animate={isHovered ? { rotate: 360 } : { rotate: 0 }}
        transition={
          isHovered
            ? { duration: 6, repeat: Infinity, ease: "linear" }
            : { duration: 0.5 }
        }
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary/60" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary/30" />
      </motion.div>
    </div>

    <div className="flex-1 space-y-2">
      <div className="h-2.5 w-3/4 bg-foreground/8 rounded-full" />
      <div className="space-y-1">
        {[100, 85, 70].map((w, i) => (
          <motion.div
            key={i}
            className="h-1 bg-muted-foreground/8 rounded-full"
            animate={
              isHovered
                ? { width: [`${w}%`, `${w - 10}%`, `${w}%`] }
                : { width: `${w}%` }
            }
            transition={
              isHovered ? { duration: 3, repeat: Infinity, delay: i * 0.2 } : {}
            }
          />
        ))}
      </div>
    </div>
  </div>
);

/* ─── FEATURES: Morph Assembly ────────────────────────────────────────
   Grid cells rotate & pop in with staggered spring                    */
export const FeaturesPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full p-4 flex items-center justify-center">
    <div className="grid grid-cols-2 gap-2 w-full max-w-[140px]">
      {[
        { cls: "bg-primary/10 border-primary/20", delay: 0 },
        { cls: "bg-card border-border", delay: 0.1 },
        { cls: "bg-card border-border", delay: 0.2 },
        { cls: "bg-primary/10 border-primary/20", delay: 0.3 },
      ].map((cell, i) => (
        <motion.div
          key={i}
          className={`aspect-square rounded-lg border ${cell.cls}`}
          animate={
            isHovered
              ? { scale: [1, 0.82, 1.06, 1], rotate: [0, -4, 3, 0] }
              : { scale: 1, rotate: 0 }
          }
          transition={
            isHovered
              ? { duration: 1.2, delay: cell.delay, ease: "easeInOut" }
              : { duration: 0.3 }
          }
        />
      ))}
    </div>
  </div>
);

/* ─── TESTIMONIALS: Marquee Cards ─────────────────────────────────────
   Scrolling review cards with avatars and star ratings                */
export const TestimonialsPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full flex flex-col justify-center overflow-hidden px-3 gap-2">
    {[0, 1].map((row) => (
      <motion.div
        key={row}
        className="flex gap-2"
        animate={
          isHovered
            ? { x: row === 0 ? [0, -60, 0] : [0, 40, 0] }
            : { x: 0 }
        }
        transition={
          isHovered
            ? { duration: 4, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.4 }
        }
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="min-w-[90px] bg-card border border-border/50 rounded-lg p-2 space-y-1.5 shadow-sm"
          >
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-muted-foreground/15" />
              <div className="h-1 w-8 bg-muted-foreground/15 rounded-full" />
            </div>
            <div className="flex gap-[2px]">
              {[0, 1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className="w-1.5 h-1.5 rounded-[1px] bg-amber-400/60"
                />
              ))}
            </div>
            <div className="space-y-1">
              <div className="h-1 w-full bg-muted-foreground/8 rounded-full" />
              <div className="h-1 w-2/3 bg-muted-foreground/8 rounded-full" />
            </div>
          </div>
        ))}
      </motion.div>
    ))}
  </div>
);

/* ─── CTA: Energy Core ────────────────────────────────────────────────
   Pulsing concentric rings radiating from a central button            */
export const CtaPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className="absolute rounded-full border border-primary/15"
        animate={
          isHovered
            ? { width: [28, 130], height: [28, 130], opacity: [0.4, 0] }
            : { width: 28, height: 28, opacity: 0 }
        }
        transition={
          isHovered
            ? { duration: 2, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }
            : { duration: 0.3 }
        }
      />
    ))}

    <motion.div
      className="relative z-10 px-5 py-2 bg-primary rounded-lg shadow-lg flex items-center justify-center"
      animate={isHovered ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={isHovered ? { duration: 1.5, repeat: Infinity } : {}}
    >
      <div className="h-2 w-10 bg-primary-foreground/40 rounded-full" />
    </motion.div>
  </div>
);

/* ─── AI: Neural Mesh ─────────────────────────────────────────────────
   Connected nodes with pulsing travel lines                           */
export const AIPreview = ({ isHovered }: PreviewProps) => {
  const nodes = [
    { x: 25, y: 25 },
    { x: 70, y: 20 },
    { x: 50, y: 50 },
    { x: 20, y: 75 },
    { x: 75, y: 70 },
  ];
  const edges = [
    [0, 2],
    [1, 2],
    [2, 3],
    [2, 4],
    [0, 3],
    [1, 4],
  ];

  return (
    <div className="w-full h-full relative overflow-hidden">
      <svg className="absolute inset-0 w-full h-full">
        {edges.map(([a, b], i) => (
          <motion.line
            key={i}
            x1={`${nodes[a].x}%`}
            y1={`${nodes[a].y}%`}
            x2={`${nodes[b].x}%`}
            y2={`${nodes[b].y}%`}
            stroke="currentColor"
            className="text-primary/15"
            strokeWidth={1}
            animate={
              isHovered
                ? { opacity: [0.15, 0.5, 0.15] }
                : { opacity: 0.1 }
            }
            transition={
              isHovered
                ? { duration: 2, repeat: Infinity, delay: i * 0.2 }
                : {}
            }
          />
        ))}
      </svg>

      {nodes.map((node, i) => (
        <motion.div
          key={i}
          className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
        >
          <motion.div
            className="w-full h-full rounded-full bg-primary/30 border border-primary/40"
            animate={
              isHovered
                ? { scale: [1, 1.5, 1], opacity: [0.4, 0.9, 0.4] }
                : { scale: 1, opacity: 0.3 }
            }
            transition={
              isHovered
                ? { duration: 1.8, repeat: Infinity, delay: i * 0.25 }
                : {}
            }
          />
          {isHovered && (
            <motion.div
              className="absolute inset-0 rounded-full border border-primary/20"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 2.5, opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
            />
          )}
        </motion.div>
      ))}
    </div>
  );
};

/* ─── DIALOG: Dimensional Portal ──────────────────────────────────────
   Circle expanding from center, revealing content behind              */
export const DialogPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
    <div className="absolute inset-0 grid grid-cols-2 gap-2 p-4 opacity-30">
      <div className="bg-muted-foreground/15 rounded h-10" />
      <div className="bg-muted-foreground/15 rounded h-10" />
      <div className="bg-muted-foreground/15 rounded h-20 col-span-2" />
    </div>

    <motion.div
      className="absolute inset-0 bg-background/60 backdrop-blur-[2px]"
      animate={isHovered ? { opacity: [0, 0.6, 0.6, 0] } : { opacity: 0 }}
      transition={
        isHovered
          ? { duration: 3, repeat: Infinity, times: [0, 0.15, 0.8, 1] }
          : { duration: 0.3 }
      }
    />

    <motion.div
      className="relative z-10 w-3/5 bg-card border border-border shadow-xl rounded-xl p-3 flex flex-col gap-2"
      animate={
        isHovered
          ? {
              scale: [0.5, 1, 1, 0.5],
              opacity: [0, 1, 1, 0],
              borderRadius: ["50%", "12px", "12px", "50%"],
            }
          : { scale: 1, opacity: 1, borderRadius: "12px" }
      }
      transition={
        isHovered
          ? { duration: 3, repeat: Infinity, times: [0, 0.15, 0.8, 1] }
          : { duration: 0.3 }
      }
    >
      <div className="h-2 w-1/2 bg-foreground/15 rounded-full" />
      <div className="h-1.5 w-full bg-muted-foreground/8 rounded-full" />
      <div className="h-1.5 w-2/3 bg-muted-foreground/8 rounded-full" />
      <div className="flex gap-2 mt-1">
        <div className="h-4 flex-1 bg-muted rounded" />
        <div className="h-4 flex-1 bg-primary rounded" />
      </div>
    </motion.div>
  </div>
);

/* ─── FILE UPLOAD: Tractor Beam ───────────────────────────────────────
   Particles being pulled upward into a target zone                    */
export const FileUploadPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full flex flex-col items-center justify-center p-4 relative overflow-hidden">
    <div className="w-full h-full border-2 border-dashed border-muted-foreground/15 rounded-lg flex flex-col items-center justify-center gap-2 bg-background/30 relative overflow-hidden">
      <motion.div
        animate={isHovered ? { y: [-4, 4, -4] } : { y: 0 }}
        transition={
          isHovered
            ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
            : {}
        }
      >
        <UploadCloud className="w-6 h-6 text-muted-foreground/40" />
      </motion.div>

      <div className="w-2/3 h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          animate={
            isHovered
              ? { width: ["0%", "100%", "100%"], opacity: [1, 1, 0] }
              : { width: "0%", opacity: 1 }
          }
          transition={
            isHovered ? { duration: 2.5, repeat: Infinity } : { duration: 0 }
          }
        />
      </div>

      {isHovered &&
        [0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-primary/40"
            style={{ left: `${20 + i * 15}%` }}
            initial={{ bottom: -4, opacity: 0 }}
            animate={{ bottom: ["10%", "60%"], opacity: [0, 0.8, 0] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.25,
              ease: "easeOut",
            }}
          />
        ))}
    </div>
  </div>
);

/* ─── FORM: Neural Sequence ───────────────────────────────────────────
   Fields activate one-by-one in a cascade with a traveling glow       */
export const FormPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full p-4 flex flex-col gap-2.5 justify-center">
    {[0, 1, 2].map((i) => (
      <div key={i} className="relative">
        <motion.div
          className="h-8 w-full bg-background border border-border rounded flex items-center px-2.5 shadow-sm relative overflow-hidden"
          animate={
            isHovered
              ? { borderColor: ["var(--border)", "hsl(var(--primary))", "var(--border)"] }
              : { borderColor: "var(--border)" }
          }
          transition={
            isHovered
              ? { duration: 2.5, repeat: Infinity, delay: i * 0.7, times: [0, 0.15, 1] }
              : { duration: 0 }
          }
        >
          <div className="h-1.5 w-1/3 bg-muted-foreground/15 rounded-full" />
          <motion.div
            className="absolute bottom-0 left-0 h-[2px] bg-primary"
            animate={isHovered ? { width: ["0%", "100%", "0%"] } : { width: "0%" }}
            transition={
              isHovered
                ? { duration: 2.5, repeat: Infinity, delay: i * 0.7, times: [0, 0.15, 0.6] }
                : { duration: 0 }
            }
          />
        </motion.div>
      </div>
    ))}
  </div>
);

/* ─── GRID: Blueprint Build ───────────────────────────────────────────
   Wireframe cards filling in with color one by one                    */
export const GridPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full p-4 flex items-center justify-center">
    <div className="grid grid-cols-3 gap-2 w-full max-w-[200px]">
      <motion.div
        className="col-span-2 row-span-2 rounded-md border flex flex-col p-2 gap-1.5"
        animate={
          isHovered
            ? {
                backgroundColor: [
                  "rgba(0,0,0,0)",
                  "var(--card)",
                  "var(--card)",
                  "rgba(0,0,0,0)",
                ],
                borderColor: [
                  "var(--border)",
                  "hsl(var(--primary))",
                  "hsl(var(--primary))",
                  "var(--border)",
                ],
              }
            : {}
        }
        transition={
          isHovered
            ? { duration: 3, repeat: Infinity, times: [0, 0.1, 0.85, 1] }
            : {}
        }
      >
        <div className="w-full h-2/3 bg-muted/30 rounded-sm" />
        <div className="w-2/3 h-1.5 bg-muted-foreground/15 rounded-full" />
        <div className="w-1/2 h-1.5 bg-muted-foreground/8 rounded-full" />
      </motion.div>

      {[0, 1].map((i) => (
        <motion.div
          key={i}
          className="rounded-md border border-border"
          animate={
            isHovered
              ? {
                  scale: [0.8, 1, 1, 0.8],
                  opacity: [0.3, 1, 1, 0.3],
                }
              : { scale: 1, opacity: 0.7 }
          }
          transition={
            isHovered
              ? { duration: 3, repeat: Infinity, delay: 0.1 + i * 0.15, times: [0, 0.1, 0.85, 1] }
              : {}
          }
          style={{
            backgroundColor: i === 0 ? "var(--primary-5, rgba(0,0,0,0.03))" : undefined,
          }}
        />
      ))}
    </div>
  </div>
);

/* ─── AUTH: Vault Scan ────────────────────────────────────────────────
   Scanning beam sweeping horizontally over a lock card                */
export const AuthPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full flex items-center justify-center p-4 relative overflow-hidden">
    <div className="w-4/5 max-w-[160px] bg-card border border-border shadow-sm rounded-lg p-3 space-y-2 relative overflow-hidden">
      <div className="flex justify-center mb-1">
        <motion.div
          className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center"
          animate={isHovered ? { scale: [1, 1.1, 1] } : { scale: 1 }}
          transition={isHovered ? { duration: 2, repeat: Infinity } : {}}
        >
          <Lock className="w-3.5 h-3.5 text-primary" />
        </motion.div>
      </div>
      <div className="h-6 bg-background border border-border rounded px-2 flex items-center">
        <motion.div
          className="flex gap-0.5"
          animate={isHovered ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.5 }}
          transition={isHovered ? { duration: 1.5, repeat: Infinity } : {}}
        >
          {[0, 1, 2, 3].map((d) => (
            <div key={d} className="w-1.5 h-1.5 bg-foreground/60 rounded-full" />
          ))}
        </motion.div>
      </div>
      <motion.div
        className="h-6 bg-primary rounded flex items-center justify-center"
        animate={isHovered ? { scale: [1, 0.96, 1] } : { scale: 1 }}
        transition={
          isHovered ? { duration: 2, repeat: Infinity, times: [0.8, 0.9, 1] } : {}
        }
      >
        <div className="w-8 h-1.5 bg-primary-foreground/40 rounded-full" />
      </motion.div>

      <motion.div
        className="absolute inset-y-0 w-10 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
        animate={
          isHovered
            ? { left: ["-40px", "calc(100% + 40px)"] }
            : { left: "-40px" }
        }
        transition={
          isHovered
            ? { duration: 2, repeat: Infinity, ease: "linear" }
            : { duration: 0 }
        }
      />
    </div>
  </div>
);

/* ─── SIDEBAR: Staggered Reveal ───────────────────────────────────────
   Menu items slide in from the left with staggered timing             */
export const SidebarPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full flex relative overflow-hidden">
    <div className="w-1/3 h-full bg-card border-r border-border p-2 flex flex-col gap-1.5 z-10 relative">
      <div className="h-4 w-4 bg-primary/20 rounded mb-2" />
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="h-2 rounded-full bg-muted-foreground/15"
          style={{ width: `${75 - i * 8}%` }}
          animate={
            isHovered
              ? { x: [-20, 0], opacity: [0, 1] }
              : { x: 0, opacity: 0.5 }
          }
          transition={
            isHovered
              ? { duration: 0.4, delay: i * 0.08, ease: "easeOut" }
              : { duration: 0.3 }
          }
        />
      ))}
      <motion.div
        className="absolute left-0 w-[2px] bg-primary rounded-r-full"
        style={{ top: 36 }}
        animate={isHovered ? { height: 10, opacity: 1 } : { height: 0, opacity: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      />
    </div>
    <div className="flex-1 p-2.5 space-y-2 opacity-40">
      <div className="h-1.5 w-1/4 bg-muted-foreground/15 rounded" />
      <div className="h-14 w-full bg-background rounded border border-border/50" />
      <div className="h-14 w-full bg-background rounded border border-border/50" />
    </div>
  </div>
);

/* ─── STATS: Data Surge ───────────────────────────────────────────────
   Rising bars with glowing tip caps                                   */
export const StatsPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full p-5 flex items-end gap-2.5">
    {[40, 70, 55, 85, 45].map((h, i) => (
      <motion.div
        key={i}
        className="flex-1 bg-primary/40 rounded-t-sm relative overflow-hidden"
        animate={
          isHovered
            ? { height: `${h}%`, opacity: 1 }
            : { height: `${h * 0.5}%`, opacity: 0.5 }
        }
        transition={{
          duration: 0.8,
          delay: i * 0.08,
          ease: [0.16, 1, 0.3, 1],
        }}
        style={{ minHeight: 4 }}
      >
        <motion.div
          className="absolute top-0 inset-x-0 h-[2px] bg-primary"
          animate={isHovered ? { opacity: [0.4, 1, 0.4] } : { opacity: 0 }}
          transition={
            isHovered ? { duration: 1.2, repeat: Infinity, delay: i * 0.1 } : {}
          }
        />
      </motion.div>
    ))}
  </div>
);

/* ─── TABLES: Row Scan ────────────────────────────────────────────────
   Sequential row highlighting like a data scanner                     */
export const TablesPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full p-3 flex flex-col gap-1.5 overflow-hidden">
    <div className="h-6 w-full bg-muted/30 border border-border/50 rounded flex items-center px-2 gap-3">
      <div className="h-1.5 w-6 bg-muted-foreground/15 rounded-full" />
      <div className="h-1.5 w-12 bg-muted-foreground/15 rounded-full" />
      <div className="h-1.5 w-8 bg-muted-foreground/15 rounded-full ml-auto" />
    </div>
    {[0, 1, 2, 3].map((i) => (
      <div
        key={i}
        className="relative h-5 w-full border-b border-border/30 flex items-center px-2 gap-3"
      >
        <motion.div
          className="absolute inset-0 rounded-sm bg-primary/[0.04]"
          animate={isHovered ? { opacity: [0, 1, 0] } : { opacity: 0 }}
          transition={
            isHovered
              ? { duration: 2.5, repeat: Infinity, delay: i * 0.45 }
              : { duration: 0.3 }
          }
        />
        <div className="h-1 w-3 bg-muted-foreground/15 rounded-full" />
        <div className="h-1 w-10 bg-muted-foreground/10 rounded-full" />
        <div className="h-1 w-6 bg-muted-foreground/10 rounded-full ml-auto" />
      </div>
    ))}
  </div>
);

/* ─── COMPONENTS: Circuit Trace ───────────────────────────────────────
   Building blocks with glowing circuit-like connections               */
export const ComponentsPreview = ({ isHovered }: PreviewProps) => (
  <div className="w-full h-full p-4 flex flex-col gap-2.5 justify-center relative overflow-hidden">
    <div className="flex gap-2">
      <motion.div
        className="flex-1 h-11 bg-background border border-border rounded-lg flex items-center justify-center shadow-sm"
        animate={
          isHovered
            ? {
                borderColor: ["var(--border)", "hsl(var(--primary))", "var(--border)"],
                scale: [1, 1.04, 1],
              }
            : { borderColor: "var(--border)", scale: 1 }
        }
        transition={isHovered ? { duration: 2, repeat: Infinity } : { duration: 0 }}
      >
        <div className="w-6 h-1.5 bg-primary/50 rounded-full" />
      </motion.div>
      <motion.div
        className="w-11 h-11 bg-muted rounded-lg flex items-center justify-center"
        animate={
          isHovered
            ? { scale: [1, 1.04, 1], rotate: [0, 3, 0] }
            : { scale: 1 }
        }
        transition={
          isHovered ? { duration: 2, repeat: Infinity, delay: 0.4 } : { duration: 0 }
        }
      >
        <div className="w-4 h-4 bg-background rounded-sm" />
      </motion.div>
    </div>

    <motion.div
      className="h-8 bg-card border border-border rounded-lg flex items-center px-3 gap-2 shadow-sm relative overflow-hidden"
      animate={
        isHovered
          ? { borderColor: ["var(--border)", "hsl(var(--primary))", "var(--border)"] }
          : { borderColor: "var(--border)" }
      }
      transition={
        isHovered ? { duration: 2, repeat: Infinity, delay: 0.8 } : { duration: 0 }
      }
    >
      <motion.div
        className="w-2 h-2 rounded-full bg-green-500"
        animate={isHovered ? { scale: [1, 1.4, 1] } : { scale: 1 }}
        transition={isHovered ? { duration: 1.5, repeat: Infinity } : {}}
      />
      <div className="w-14 h-1.5 bg-muted-foreground/15 rounded-full" />

      <motion.div
        className="absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-primary/[0.06] to-transparent"
        animate={
          isHovered
            ? { left: ["-48px", "calc(100% + 48px)"] }
            : { left: "-48px" }
        }
        transition={
          isHovered
            ? { duration: 1.8, repeat: Infinity, ease: "linear", delay: 0.8 }
            : { duration: 0 }
        }
      />
    </motion.div>
  </div>
);

/* ─── PREVIEWS MAP ────────────────────────────────────────────────── */
export const PREVIEWS: Record<string, React.ComponentType<PreviewProps>> = {
  Components: ComponentsPreview,
  Ui: ComponentsPreview,
  "AI Interface": AIPreview,
  Dialogs: DialogPreview,
  "File Upload": FileUploadPreview,
  "Form Layouts": FormPreview,
  "Grid List": GridPreview,
  Authentication: AuthPreview,
  Sidebar: SidebarPreview,
  Analytics: StatsPreview,
  "Data Tables": TablesPreview,
  Hero: HeroPreview,
  Contact: ContactPreview,
  Footer: FooterPreview,
  About: AboutPreview,
  Features: FeaturesPreview,
  Testimonials: TestimonialsPreview,
  Cta: CtaPreview,
};
