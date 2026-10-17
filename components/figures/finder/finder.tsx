"use client";

import * as React from "react";

import { iso, translateAlong } from "@/components/iso/iso-kit";
import { follow, useInView, useLoop, useStillness } from "@/components/iso/react/live";

import "@/components/iso/iso.css";
import "./finder.css";

import {
  BACK,
  BASE_NODE,
  CLIP_TOP_Y,
  CLIP_W,
  CLIP_X,
  GANTRY,
  HEAD,
  NEEDLE,
  TIP,
  clipHeight,
} from "./geometry";
import * as V from "./view";

const { P } = V;

/**
 * The probe cycle: seat the head over a lane, drive the needle down until the
 * pocket floor stops it, hold the reading, withdraw. The auto tour runs the
 * three lanes A, C, B so the empty lane — and its 404 — arrives early.
 */
const TOUR = [0, 2, 1];
const SEEK = 0.8;
const HOLD = 1.05;
const WITHDRAW = 0.62;

const LANES = V.LANE_X.length;

function reading(lane: number) {
  return `lane ${lane + 1} · ${lane === LANES - 1 ? "404" : "found"}`;
}

const seeking = (lane: number) => `lane ${lane + 1} · seeking`;
const probing = (lane: number) => `lane ${lane + 1} · probing`;

interface Live {
  goal: number;
  phase: number;
  clock: number;
  x: number;
  z: number;
  tour: number;
  said: string;
}

export function FinderProbe() {
  const stage = React.useRef<HTMLDivElement>(null);
  const headRef = React.useRef<SVGGElement>(null);
  const tipRef = React.useRef<SVGGElement>(null);
  const clipRef = React.useRef<SVGRectElement>(null);
  const readoutRef = React.useRef<HTMLSpanElement>(null);
  const timer = React.useRef(0);
  const aim = React.useRef<number | null>(null);
  const live = React.useRef<Live>({
    goal: TOUR[0],
    phase: 0,
    clock: 0,
    x: V.LANE_X[1],
    z: V.HOME_Z,
    tour: 0,
    said: "",
  });

  const inView = useInView(stage);
  const still = useStillness();

  const say = React.useCallback((text: string) => {
    if (live.current.said === text) return;
    live.current.said = text;
    if (readoutRef.current) readoutRef.current.textContent = text;
  }, []);

  const paint = React.useCallback((x: number, z: number) => {
    headRef.current?.setAttribute("transform", translateAlong(P, [x, 0, 0]));
    tipRef.current?.setAttribute("transform", translateAlong(P, [0, 0, z]));
    clipRef.current?.setAttribute("height", String(clipHeight(z)));
  }, []);

  useLoop((dt, calm) => {
    const s = live.current;
    const goal = aim.current ?? s.goal;

    // A new lane was asked for — come up out of the pocket before moving.
    if (goal !== s.goal) {
      s.goal = goal;
      if (s.phase !== 0) s.phase = 3;
      s.clock = 0;
    }

    s.clock += dt;
    const tx = V.LANE_X[goal] ?? 0;
    const floor = V.DEPTH_Z[goal] ?? V.HOME_Z;
    const travel = Math.abs(V.HOME_Z - floor);

    switch (s.phase) {
      case 0: {
        s.x = follow(s.x, tx, dt, 0.26, calm);
        s.z = follow(s.z, V.HOME_Z, dt, 0.2, calm);
        say(seeking(goal));
        if (s.clock >= SEEK) {
          s.x = tx;
          s.z = V.HOME_Z;
          s.phase = 1;
          s.clock = 0;
        }
        break;
      }
      case 1: {
        s.z = follow(s.z, floor, dt, 0.15 + travel * 0.013, calm);
        say(probing(goal));
        if (s.clock >= 0.4 + travel * 0.02) {
          s.z = floor;
          s.phase = 2;
          s.clock = 0;
          say(reading(goal));
        }
        break;
      }
      case 2: {
        say(reading(goal));
        if (s.clock >= HOLD) {
          s.phase = 3;
          s.clock = 0;
        }
        break;
      }
      default: {
        s.z = follow(s.z, V.HOME_Z, dt, 0.17, calm);
        if (s.clock >= WITHDRAW) {
          s.z = V.HOME_Z;
          s.phase = 0;
          s.clock = 0;
          if (aim.current === null) {
            s.tour = (s.tour + 1) % TOUR.length;
            s.goal = TOUR[s.tour] ?? 0;
          }
        }
        break;
      }
    }

    paint(s.x, s.z);
    return true;
  }, inView && !still);

  // Reduced motion: park the probe in lane A and leave it there.
  React.useEffect(() => {
    if (!still) return;
    live.current.goal = 0;
    live.current.x = V.LANE_X[0] ?? 0;
    live.current.z = V.DEPTH_Z[0] ?? V.HOME_Z;
    paint(live.current.x, live.current.z);
    say(reading(0));
  }, [still, paint, say]);

  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  /** The lane whose screen column is under this pointer. */
  const laneAt = (clientX: number) => {
    const box = stage.current?.getBoundingClientRect();
    if (!box || !box.width) return null;
    const at = ((clientX - box.left) / box.width) * V.WIDTH;
    let best = 0;
    let least = Infinity;
    V.LANE_X.forEach((lane, index) => {
      const column = iso([lane, 6, 40], P)[0];
      const away = Math.abs(column - at);
      if (away < least) {
        least = away;
        best = index;
      }
    });
    return best;
  };

  const step = (by: number) => {
    const from = aim.current ?? live.current.goal;
    aim.current = (from + by + LANES) % LANES;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      aim.current = null;
    }, 4600);
  };

  return (
    <div className="iso finder">
      <div
        ref={stage}
        className="finder-stage"
        tabIndex={0}
        onPointerMove={(event) => {
          aim.current = laneAt(event.clientX);
        }}
        onPointerLeave={() => {
          aim.current = null;
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault();
            step(1);
          } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault();
            step(-1);
          }
        }}
      >
        <svg
          className="iso-svg"
          viewBox={`0 0 ${V.WIDTH} ${V.HEIGHT}`}
          role="img"
          aria-label="An index finder: a three-lane card rack under a gantry. A probe rides the rail and drives a needle down into the lane it stops over. The needle lands on the shelf in lanes A and B, and runs all the way to the plinth in lane C, which was never fitted with shelves — the pocket that holds no record."
        >
          <defs>
            <clipPath id="finder-needle" clipPathUnits="userSpaceOnUse">
              <rect
                ref={clipRef}
                x={CLIP_X}
                y={CLIP_TOP_Y}
                width={CLIP_W}
                height={clipHeight(V.HOME_Z)}
              />
            </clipPath>
          </defs>
          {BASE_NODE}
          {BACK}
          {GANTRY}
          <g ref={headRef} transform={translateAlong(P, [V.LANE_X[1] ?? 0, 0, 0])}>
            {HEAD}
            <g clipPath="url(#finder-needle)">{NEEDLE}</g>
            <g ref={tipRef} transform={translateAlong(P, [0, 0, V.HOME_Z])}>
              {TIP}
            </g>
          </g>
        </svg>
      </div>
      <div className="finder-foot">
        <span className="finder-tag">index finder</span>
        <span className="finder-readout" ref={readoutRef}>
          —
        </span>
      </div>
    </div>
  );
}
