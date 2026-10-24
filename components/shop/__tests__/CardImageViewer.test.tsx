import { fireEvent, render, screen } from "@testing-library/react";
import { CardImageViewer } from "../CardImageViewer";

it("bounds zoom, pans with keys, and resets when the image changes", () => {
  const view = render(<CardImageViewer src="/front.jpg" alt="Card front" />);
  const frame = screen.getByRole("region");
  const img = screen.getByRole("img");
  Object.defineProperties(frame, { clientWidth: { value: 300 }, clientHeight: { value: 400 } });
  Object.defineProperties(img, { naturalWidth: { value: 300 }, naturalHeight: { value: 400 } });
  expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  fireEvent.keyDown(frame, { key: "ArrowRight" });
  expect(img.style.transform).toBe("translate(-40px, 0px) scale(1.5)");
  for (let i = 0; i < 10; i++) fireEvent.keyDown(frame, { key: "ArrowRight" });
  expect(img.style.transform).toBe("translate(-75px, 0px) scale(1.5)");
  for (let i = 0; i < 10; i++) fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  expect(img.style.transform).toBe("translate(0px, 0px) scale(1)");
  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  view.rerender(<CardImageViewer src="/back.jpg" alt="Card back" />);
  expect(img.style.transform).toBe("translate(0px, 0px) scale(1)");
  expect(frame).toHaveClass("overflow-hidden");
});
