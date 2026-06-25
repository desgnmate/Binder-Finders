"use client";

import type { ReactNode } from "react";

/**
 * ScrollGradientZone — Section 3 of the brief (pastel scroll transitions).
 *
 * A simple wrapper that paints a full-height linear-gradient background
 * for the wrapped section. The gradient is always at full opacity — the
 * SEAMLESS transition between zones is achieved by matching the colour
 * stops at the boundaries:
 *
 *   - Pokédex gradient ENDS at #FFD6E7 (pastel-pink)
 *   - Binder  gradient STARTS at #FFD6E7 (pastel-pink)
 *
 * Since both zones meet at the same colour, the boundary is invisible.
 * No fade-in / fade-out, no opacity transitions — the gradient is a
 * continuous colour flow that scrolls naturally with the page.
 *
 * `gradient` is applied inline so each zone carries its own colour pair
 * from the brief's sequence.
 */
interface ScrollGradientZoneProps {
  /** The CSS background value (usually a linear-gradient). */
  gradient: string;
  /** Stable id for the zone. */
  zoneId: string;
  children: ReactNode;
}

export function ScrollGradientZone({
  gradient,
  zoneId,
  children,
}: ScrollGradientZoneProps) {
  return (
    <div
      data-scroll-zone={zoneId}
      className="scroll-zone relative"
    >
      <div
        className="scroll-zone__inner"
        style={{ background: gradient }}
      >
        {children}
      </div>
    </div>
  );
}
