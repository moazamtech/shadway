import * as React from "react";

import { Dots, FaceText, Line, Solid } from "@/components/iso/react/draw";
import {
  cylinder,
  insetPlan,
  iso,
  knurl,
  lineOnTop,
  planOutline,
  ring,
  segment,
  sideMatrix,
  sideRing,
  slabOf,
  topTicks,
  type Plan,
  type SolidPaths,
} from "@/components/iso/iso-kit";

import * as V from "./view";

const { P } = V;

/** A board on the floor plan from z, ten units thick, with a soft top edge. */
const S = (plan: Plan, z: number, h: number, steps = 4, bevel = 0): SolidPaths =>
  slabOf(plan, z, h, P, steps, bevel);

/** A round part: foot, post, knob. */
const C = (cx: number, cy: number, r: number, z: number, h: number, steps = 20, bevel = 0) =>
  cylinder(cx, cy, r, z, h, P, steps, bevel);

/* -------------------------------------------------------------------------
   The base: a heavy plate on four feet, with a maker's plate and a rule
   on its front strip.
   ---------------------------------------------------------------------- */

const LABEL: Plan = { x: -104, y: 20, w: 66, d: 9, r: 1.4 };
const RULER: Plan = { x: 22, y: 20, w: 82, d: 9, r: 1.4 };
const SCREWS: Array<[number, number]> = [
  [-100, -30],
  [100, -30],
  [-100, 30],
  [100, 30],
];

const TICKS = topTicks(RULER.x + 6, RULER.x + RULER.w - 6, 3, 5, RULER.y + 1, 1.5, [1.3, 2.7], P, "x");

function Foot({ x, y }: { x: number; y: number }) {
  return (
    <>
      <Solid paths={C(x, y, 9, V.BASE_Z - 2.6, 2.6, 20, 0.45)} tone="lo" />
      <Solid paths={C(x, y, 5.4, V.BASE_Z - 8.4, 5.8, 16, 0.3)} tone="mid" />
    </>
  );
}

export const BASE_NODE: React.ReactNode = (
  <>
    {/* the feet first, so the plate beds down onto them */}
    {V.FEET.map(([x, y]) => (
      <Foot key={`foot-${x}-${y}`} x={x} y={y} />
    ))}
    <Solid paths={S(V.BASE, V.BASE_Z, V.BASE_H, 8, 0.7)} tone="hi" halo />
    <Line d={planOutline(insetPlan(V.BASE, 7), 0.25, P, 8)} tone="faint" />
    {SCREWS.map(([x, y]) => (
      <React.Fragment key={`screw-${x}-${y}`}>
        <Line d={ring(x, y, 2.8, 0.3, P, 20)} tone="faint" />
        <Dots points={[iso([x, y, 0.35], P)]} size={1.05} tone="mid" />
      </React.Fragment>
    ))}

    {/* the maker's plate, its rule lines standing in for type */}
    <Solid paths={S(LABEL, 0, 1.6, 4, 0.25)} tone="lo" crease="faint" />
    <Line d={planOutline(insetPlan(LABEL, 1.4), 1.7, P, 4)} tone="faint" />
    {[0, 1, 2].map((row) => (
      <Line
        key={`rule-${row}`}
        d={lineOnTop(
          [LABEL.x + 4, LABEL.y + 2.4 + row * 2],
          [LABEL.x + 34 - row * 8, LABEL.y + 2.4 + row * 2],
          1.8,
          P,
        )}
        tone="faint"
        free
      />
    ))}
    <Dots
      points={[iso([LABEL.x + 57, LABEL.y + 2.8, 1.85], P), iso([LABEL.x + 57, LABEL.y + 6.4, 1.85], P)]}
      size={0.9}
      tone="lo"
    />

    {/* the rule */}
    <Solid paths={S(RULER, 0, 1.4, 4, 0.25)} tone="lo" crease="faint" />
    <Line d={TICKS.minor} tone="faint" />
    <Line d={TICKS.major} tone="lo" />
    <Dots
      points={[
        iso([RULER.x + 2.4, RULER.y + 4.5, 1.6], P),
        iso([RULER.x + RULER.w - 2.4, RULER.y + 4.5, 1.6], P),
      ]}
      size={0.9}
      tone="lo"
    />
  </>
);

/* -------------------------------------------------------------------------
   The gantry: two posts off the base plate carrying the rail the head rides.
   ---------------------------------------------------------------------- */

