import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211b",
        paper: "#f7f4ec",
        line: "#d8d1c2",
        mint: "#b8ead4",
        leaf: "#34785f",
        coral: "#d9694f",
        steel: "#4f6f8a"
      },
      boxShadow: {
        panel: "0 18px 55px rgba(32, 44, 36, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
