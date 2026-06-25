/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx,js,jsx,mdx}",
    "./components/**/*.{ts,tsx,js,jsx,mdx}",
    "./lib/**/*.{ts,tsx,js,jsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "brand-yellow": "#fedd25",
        "brand-blue": "#3194ee",
        "brand-pink": "#ffd6e0",
        "ink-black": "#1a1a1a",
        cream: "#fff6e0",
        "pastel-yellow": "#fff3b8",
        "pastel-pink": "#ffd6e7",
        "pastel-blue": "#d6eaff",
      },
      fontFamily: {
        headline: ["var(--font-headline)", "serif"],
        body: ["var(--font-body)", "Fredoka", "system-ui", "sans-serif"],
        retro: ["var(--font-retro)", '"Press Start 2P"', "monospace"],
      },
    },
  },
  plugins: [],
};
