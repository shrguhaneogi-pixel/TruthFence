import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        fence: {
          darkest: "#090d16",
          dark: "#0f172a",
          surface: "#182234",
          border: "#23334d",
          muted: "#94a3b8",
          amber: "#f59e0b",
          emerald: "#10b981",
          rose: "#f43f5e",
          cyan: "#06b6d4",
        },
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
