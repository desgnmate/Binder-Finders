import * as fs from "fs";
import * as path from "path";

describe("globals.css Umano design tokens", () => {
  const globalsPath = path.join(__dirname, "..", "app", "globals.css");
  let css: string;

  beforeAll(() => {
    css = fs.readFileSync(globalsPath, "utf-8");
  });

  function extractThemeBlock(source: string): string {
    // The Tailwind v4 @theme block runs from `@theme {` to the matching `}`.
    const start = source.indexOf("@theme {");
    if (start < 0) throw new Error("No @theme block found in globals.css");
    let depth = 0;
    for (let i = start; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) return source.slice(start, i + 1);
      }
    }
    throw new Error("Unterminated @theme block in globals.css");
  }

  it("declares --ease-umano in the @theme block (Umano signature scroll-scrub easing)", () => {
    const theme = extractThemeBlock(css);
    expect(theme).toMatch(/--ease-umano\s*:\s*cubic-bezier\(\s*0\.165\s*,\s*0\.84\s*,\s*0\.44\s*,\s*1\s*\)/);
  });

  it("declares --ease-material in the @theme block (Material standard easing)", () => {
    const theme = extractThemeBlock(css);
    expect(theme).toMatch(/--ease-material\s*:\s*cubic-bezier\(\s*0\.4\s*,\s*0\s*,\s*0\.2\s*,\s*1\s*\)/);
  });

  it("declares --radius-hero in the @theme block (mobile-aware clamp 24..42px)", () => {
    const theme = extractThemeBlock(css);
    expect(theme).toMatch(
      /--radius-hero\s*:\s*clamp\(\s*24px\s*,\s*4vw\s*,\s*42px\s*\)/
    );
  });

  it("declares --font-headline as 'TAN st. Canard' (the brief's actual headline font, self-hosted)", () => {
    // The brief calls for TAN st. Canard — a mid-century display serif
    // with bold "eyebrow" serifs. The actual .woff2 is self-hosted at
    // public/fonts/tan-st-canard.woff2.
    const theme = extractThemeBlock(css);
    expect(theme).toMatch(/--font-headline\s*:\s*'TAN st\. Canard'/);
    // Old proxies must not be in the @theme block.
    expect(theme).not.toMatch(/--font-headline\s*:\s*"Playfair Display"/);
    expect(theme).not.toMatch(/--font-headline\s*:\s*"DM Serif Display"/);
  });
});
