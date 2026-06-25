import { renderHook, act, waitFor } from "@testing-library/react";
import { MusicProvider, useMusic } from "../MusicContext";

/**
 * MusicProvider — HTMLAudio BGM playback tests.
 *
 * The implementation uses a plain HTMLAudioElement pointed at the public
 * /audio/littleroot-town.mp3 path. The audio element is created on mount
 * and persists across route changes because the provider lives in the root
 * layout. Playback is triggered by a user click (the toggle button).
 */

const playMock = jest.fn(() => Promise.resolve());
const pauseMock = jest.fn();

class MockAudio {
  src: string;
  loop = false;
  volume = 1;
  preload = "";
  readyState = 4; // HAVE_ENOUGH_DATA
  play = playMock;
  pause = pauseMock;
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
  dispatchEvent = jest.fn(() => true);

  constructor(src = "") {
    this.src = src;
  }
}

function renderProvider() {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MusicProvider>{children}</MusicProvider>
  );
  return wrapper;
}

describe("MusicProvider", () => {
  beforeEach(() => {
    playMock.mockClear();
    pauseMock.mockClear();
    global.Audio = MockAudio as unknown as typeof Audio;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("starts disabled and not missing", async () => {
    const wrapper = renderProvider();
    const { result } = renderHook(() => useMusic(), { wrapper });

    expect(result.current.enabled).toBe(false);
    expect(result.current.missingAudio).toBe(false);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("creates an HTMLAudioElement pointed at the BGM source", () => {
    const OriginalAudio = global.Audio;
    const AudioMock = jest.fn().mockImplementation(() => new MockAudio());
    global.Audio = AudioMock as unknown as typeof Audio;

    const wrapper = renderProvider();
    renderHook(() => useMusic(), { wrapper });
    expect(AudioMock).toHaveBeenCalledWith("/audio/littleroot-town.mp3");

    global.Audio = OriginalAudio;
  });

  it("plays on toggle when the audio is ready", async () => {
    const wrapper = renderProvider();
    const { result } = renderHook(() => useMusic(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggle();
    });

    expect(playMock).toHaveBeenCalled();
    expect(result.current.enabled).toBe(true);
  });

  it("pauses on second toggle and disables playback", async () => {
    const wrapper = renderProvider();
    const { result } = renderHook(() => useMusic(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggle();
    });
    await act(async () => {
      await result.current.toggle();
    });

    expect(pauseMock).toHaveBeenCalled();
    expect(result.current.enabled).toBe(false);
  });

  it("queues playback if the audio is not ready yet", async () => {
    class LazyAudio extends MockAudio {
      override readyState = 0; // HAVE_NOTHING
    }
    const lazyPlay = jest.fn(() => Promise.resolve());
    class LazyAudioInstance extends LazyAudio {
      override play = lazyPlay;
    }
    const OriginalAudio = global.Audio;
    global.Audio = LazyAudioInstance as unknown as typeof Audio;

    const wrapper = renderProvider();
    const { result } = renderHook(() => useMusic(), { wrapper });

    await act(async () => {
      await result.current.toggle();
    });

    expect(lazyPlay).not.toHaveBeenCalled();
    expect(result.current.enabled).toBe(false);

    global.Audio = OriginalAudio;
  });

  it("marks missingAudio when the audio element errors", async () => {
    class ErrorAudio extends MockAudio {
      override addEventListener = jest.fn(
        (event: string, handler: (e?: unknown) => void) => {
          if (event === "error") {
            // Fire the error handler synchronously to simulate load failure.
            setTimeout(() => handler(), 0);
          }
        },
      );
    }
    global.Audio = ErrorAudio as unknown as typeof Audio;

    const wrapper = renderProvider();
    const { result } = renderHook(() => useMusic(), { wrapper });

    await waitFor(() => expect(result.current.missingAudio).toBe(true));
    expect(result.current.enabled).toBe(false);
  });
});
