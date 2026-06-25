import "@testing-library/jest-dom";

// Polyfill ResizeObserver for jsdom (used by RevealFooterLayout, etc.)
global.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
