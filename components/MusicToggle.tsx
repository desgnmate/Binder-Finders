"use client";

import { useMusic } from "./MusicContext";

/**
 * MusicToggle — floating button to toggle background music.
 *
 * Uses global music state from MusicProvider so the audio keeps playing
 * across page navigations. Displays custom pixel-art icons for on/mute.
 */
export function MusicToggle() {
  const { enabled, missingAudio, loading, toggle } = useMusic();

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={enabled}
      aria-label={enabled ? "Turn music off" : "Turn music on"}
      title={missingAudio ? "Add public/audio/littleroot-town.mp3" : loading ? "Loading music..." : "Toggle background music"}
      className="fixed bottom-4 right-4 z-50 inline-flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-transparent p-0 transition-transform hover:scale-110 disabled:opacity-60 disabled:hover:scale-100 md:h-24 md:w-24"
      disabled={missingAudio}
      data-music-loading={loading ? "true" : "false"}
    >
      <img
        src={enabled ? "/images/music-mute.png" : "/images/music-on.png"}
        alt=""
        className="h-full w-full object-contain [image-rendering:pixelated] drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
        loading="lazy"
      />
    </button>
  );
}