function Post({ x }: { x: number }) {
  const column: Plan = {
    x: x - V.POST_R,
    y: V.POST_Y - V.POST_R,
    w: V.POST_R * 2,
    d: V.POST_R * 2,
    r: 2.5,
  };
  return (
    <>
      <Solid paths={S({ x: x - 9, y: V.POST_Y - 9, w: 18, d: 18, r: 3 }, 0, 3.4, 4, 0.4)} tone="lo" />
      <Solid
        paths={S(column, 3.4, V.RAIL_TOP - 3.4, 4, 0.5)}
        tone="mid"
        inner={
          <Line
            d={segment([x, V.POST_Y + V.POST_R, 5.5], [x, V.POST_Y + V.POST_R, 74], P)}
            tone="faint"
          />
        }
      />
      <Solid paths={S({ x: x - 9, y: V.POST_Y - 9, w: 18, d: 18, r: 3 }, V.RAIL_Z - 2.5, 2.5, 4, 0.4)} tone="hi" />
      <Solid paths={S({ x: x - 8, y: V.POST_Y - 8, w: 16, d: 16, r: 3 }, V.RAIL_TOP, 3.4, 4, 0.4)} tone="lo" />
    </>
  );
}

/* -------------------------------------------------------------------------
   The piles: three cards in each of the four lower pockets.
   ---------------------------------------------------------------------- */

function Stack({ lane, z }: { lane: number; z: number }) {
  const x = V.LANE_X[lane] ?? 0;
  const plan: Plan = {
    x: x - V.CARD_W / 2,
    y: V.CARD_Y - V.CARD_D / 2,
    w: V.CARD_W,
    d: V.CARD_D,
    r: 1.4,
  };
  const top = z + 2 * V.CARD_GAP + V.CARD_H;
  return (
    <>
      {[0, 1, 2].map((card) => (
        <Solid
          key={card}
          paths={S(plan, z + card * V.CARD_GAP, V.CARD_H, 4, 0.3)}
          tone="lo"
          crease="faint"
        />
      ))}
      <Line d={planOutline(insetPlan(plan, 3.4), top, P, 4)} tone="faint" />
      <Line d={lineOnTop([plan.x + 3.6, plan.y + 3.2], [plan.x + 14, plan.y + V.CARD_D - 3.2], top, P)} tone="faint" />
    </>
  );
}

/* -------------------------------------------------------------------------
   The rack, painted back to front.
   ---------------------------------------------------------------------- */

export const BACK: React.ReactNode = (
  <>
    {/* the plinth: the floor of lane C, and the seat the shelves stand on */}
    <Solid paths={S(V.PLINTH, V.PLINTH_Z, V.PLINTH_H, 6, 0.5)} tone="hi" />
    {/* the back board */}
    <Solid paths={S(V.BACK, 0, V.RACK_TOP, 4, 0.45)} tone="mid" />
    {/* the blanking plate: nothing was ever filed in lane C */}
    <Solid paths={S(V.PLATE, 10, 26, 4, 0.4)} tone="lo" crease="mid" />
    <Line d={sideRing([32.5, -9, 14], 1.5, "y", P, 16)} tone="faint" />
    <Line d={sideRing([67.5, -9, 14], 1.5, "y", P, 16)} tone="faint" />
    <FaceText
      transform={sideMatrix([40, V.PLATE.y + V.PLATE.d], 23, P, "left")}
      size={9}
      tone="lo"
      anchor="middle"
    >
      404
    </FaceText>
    {/* the far side wall, before the shelves it carries */}
    <Solid paths={S(V.WALL_L, 0, V.RACK_TOP, 4, 0.45)} tone="mid" />

    {/* three shelves, in lanes A and B only */}
    {V.FLOOR_Z.map((z, row) => (
      <Solid key={`shelf-${row}`} paths={S(V.SHELF, z, V.FLOOR_H, 4, 0.4)} tone="hi" />
    ))}

    {/* the piles */}
    <Stack lane={0} z={V.FLOOR_Z[0] + V.FLOOR_H} />
    <Stack lane={1} z={V.FLOOR_Z[0] + V.FLOOR_H} />
    <Stack lane={0} z={V.FLOOR_Z[1] + V.FLOOR_H} />
    <Stack lane={1} z={V.FLOOR_Z[1] + V.FLOOR_H} />

    {/* the two dividers, and the near wall */}
    <Solid paths={S(V.DIV_L, V.PLINTH_H, V.RACK_TOP - V.PLINTH_H, 4, 0.4)} tone="hi" />
    <Solid paths={S(V.DIV_R, V.PLINTH_H, V.RACK_TOP - V.PLINTH_H, 4, 0.4)} tone="hi" />
    <Solid paths={S(V.WALL_R, 0, V.RACK_TOP, 4, 0.45)} tone="hi" />

    {/* the top stiffener, tying the walls together over the back */}
    <Solid paths={S(V.STIFF, V.RACK_TOP - 6, 6, 4, 0.4)} tone="hi" />

    {/* the shelf cleats lane C was fitted with — and never got a shelf for */}
    {V.FLOOR_Z.map((z, row) => (
      <React.Fragment key={`cleat-${row}`}>
        <Solid paths={S({ x: 27, y: -10, w: 3.5, d: 22, r: 0.8 }, z, V.FLOOR_H, 4, 0.3)} tone="lo" />
        <Solid paths={S({ x: 70.5, y: -10, w: 3.5, d: 22, r: 0.8 }, z, V.FLOOR_H, 4, 0.3)} tone="lo" />
      </React.Fragment>
    ))}

    {/* the low lip across the mouth of lane C */}
    <Solid paths={S(V.LIP, V.PLINTH_H, 12, 4, 0.4)} tone="lo" crease="faint" />
  </>
);

