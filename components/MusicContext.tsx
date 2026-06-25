"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const BGM_SRC = "/audio/littleroot-town.mp3";
const BGM_VOLUME = 0.36;

interface MusicContextValue {
  enabled: boolean;
  missingAudio: boolean;
  loading: boolean;
  toggle: () => Promise<void>;
}

const MusicContext = createContext<MusicContextValue | null>(null);

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic must be used within a MusicProvider");
  return ctx;
}

/**
 * MusicProvider — global BGM player.
 *
 * Uses a hidden HTMLAudioElement attached to the DOM. The MP3 is loaded
 * directly from the public path (no blob conversion) so the browser handles
 * range requests natively and no download prompt is triggered (the file
 * is served from the same origin with proper audio/mpeg content-type).
 * The Audio element persists across route changes because the provider
 * lives in the root layout.
 */
export function MusicProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wantsPlayRef = useRef(false);
  const [enabled, setEnabled] = useState(false);
  const [missingAudio, setMissingAudio] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const audio = new Audio(BGM_SRC);
    audio.loop = true;
    audio.volume = BGM_VOLUME;
    audio.preload = "auto";
    audioRef.current = audio;

    const handleError = () => {
      setMissingAudio(true);
      setEnabled(false);
    };

    const handleCanPlay = () => {
      setLoading(false);
      if (wantsPlayRef.current) {
        wantsPlayRef.current = false;
        audio.play().then(() => setEnabled(true)).catch(() => {});
      }
    };

    audio.addEventListener("error", handleError);
    audio.addEventListener("canplaythrough", handleCanPlay);
    audio.addEventListener("canplay", handleCanPlay);

    // Some browsers fire canplay immediately if the file is cached.
    if (audio.readyState >= 3) {
      setLoading(false);
    }

    return () => {
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("canplaythrough", handleCanPlay);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  const toggle = async () => {
    if (missingAudio) return;

    const audio = audioRef.current;
    if (!audio) return;

    if (enabled) {
      wantsPlayRef.current = false;
      audio.pause();
      setEnabled(false);
      return;
    }

    try {
      if (audio.readyState < 3) {
        wantsPlayRef.current = true;
        setLoading(true);
        return;
      }
      await audio.play();
      setEnabled(true);
    } catch {
      wantsPlayRef.current = false;
      setEnabled(false);
    }
  };

  return (
    <MusicContext.Provider value={{ enabled, missingAudio, loading, toggle }}>
      {children}
    </MusicContext.Provider>
  );
}
