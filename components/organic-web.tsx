"use client";

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { motion, useSpring, useTransform, useMotionValue, animate } from 'framer-motion';

interface OrganicWebProps {
    viewport: number;
    isDragging: boolean;
    isPulling: boolean;
    theme: string | undefined;
}

export const OrganicWeb: React.FC<OrganicWebProps> = ({
    viewport,
    isDragging,
    isPulling,
    theme
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 1000, height: 600 });

    // Use ResizeObserver for accurate sizing
    useEffect(() => {
        if (!containerRef.current) return;
        setDimensions({
            width: containerRef.current.clientWidth || 1000,
            height: containerRef.current.clientHeight || 600
        });
        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                if (entry.contentRect.width > 0) {
                    setDimensions({
                        width: entry.contentRect.width,
                        height: entry.contentRect.height
                    });
                }
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const ropeColor = theme === 'dark' ? '#a1a1aa' : '#000000';

    // --- Physics Logic ---
    const widthMV = useMotionValue(dimensions.width);
    useEffect(() => widthMV.set(dimensions.width), [dimensions.width]);

    const active = isDragging || isPulling;
    const animationRef = useRef<any>(null);

    // 1. Handle X - Manually controlled for "Hybrid" tracking
    // Instant when active, Spring-animated when released
    // Initialize with current viewport to check avoid "fly-in"
    const handleX = useMotionValue((viewport / 100) * dimensions.width);

    useEffect(() => {
        const targetX = (viewport / 100) * dimensions.width;

        if (active) {
            // Dragging: TRACK INSTANTLY
            if (animationRef.current) animationRef.current.stop();
            handleX.set(targetX);
        } else {
            // Released: ANIMATE BACK SMOOTHLY (ignoring snap)
            // If we are already at target (rest), do nothing
            // But if we were dragging (active->false), we are at 'drag_pos', target is 'rest_pos'
            if (handleX.get() !== targetX) {
                if (animationRef.current) animationRef.current.stop();
                animationRef.current = animate(handleX, targetX, {
                    type: "spring",
                    stiffness: 300,
                    damping: 20
                });
            }
        }
    }, [viewport, active, dimensions.width]);

    const handleY = dimensions.height / 2;

    // 2. Sag X - Trails behind handleX to create "weight" / curve
    // Match the animation speed to handleX for consistent movement
    const sagX = useSpring(handleX, { stiffness: 300, damping: 20 });

    // 3. Master Opacity - Show when active, fade out smoothly when released
    // Track the active state in a ref so useTransform can access it
    const activeRef = useRef(active);
    useEffect(() => { activeRef.current = active; }, [active]);

    const masterOpacity = useTransform([handleX, widthMV], ([x, w]) => {
        const currentX = x as number;
        const currentW = w as number;

        // If actively dragging, always show
        if (activeRef.current) return 1;

        // When released, fade out as it approaches rest position (last 10%)
        const progress = currentX / currentW;
        if (progress >= 0.90) {
            return 1 - ((progress - 0.90) / 0.10);
        }
        return 1;
    });

    // Splatter - Always visible
    const messOpacity = 1.0;

    // --- Splatter Data ---
    const splatterFan = useMemo(() => {
        return Array.from({ length: 30 }).map(() => ({
            yOffset: (Math.random() - 0.5) * (dimensions.height * 1.3),
            controlOffset: (Math.random() - 0.5) * 120,
            thickness: 3 + Math.random() * 5, // THICKER (3-8px)
            splitPercent: 0.55 + Math.random() * 0.2,
            opacity: 0.85 + Math.random() * 0.15 // High opacity
        }));
    }, [dimensions.height]);

    const crossWebbing = useMemo(() => {
        return Array.from({ length: 18 }).map(() => ({
            startX: 0.65 + Math.random() * 0.25,
            startY: (Math.random() - 0.5) * 300,
            endX: 0.75 + Math.random() * 0.25,
            endY: (Math.random() - 0.5) * 400,
            thickness: 1.5 + Math.random() * 3, // THICKER
            opacity: 0.6 + Math.random() * 0.4
        }));
    }, []);

    // --- Main Rope Generator ---
    const mainRopePath = useTransform([handleX, sagX, widthMV], (values) => {
        const [realX, lagX, w] = values as number[];
        const startX = realX + 12;
        const endX = w;

        // Sag logic
        const dist = Math.abs(endX - startX);
        const sag = 40 * (1 - Math.pow(Math.min(dist / w, 1), 0.5));

        // Whip effect
        const lagDiff = lagX - realX;
        const midX = (startX + endX) / 2 + lagDiff * 0.4;

        return `M ${startX},${handleY} Q ${midX},${handleY + sag} ${endX},${handleY}`;
    });

    return (
        <div ref={containerRef} className="absolute inset-0 pointer-events-none z-[60] overflow-visible">
            <svg className="w-full h-full overflow-visible">
                <defs>
                    {/* 
                       Switching to userSpaceOnUse to ensure the filter region covers the ENTIRE viewport 
                       regardless of the object's bounding box. This prevents the "hidden box" clipping.
                       Reduced stdDeviation to prevent lines from dissolving into dots.
                    */}
                    <filter id="goo-complex" filterUnits="userSpaceOnUse" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
                        <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
                        <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                    </filter>
                </defs>

                {/* Master opacity control - hide entire web at 100%, animate smoothly */}
                <motion.g filter="url(#goo-complex)" style={{ opacity: masterOpacity }}>
                    {/* Main Rope */}
                    <motion.path
                        d={mainRopePath}
                        fill="none"
                        stroke={ropeColor}
                        strokeWidth="5"
                        strokeLinecap="round"
                    />

                    {/* Splatter Fan - Always fully visible when web is active */}
                    {splatterFan.map((strand, i) => (
                        <SplatterStrand
                            key={`strand-${i}`}
                            handleX={handleX}
                            handleY={handleY}
                            width={dimensions.width}
                            height={dimensions.height}
                            strandData={strand}
                            color={ropeColor}
                        />
                    ))}

                    {/* Cross Webbing - Always fully visible when web is active */}
                    {crossWebbing.map((web, i) => (
                        <CrossWeb
                            key={`web-${i}`}
                            handleX={handleX}
                            width={dimensions.width}
                            height={dimensions.height}
                            data={web}
                            color={ropeColor}
                        />
                    ))}
                </motion.g>

                {/* Anchor point glow - Fades with web */}
                <motion.circle
                    cx="100%"
                    cy="50%"
                    r="15"
                    fill={ropeColor}
                    className="blur-xl"
                    style={{ opacity: useTransform(masterOpacity, v => v * 0.5) }}
                />
            </svg>
        </div>
    );
};

// Sub-components need to accept MotionValues!
const SplatterStrand = ({ handleX, handleY, width, height, strandData, color }: any) => {
    const path = useTransform(handleX, (x: number) => {
        const startX = x + 12;

        // Split point logic
        const splitX = startX + (width - startX) * strandData.splitPercent;

        // Sag logic for split point to keep it attached visually to main rope
        const dist = Math.abs(width - startX);
        const tension = Math.max(0, dist / width);
        const totalSag = 60 * (1 - Math.pow(tension, 0.5));

        // Quadratic approx for Y at t
        const t = strandData.splitPercent;
        // P1y (control point height for main rope)
        // Note: Main rope sag is roughly handleY + sag. Quadratic control point height is ?
        // For a Q bezier M P0 Q P1 P2, the curve at t=0.5 is P0/4 + P1/2 + P2/4.
        // If we want height H at t=0.5, P1y should be roughly 2*H relative to baseline.
        // Our 'sag' calculation in main rope is the Control Point Y offset? No, usually visually tuned.
        // Let's assume main rope Q-point Y is (handleY + sag).
        // Then splitY calculation should reflect that.
        const p1y = handleY + totalSag;
        const splitY = (1 - t) * (1 - t) * handleY + 2 * (1 - t) * t * p1y + t * t * handleY;

        // Target
        const targetY = height / 2 + strandData.yOffset;

        // Control Point for Fan Strand
        const cpX = splitX + (width - splitX) * 0.4;
        const cpY = splitY + (targetY - splitY) * 0.2 + strandData.controlOffset;

        return `M ${splitX},${splitY} Q ${cpX},${cpY} ${width},${targetY}`;
    });

    return (
        <motion.path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={strandData.thickness}
            strokeLinecap="round"
            opacity={strandData.opacity || 1}
        />
    );
};

const CrossWeb = ({ handleX, width, height, data, color }: any) => {
    const path = useTransform(handleX, (x: number) => {
        const startX = x + 12;
        const x1 = startX + (width - startX) * data.startX;
        const x2 = startX + (width - startX) * data.endX;
        const y1 = height / 2 + data.startY;
        const y2 = height / 2 + data.endY;
        return `M ${x1},${y1} L ${x2},${y2}`;
    });

    return (
        <motion.path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={data.thickness}
            strokeLinecap="round"
            opacity={data.opacity || 0.8}
        />
    );
}
