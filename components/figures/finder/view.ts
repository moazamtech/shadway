import {
  boxCorners,
  fitProjection,
  type Plan,
  type Point3,
  type Projection,
} from "@/components/iso/iso-kit";

/**
 * World layout for the index finder.
 *
 * The object: a three-lane card rack under a gantry. A probe head rides the
 * rail, stops over a lane, and drives a needle down until it meets the floor
 * of that lane's top pocket. Lanes A and B have their shelves; lane C was
 * never fitted, so the needle runs past the pocket mouth all the way to the
 * plinth. The finding is the travel: 14 units against 66.
 *
 * Everything is in world units (x and y on the floor, z up, +y toward the
 * viewer at the 45 degree camera). The rack is deliberately shallow: at a
 * 30 degree elevation a deep rack shows nothing but the faces of its own
 * dividers, and the pockets are the whole point.
 */

export const WIDTH = 620;
export const HEIGHT = 452;

/* ---- lanes -------------------------------------------------------------- */

export const LANE_X = [-50, 0, 50];
export const LANE_LABEL = ["A", "B", "C"];

/* ---- the rack ----------------------------------------------------------- */

export const RACK: Plan = { x: -78, y: -16, w: 156, d: 32, r: 3 };
export const WALL_L: Plan = { x: -78, y: -16, w: 4, d: 32, r: 1 };
export const WALL_R: Plan = { x: 74, y: -16, w: 4, d: 32, r: 1 };
export const BACK: Plan = { x: -78, y: -16, w: 156, d: 4, r: 1 };
export const DIV_L: Plan = { x: -27, y: -12, w: 4, d: 28, r: 1 };
export const DIV_R: Plan = { x: 23, y: -12, w: 4, d: 28, r: 1 };
/** Lanes A and B only: the shelves stop dead at x = 23. */
export const SHELF: Plan = { x: -74, y: -12, w: 97, d: 28, r: 1.5 };
export const PLINTH: Plan = { x: -78, y: -16, w: 156, d: 32, r: 2 };
export const STIFF: Plan = { x: -78, y: -16, w: 156, d: 6, r: 1 };
export const LIP: Plan = { x: 27, y: 16, w: 47, d: 4, r: 1 };
/** The blanking plate on the back of lane C. Nothing was ever filed here. */
export const PLATE: Plan = { x: 28, y: -12, w: 44, d: 3, r: 1.2 };

export const PLINTH_Z = 0;
export const PLINTH_H = 8;
/** Shelf bottoms. Their tops are 12, 36 and 60: three even rows. */
export const FLOOR_Z = [8, 32, 56];
export const FLOOR_H = 4;
export const RACK_TOP = 78;

/* ---- the base ----------------------------------------------------------- */

export const BASE: Plan = { x: -112, y: -38, w: 224, d: 76, r: 11 };
export const BASE_Z = -14;
export const BASE_H = 14;
export const FOOT_BOTTOM = BASE_Z - 8;
/** Painted far to near, under the plate. */
export const FEET: Point3[] = [
  [-98, -25, 0],
  [98, -25, 0],
  [-98, 25, 0],
  [98, 25, 0],
];

/* ---- the gantry --------------------------------------------------------- */

export const POST_X = 102;
export const POST_Y = 2;
export const POST_R = 6;
export const RAIL: Plan = { x: -POST_X, y: -2, w: POST_X * 2, d: 8, r: 2 };
export const RAIL_Z = 80;
export const RAIL_H = 5;
export const RAIL_TOP = RAIL_Z + RAIL_H;

/* ---- the probe --------------------------------------------------------- */

export const NEEDLE_Y = 2;
export const NEEDLE_R = 1.6;
export const ROD_TOP_Z = 100;
/** The plunger foot below the needle: pad, then collar. */
export const TIP_H = 4.2;
/** Where the needle sits between lanes. */
export const HOME_Z = 74;
/** Where it bottoms out: on the top shelf in A and B, on the plinth in C. */
export const DEPTH_Z = [60, 60, 8];

/* ---- the piles --------------------------------------------------------- */

export const CARD_W = 34;
export const CARD_D = 22;
export const CARD_H = 2.4;
export const CARD_GAP = 2.6;
export const CARD_Y = 2;

/* ---- camera ------------------------------------------------------------ */

export const P: Projection = fitProjection(
  [
    ...boxCorners(BASE, FOOT_BOTTOM, BASE_Z + BASE_H),
    ...boxCorners(
      { x: -POST_X - POST_R - 2, y: -10, w: (POST_X + POST_R + 2) * 2, d: 24, r: 2 },
      RAIL_Z,
      113,
    ),
    ...boxCorners(RACK, 0, RACK_TOP),
    ...boxCorners({ x: -76, y: -8, w: 152, d: 24, r: 2 }, RAIL_TOP, 113),
  ],
  WIDTH,
  HEIGHT,
  { pad: 14 },
);
