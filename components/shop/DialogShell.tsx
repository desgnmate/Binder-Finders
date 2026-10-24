"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Native modal provides a top layer, focus containment, and an inert page. */
export function DialogShell({ children, label, onClose }: {
  children: ReactNode;
  label: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return () => {
      document.body.style.overflow = overflow;
      if (typeof dialog.close === "function") dialog.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog ref={ref} aria-label={label} className="card-inspect-dialog"
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
      }}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="relative rounded-[28px] border-4 border-ink-black bg-cream p-4 sm:p-7">
        <div className="sticky top-0 z-30 mb-4 flex items-center justify-between gap-4 bg-cream py-2">
          <span className="font-retro text-[10px] text-ink-black/60">CARD INSPECTION</span>
          <button type="button" autoFocus onClick={onClose} aria-label="Close inspection"
            className="rounded-xl border-2 border-ink-black bg-white p-2 hover:bg-brand-yellow focus-visible:outline focus-visible:outline-4 focus-visible:outline-brand-blue">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
