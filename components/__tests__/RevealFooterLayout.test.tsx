import { fireEvent, render } from "@testing-library/react";
import { RevealFooterLayout } from "../RevealFooterLayout";

it("keeps tall footers reachable and restores the reveal when there is room", () => {
  const originalWidth = window.innerWidth;
  const originalHeight = window.innerHeight;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
  const { container, unmount } = render(<RevealFooterLayout footer={<footer>Contact</footer>}><main>Shop</main></RevealFooterLayout>);
  const footer = container.querySelector("[data-footer-mode]") as HTMLElement;
  expect(footer.dataset.footerMode).toBe("inline");
  Object.defineProperty(footer, "offsetHeight", { configurable: true, value: 500 });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
  fireEvent(window, new Event("resize"));
  expect(footer.dataset.footerMode).toBe("reveal");
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 500 });
  fireEvent(window, new Event("resize"));
  expect(footer.dataset.footerMode).toBe("inline");
  expect(container.querySelector("main")?.parentElement?.style.marginBottom).toBe("0px");
  unmount();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: originalHeight });
});
