import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        text: "var(--text)",
        muted: "var(--muted)",
        border: "var(--border)",
        brand: "var(--brand)",
        brand2: "var(--brand2)"
      },
      borderRadius: {
        xl: "var(--radius)"
      },
      boxShadow: {
        panel: "0 10px 30px rgba(11, 13, 12, 0.04)"
      }
    }
  },
  plugins: []
};

export default config;
