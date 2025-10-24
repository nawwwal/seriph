import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        ink: "var(--ink)",
        accent: "var(--accent)",
        muted: "var(--muted)",
        surface: "var(--surface)",
      },
      borderWidth: {
        rule: "var(--rule)",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
      },
      spacing: {
        rhythm: "var(--rhythm)",
      },
    },
  },
  plugins: [],
} satisfies Config;
