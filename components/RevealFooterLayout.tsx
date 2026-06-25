"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface RevealFooterLayoutProps {
  children: ReactNode;
  footer: ReactNode;
}

/**
 * Stable reveal footer pattern.
 *
 * The footer is fixed behind the page. The scrolling content receives a
 * bottom margin equal to the measured footer height, so at the end of the
 * page the content scrolls away and reveals the fixed footer underneath.
 *
 * No scroll listeners, no mounting/unmounting while scrolling — prevents
 * flicker/glitching.
 */
export function RevealFooterLayout({ children, footer }: RevealFooterLayoutProps) {
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(0);

  useEffect(() => {
    const footerEl = footerRef.current;
    if (!footerEl) return;

    const updateHeight = () => setFooterHeight(footerEl.offsetHeight);
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(footerEl);
    window.addEventListener("resize", updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  return (
    <div className="relative">
      <div
        className="relative z-10"
        style={{ marginBottom: footerHeight ? `${footerHeight}px` : undefined }}
      >
        {children}
      </div>

      <div ref={footerRef} className="fixed inset-x-0 bottom-0 z-0">
        {footer}
      </div>
    </div>
  );
}
