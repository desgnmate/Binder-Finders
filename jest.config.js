/** @type {import('jest').Config} */
const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

/** @type {import('jest').Config} */
const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jsdom",
  testEnvironmentOptions: { pretendToBeVisual: true },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // GSAP's plugin entry points are ES modules; Jest loads the bundled builds.
    "^gsap/ScrollTrigger$": "<rootDir>/node_modules/gsap/dist/ScrollTrigger.js",
  },
  testMatch: ["**/__tests__/**/*.test.(ts|tsx)"],
};

module.exports = createJestConfig(customJestConfig);
