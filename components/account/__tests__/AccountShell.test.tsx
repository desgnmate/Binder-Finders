import { fireEvent, render, screen } from "@testing-library/react";
import { AccountShell } from "../AccountShell";

let mockPathname = "/account";
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));
jest.mock("react-dom", () => ({ ...jest.requireActual("react-dom"), useFormStatus: () => ({ pending: false }) }));
jest.mock("../../../app/account/actions", () => ({ customerSignOut: "/test-signout" }));
jest.mock("../../hero/HeroNav", () => ({ HeroNav: () => <nav>Store navigation</nav> }));
jest.mock("../../footer/SiteFooter", () => ({ SiteFooter: () => <footer>Store footer</footer> }));

const originalWidth = window.innerWidth;
const originalHeight = window.innerHeight;
afterEach(() => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: originalHeight });
});

it.each(["/account", "/account/orders", "/account/profile", "/account/login"])("uses the shared footer reveal on %s with a reachable mobile fallback", (pathname) => {
  mockPathname = pathname;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
  const { container } = render(<AccountShell footer={<footer>Account footer</footer>}><h1>Account content</h1></AccountShell>);
  const footer = container.querySelector("[data-footer-mode]") as HTMLElement;
  Object.defineProperty(footer, "offsetHeight", { configurable: true, value: 500 });
  fireEvent(window, new Event("resize"));
  expect(footer).toHaveAttribute("data-footer-mode", "reveal");
  expect(footer).toHaveClass("fixed");
  expect(footer.previousElementSibling).toHaveStyle({ marginBottom: "500px" });
  expect(footer).not.toContainElement(screen.getByRole("heading", { name: "Account content" }));
  expect(screen.getAllByRole("contentinfo")).toHaveLength(1);
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  fireEvent(window, new Event("resize"));
  expect(footer).toHaveAttribute("data-footer-mode", "inline");
  expect(footer.previousElementSibling).toHaveStyle({ marginBottom: "0px" });
});
