export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "hy-green": "#0F5C4A",
        "hy-forest": "#0A3F33",
        "hy-amber": "#F5A623",
        "hy-cream": "#FFF8EC",
        "hy-sand": "#F1E6D2",
        "hy-ink": "#1B1F1D",
        "hy-muted": "#5B655F",
        "hy-alert": "#C8322B",
        ground: "#FFF8EC",
        surface: "#FFFFFF",
        subtle: "#F1E6D2",
        seam: "#E2D4BC",
        ink: {
          DEFAULT: "#1B1F1D",
          muted: "#5B655F"
        },
        viridian: {
          DEFAULT: "#0F5C4A",
          hover: "#0A3F33",
          soft: "#E4F1ED"
        },
        amber: {
          DEFAULT: "#F5A623",
          hover: "#DF9214"
        },
        ochre: {
          DEFAULT: "#0A3F33",
          bg: "#FEF3C7",
          border: "#F5A623"
        },
        crimson: {
          DEFAULT: "#C8322B",
          dark: "#991F19",
          soft: "#FEE2E2"
        }
      },
      borderRadius: {
        card: "16px"
      },
      boxShadow: {
        soft: "0 2px 12px rgba(27, 31, 29, 0.06)",
        lift: "0 12px 30px rgba(10, 63, 51, 0.16)"
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
        ],
        display: [
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
