"use client";

import { useEffect, useRef, useState } from "react";

/** A bounded, pointer-driven viewer; the image never creates scrollbars. */
export function CardImageViewer({ src, alt }: { src: string; alt: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  function reset() { setZoom(1); setOffset({ x: 0, y: 0 }); }
  function bounded(x: number, y: number, scale: number) {
    const box = frame.current;
    const img = image.current;
    if (!box || !img?.naturalWidth) return { x: 0, y: 0 };
    const fit = Math.min(box.clientWidth / img.naturalWidth, box.clientHeight / img.naturalHeight);
    const maxX = Math.max(0, (img.naturalWidth * fit * scale - box.clientWidth) / 2);
    const maxY = Math.max(0, (img.naturalHeight * fit * scale - box.clientHeight) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  }
  function changeZoom(delta: number) {
    const next = Math.max(1, Math.min(4, zoom + delta));
    setZoom(next);
    setOffset(bounded(offset.x, offset.y, next));
  }
  useEffect(() => {
    reset();
    drag.current = null;
    setDragging(false);
  }, [src]);
  useEffect(() => {
    if (!frame.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => reset());
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-full min-w-0">
      <div className="mb-2 flex items-center justify-center gap-2" role="group" aria-label="Image zoom controls">
        <button type="button" aria-label="Zoom out" disabled={zoom === 1} onClick={() => changeZoom(-0.5)} className="h-11 w-11 rounded-xl border-2 border-ink-black bg-white text-xl font-bold disabled:opacity-40">−</button>
        <output aria-live="polite" className="w-14 text-center text-sm font-bold">{Math.round(zoom * 100)}%</output>
        <button type="button" aria-label="Zoom in" disabled={zoom === 4} onClick={() => changeZoom(0.5)} className="h-11 w-11 rounded-xl border-2 border-ink-black bg-white text-xl font-bold disabled:opacity-40">+</button>
        <button type="button" onClick={reset} className="h-11 rounded-xl border-2 border-ink-black bg-white px-3 text-xs font-bold">Reset</button>
      </div>
      <div ref={frame} role="region" aria-label="Enlarged card image; drag to pan or use arrow keys" tabIndex={0}
        className="relative h-[55svh] max-h-[650px] w-full touch-none select-none overflow-hidden rounded-xl border-2 border-ink-black bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue"
        style={{ cursor: zoom === 1 ? "default" : dragging ? "grabbing" : "grab" }}
        onPointerDown={(event) => {
          if (event.button !== 0 || drag.current) return;
          event.preventDefault();
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const current = drag.current;
          if (!current || current.id !== event.pointerId) return;
          const dx = event.clientX - current.x;
          const dy = event.clientY - current.y;
          current.x = event.clientX; current.y = event.clientY;
          setOffset(previous => bounded(previous.x + dx, previous.y + dy, zoom));
        }}
        onPointerUp={(event) => {
          if (drag.current?.id !== event.pointerId) return;
          drag.current = null; setDragging(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { drag.current = null; setDragging(false); }}
        onLostPointerCapture={() => { drag.current = null; setDragging(false); }}
        onKeyDown={(event) => {
          const movement: Record<string, [number, number]> = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] };
          if (movement[event.key]) {
            event.preventDefault();
            const [dx, dy] = movement[event.key];
            setOffset(previous => bounded(previous.x + dx, previous.y + dy, zoom));
          }
        }}>
        <img ref={image} src={src} alt={alt} draggable={false} onLoad={reset} referrerPolicy="no-referrer"
          className="pointer-events-none absolute inset-0 h-full w-full max-w-none object-contain"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }} />
      </div>
      <p className="mt-2 text-center text-xs text-ink-black/60">Use + / − to zoom. Drag to inspect; arrow keys also move the image.</p>
    </div>
  );
}
