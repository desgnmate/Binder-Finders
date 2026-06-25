"use client";

import { useEffect, useRef, useState } from "react";

/**
 * WalkingTrainer — pixel-art character that walks across a theme bar
 * at the top of the page, bouncing off the walls with a flip animation.
 *
 * Uses requestAnimationFrame for smooth movement. When the character
 * hits either edge, it flips horizontally and reverses direction.
 */
export function WalkingTrainer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(0);
  const [facingRight, setFacingRight] = useState(true);
  const speedRef = useRef(1.5); // pixels per frame
  const facingRightRef = useRef(true);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const animate = () => {
      setPosition((prev) => {
        const containerWidth = container.clientWidth ?? window.innerWidth;
        const spriteWidth = 80; // approximate desktop sprite width in px

        let next = prev + (facingRightRef.current ? speedRef.current : -speedRef.current);
        let newFacing = facingRightRef.current;

        // Bounce off right wall
        if (next >= containerWidth - spriteWidth) {
          next = containerWidth - spriteWidth;
          newFacing = false;
        }
        // Bounce off left wall
        if (next <= 0) {
          next = 0;
          newFacing = true;
        }

        if (newFacing !== facingRightRef.current) {
          facingRightRef.current = newFacing;
          setFacingRight(newFacing);
        }

        return next;
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      data-walking-trainer="true"
      className="relative h-16 w-full overflow-hidden md:h-20"
      aria-hidden="true"
    >
      <div
        className="walking-trainer absolute bottom-0 left-0 h-16 w-16 md:h-20 md:w-20"
        style={{
          left: `${position}px`,
          transform: `scaleX(${facingRight ? 1 : -1})`,
        }}
      >
        <img
          src="/trainer/walk-1.png"
          alt=""
          className="walking-trainer__frame walking-trainer__frame--one"
          loading="lazy"
        />
        <img
          src="/trainer/walk-2.png"
          alt=""
          className="walking-trainer__frame walking-trainer__frame--two"
          loading="lazy"
        />
      </div>
    </div>
  );
}
