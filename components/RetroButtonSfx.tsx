"use client";

import { useEffect, useRef } from "react";

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function isClickable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const clickable = target.closest(
    "button, a, [role='button'], input[type='button'], input[type='submit']",
  );
  if (!(clickable instanceof HTMLElement)) return false;
  if (clickable.getAttribute("aria-disabled") === "true") return false;
  if (clickable.hasAttribute("disabled")) return false;
  return true;
}

const SFX_VOLUME = 0.2;

/** RetroButtonSfx — tiny Pokémon-menu-style click blip for buttons and links. */
export function RetroButtonSfx() {
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const play = (event: PointerEvent) => {
      if (!isClickable(event.target)) return;

      const AudioCtor = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!AudioCtor) return;

      const ctx = ctxRef.current ?? new AudioCtor();
      ctxRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.045);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(SFX_VOLUME, ctx.currentTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.085);
    };

    window.addEventListener("pointerdown", play, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", play);
      void ctxRef.current?.close();
    };
  }, []);

  return null;
}
