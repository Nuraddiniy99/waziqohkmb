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
        emerald: {
          brand: "#0f7b54",
          dark: "#0a452f",
          forest: "#0f3b2c",
          light: "#14a370",
        },
        gold: {
          brand: "#fbbf24",
          soft: "#fef3c7",
          dark: "#d97706",
        },
        glass: {
          bg: "rgba(255, 255, 255, 0.75)",
          border: "rgba(255, 255, 255, 0.4)",
          emerald: "rgba(15, 123, 84, 0.15)",
        },
        slate: {
          custom: "#64748b",
        }
      },
      fontFamily: {
        inter: ["Inter", "sans-serif"],
      },
      backdropBlur: {
        glass: "16px",
        strong: "20px",
      },
      boxShadow: {
        glass: "0 12px 32px -8px rgba(10, 80, 50, 0.12)",
        card: "0 4px 24px -4px rgba(0, 0, 0, 0.08)",
        float: "0 -8px 25px rgba(0, 0, 0, 0.06)",
        glow: "0 0 20px rgba(15, 123, 84, 0.3)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "spring": "spring 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        spring: {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 5px rgba(15, 123, 84, 0.2)" },
          "50%": { boxShadow: "0 0 20px rgba(15, 123, 84, 0.4)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;