import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MusicProvider } from "../MusicContext";
import { MusicToggle } from "../MusicToggle";

/** MusicToggle — floating button + icon swap tests. */

const playMock = jest.fn(() => Promise.resolve());
const pauseMock = jest.fn();

class MockAudio {
  src: string;
  loop = false;
  volume = 1;
  preload = "";
  readyState = 4;
  play = playMock;
  pause = pauseMock;
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
  dispatchEvent = jest.fn(() => true);

  constructor(src = "") {
    this.src = src;
  }
}

describe("MusicToggle", () => {
  beforeEach(() => {
    playMock.mockClear();
    pauseMock.mockClear();
    global.Audio = MockAudio as unknown as typeof Audio;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders a toggle button with music-on icon when stopped", async () => {
    render(
      <MusicProvider>
        <MusicToggle />
      </MusicProvider>,
    );
    const btn = screen.getByRole("button", { name: /Turn music on/i });
    expect(btn).toBeInTheDocument();
    const img = btn.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/images/music-on.png");
    await waitFor(() => expect(btn).toHaveAttribute("data-music-loading", "false"));
  });

  it("swaps to the mute icon after clicking to start playback", async () => {
    const user = userEvent.setup();
    render(
      <MusicProvider>
        <MusicToggle />
      </MusicProvider>,
    );

    const btn = screen.getByRole("button", { name: /Turn music on/i });
    await waitFor(() => expect(btn).toHaveAttribute("data-music-loading", "false"));
    await user.click(btn);

    const playingBtn = await screen.findByRole("button", {
      name: /Turn music off/i,
    });
    const img = playingBtn.querySelector("img");
    expect(playMock).toHaveBeenCalled();
    expect(img?.getAttribute("src")).toBe("/images/music-mute.png");
  });

  it("is disabled when audio is missing after a failed load", async () => {
    class ErrorAudio extends MockAudio {
      override addEventListener = jest.fn(
        (event: string, handler: (e?: unknown) => void) => {
          if (event === "error") {
            setTimeout(() => handler(), 0);
          }
        },
      );
    }
    global.Audio = ErrorAudio as unknown as typeof Audio;

    render(
      <MusicProvider>
        <MusicToggle />
      </MusicProvider>,
    );

    const btn = screen.getByRole("button", { name: /Turn music on/i });
    await waitFor(() => expect(btn).toBeDisabled());
  });
});
