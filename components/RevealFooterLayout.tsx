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
  const [inlineFooter, setInlineFooter] = useState(true);

  useEffect(() => {
    const footerEl = footerRef.current;
    if (!footerEl) return;

    const updateHeight = () => {
      setFooterHeight(footerEl.offsetHeight);
      // A fixed footer taller than the viewport cannot be fully reached.
      setInlineFooter(window.innerWidth < 768 || footerEl.offsetHeight > window.innerHeight - 80);
    };
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
        style={{ marginBottom: !inlineFooter && footerHeight ? `${footerHeight}px` : 0 }}
      >
        {children}
      </div>

      <div ref={footerRef} data-footer-mode={inlineFooter ? "inline" : "reveal"} className={inlineFooter ? "relative z-0" : "fixed inset-x-0 bottom-0 z-0"}>
        {footer}
      </div>
    </div>
  );
}
