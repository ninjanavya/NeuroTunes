/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#020617",
        cardBg: "rgba(15, 23, 42, 0.65)",
        cardBorder: "rgba(255, 255, 255, 0.08)",
        // Emotional palette
        vibe: {
          stressed: {
            glow: "#06b6d4",
            start: "#0891b2",
            end: "#0284c7",
          },
          energetic: {
            glow: "#ec4899",
            start: "#d946ef",
            end: "#f97316",
          },
          sad: {
            glow: "#6366f1",
            start: "#4f46e5",
            end: "#312e81",
          },
          focus: {
            glow: "#10b981",
            start: "#059669",
            end: "#064e3b",
          },
          happy: {
            glow: "#8b5cf6",
            start: "#a855f7",
            end: "#22c55e",
          }
        }
      },
      boxShadow: {
        "neon-stressed": "0 0 15px rgba(6, 182, 212, 0.5)",
        "neon-energetic": "0 0 15px rgba(236, 72, 153, 0.5)",
        "neon-sad": "0 0 15px rgba(99, 102, 241, 0.4)",
        "neon-focus": "0 0 15px rgba(16, 185, 129, 0.5)",
        "neon-happy": "0 0 15px rgba(139, 92, 246, 0.5)",
        "glass": "0 8px 32px 0 rgba(0, 0, 0, 0.37)"
      },
      animation: {
        "pulse-slow": "pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "orbit": "orbit 20s linear infinite",
        "float": "float 6s ease-in-out infinite",
        "spin-slow": "spin 12s linear infinite"
      },
      keyframes: {
        orbit: {
          "0%": { transform: "rotate(0deg) translateX(150px) rotate(0deg)" },
          "100%": { transform: "rotate(360deg) translateX(150px) rotate(-360deg)" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" }
        }
      }
    },
  },
  plugins: [],
}
