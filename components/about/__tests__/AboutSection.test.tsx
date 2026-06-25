import { render, screen } from "@testing-library/react";
import { AboutSection } from "../AboutSection";

describe("AboutSection", () => {
  it("anchors each showcase sprite to a subtle foot sway animation", () => {
    render(<AboutSection />);

    for (const name of ["Psyduck", "Wobbuffet", "Wooper"]) {
      const sprite = screen.getByAltText(name);
      expect(sprite.className).toMatch(/\babout-sprite-sway\b/);
    }
  });
});
