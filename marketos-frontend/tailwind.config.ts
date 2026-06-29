import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neo: {
          bg: "var(--neo-bg)",
          surface: "var(--neo-surface)",
          ink: "var(--neo-ink)",
          yellow: "var(--neo-yellow)",
          pink: "var(--neo-pink)",
          cyan: "var(--neo-cyan)",
          lime: "var(--neo-lime)",
          red: "var(--neo-red)",
          green: "var(--neo-green)",
        },
      },
      borderWidth: {
        neo: "var(--neo-border-width)",
      },
      boxShadow: {
        neo: "var(--neo-shadow)",
        "neo-sm": "var(--neo-shadow-sm)",
        "neo-lg": "var(--neo-shadow-lg)",
      },
      borderRadius: { none: "0" },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