export const GANTRY: React.ReactNode = (
  <>
    <Post x={-V.POST_X} />
    <Post x={V.POST_X} />
    <Solid paths={S(V.RAIL, V.RAIL_Z, V.RAIL_H, 4, 0.5)} tone="hi" />
    <Solid
      paths={S({ x: -V.POST_X, y: -3, w: 8, d: 10, r: 2 }, V.RAIL_TOP, 5.5, 4, 0.4)}
      tone="lo"
    />
    <Solid
      paths={S({ x: V.POST_X - 8, y: -3, w: 8, d: 10, r: 2 }, V.RAIL_TOP, 5.5, 4, 0.4)}
      tone="lo"
    />
  </>
);

/* -------------------------------------------------------------------------
   The head and its needle. Head geometry is built at lane B's centre (x = 0)
   and translated in x; the needle's foot is built at z = 0 and translated in
   z, so the plunger is one static part that slides.
   ---------------------------------------------------------------------- */

export const HEAD: React.ReactNode = (
  <>
    {/* the shoes that ride the rail */}
    <Solid paths={S({ x: -25, y: -4, w: 12, d: 10, r: 2 }, V.RAIL_TOP - 1, 5, 4, 0.35)} tone="lo" />
    <Solid paths={S({ x: 13, y: -4, w: 12, d: 10, r: 2 }, V.RAIL_TOP - 1, 5, 4, 0.35)} tone="lo" />
    {/* the body */}
    <Solid paths={S({ x: -23, y: -8, w: 46, d: 20, r: 3 }, 89, 12, 6, 0.5)} tone="hi" />
    {/* the nose that overhangs the pocket mouth */}
    <Solid paths={S({ x: -9, y: 12, w: 18, d: 5, r: 1.6 }, 92, 7, 4, 0.35)} tone="lo" />
    {/* the index knob */}
    <Solid paths={C(0, 2, 8.5, 101, 1.8, 22, 0.35)} tone="lo" />
    <Solid paths={C(0, 2, 6.4, 102.8, 6.6, 28, 0.45)} tone="hi" />
    <Line d={knurl(0, 2, 6.4, 102.8, 109.4, 26, P, 0.5)} tone="faint" />
    <Solid paths={C(0, 2, 4.4, 109.4, 1.6, 20, 0.3)} tone="mid" />
    {/* two screws on the head's face */}
    <Line d={sideRing([-16, 12, 96], 2.4, "y", P, 18)} tone="faint" />
    <Line d={sideRing([16, 12, 96], 2.4, "y", P, 18)} tone="faint" />
    <Line d={segment([-9, 12, 90.6], [9, 12, 90.6], P)} tone="faint" />
  </>
);

/** The needle. It is drawn full length and clipped from below, so only the
    part above the plunger foot is ever seen. */
export const NEEDLE: React.ReactNode = (
  <Solid paths={C(0, V.NEEDLE_Y, V.NEEDLE_R, 4, V.ROD_TOP_Z - 4, 14)} tone="hi" />
);

export const CLIP_X = iso([-4, V.NEEDLE_Y, 0], P)[0];
export const CLIP_W = iso([4, V.NEEDLE_Y, 0], P)[0] - CLIP_X;
export const CLIP_TOP_Y = iso([0, V.NEEDLE_Y, V.ROD_TOP_Z], P)[1];

/** Screen height of the needle above its foot. */
export const clipHeight = (probeZ: number) =>
  Math.max(0, iso([0, V.NEEDLE_Y, probeZ + V.TIP_H], P)[1] - CLIP_TOP_Y);

/** The plunger foot: a pad and a collar, built at z = 0 so it can slide. */
export const TIP: React.ReactNode = (
  <>
    <Solid paths={C(0, V.NEEDLE_Y, 2.2, 2, V.TIP_H - 2, 16, 0.3)} tone="mid" />
    <Solid paths={C(0, V.NEEDLE_Y, 3.4, 0, 2, 22, 0.4)} tone="hi" lit />
  </>
);
