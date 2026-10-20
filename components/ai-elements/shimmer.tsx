"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import {
  type CSSProperties,
  type ElementType,
  type JSX,
  memo,
  useMemo,
  useState,
} from "react";

export type TextShimmerProps = {
  children: string;
  as?: ElementType;
  className?: string;
  duration?: number;
  spread?: number;
};

const ShimmerComponent = ({
  children,
  as: Component = "p",
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) => {
  /**
   * The tag the shimmer wears, and the component that wears it.
   *
   * A motion component built during render is a new component on every
   * pass, and React starts it from nothing each time: the sweep begins
   * again and whatever the element held is lost. The component is built
   * once and kept, and a tag that arrives later replaces it rather than
   * the shimmer going on wearing the old one.
   */
  const [MotionComponent, setMotionComponent] = useState(() =>
    motion.create(Component as keyof JSX.IntrinsicElements),
  );
  const [tag, setTag] = useState<ElementType>(Component);
  if (tag !== Component) {
    setTag(Component);
    setMotionComponent(motion.create(Component as keyof JSX.IntrinsicElements));
  }

  const dynamicSpread = useMemo(
    () => (children?.length ?? 0) * spread,
    [children, spread]
  );

  return (
    <MotionComponent
      animate={{ backgroundPosition: "0% center" }}
      className={cn(
        "relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
        "[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--color-background),#0000_calc(50%+var(--spread)))] [background-repeat:no-repeat,padding-box]",
        className
      )}
      initial={{ backgroundPosition: "100% center" }}
      style={
        {
          "--spread": `${dynamicSpread}px`,
          backgroundImage:
            "var(--bg), linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground))",
        } as CSSProperties
      }
      transition={{
        repeat: Number.POSITIVE_INFINITY,
        duration,
        ease: "linear",
      }}
    >
      {children}
    </MotionComponent>
  );
};

export const Shimmer = memo(ShimmerComponent);
