export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "#F7F6F2",
        surface: "#FFFFFF",
        subtle: "#EFECE4",
        seam: "#D6D3C9",
        ink: {
          DEFAULT: "#141F1A",
          muted: "#415249"
        },
        viridian: {
          DEFAULT: "#0F523B",
          hover: "#0B3F2D",
          soft: "#E4F0EA"
        },
        ochre: {
          DEFAULT: "#92400E",
          bg: "#FEF3C7",
          border: "#D97706"
        },
        crimson: {
          DEFAULT: "#B91C1C",
          dark: "#7F1D1D",
          soft: "#FEE2E2"
        }
      },
      fontFamily: {
        sans: [
          '"Noto Sans"',
          "system-ui",
          "-apple-system",
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
};
