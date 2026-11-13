"use client";

import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Page animations, driven by data attributes so server components can opt in:
 *
 *   data-motion="hero"    children rise in one after another when the page opens
 *   data-motion="rise"    the element rises in when the page opens
 *   data-motion="reveal"  the element rises in when scrolled into view
 *   data-motion="stagger" children rise in one after another when scrolled into view
 *   data-motion="pop"     children pop in with a small tilt when scrolled into view
 *   data-motion="fan"     children deal in like cards, then bob gently
 *   data-motion="float"   the element bobs gently forever
 *
 * Nothing moves for people who ask their system for reduced motion. "hero" and
 * "rise" are hidden by CSS until they play (see globals.css), so they don't
 * flash before the animation starts.
 */
export function PageMotion({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const root = useRef<HTMLDivElement>(null);
  // Client navigation can reuse this component for the next page, so replay on every route.
  const pathname = usePathname();

  useIsomorphicLayoutEffect(() => {
    const el = root.current;
    // Without matchMedia (very old browsers, test DOMs) we can't respect
    // reduced motion, so leave the page still.
    if (!el || typeof window.matchMedia !== "function") return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(el);
      const onScroll = (trigger: Element) => ({ trigger, start: "top 88%", once: true });

      q('[data-motion="hero"]').forEach((group) => {
        gsap.fromTo(
          group.children,
          { y: 28, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.65, stagger: 0.06, ease: "power3.out", delay: 0.05 },
        );
      });
      q('[data-motion="rise"]').forEach((item) => {
        gsap.fromTo(item, { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: 0.2 });
      });
      q('[data-motion="reveal"]').forEach((item) => {
        gsap.from(item, { y: 40, opacity: 0, duration: 0.8, ease: "power3.out", scrollTrigger: onScroll(item) });
      });
      q('[data-motion="stagger"]').forEach((group) => {
        gsap.from(group.children, {
          y: 32,
          opacity: 0,
          duration: 0.6,
          stagger: 0.07,
          ease: "power3.out",
          scrollTrigger: onScroll(group),
        });
      });
      q('[data-motion="pop"]').forEach((group) => {
        gsap.from(group.children, {
          y: 48,
          scale: 0.9,
          rotation: (i: number) => (i % 2 ? 4 : -4),
          opacity: 0,
          duration: 0.7,
          stagger: 0.1,
          ease: "back.out(1.7)",
          scrollTrigger: onScroll(group),
        });
      });
      q('[data-motion="fan"]').forEach((group) => {
        const cards = Array.from(group.children);
        gsap.from(cards, {
          y: 160,
          opacity: 0,
          duration: 0.9,
          stagger: 0.12,
          ease: "back.out(1.4)",
          delay: 0.25,
          onComplete: () => {
            gsap.to(cards, { y: "-=10", duration: 2, ease: "sine.inOut", yoyo: true, repeat: -1, stagger: 0.35 });
          },
        });
      });
      q('[data-motion="float"]').forEach((item) => {
        gsap.to(item, { y: -14, rotation: "+=2", duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1 });
      });
    });
    return () => mm.revert();
  }, [pathname]);

  return (
    <div ref={root} className={className} style={style}>
      {children}
    </div>
  );
}
