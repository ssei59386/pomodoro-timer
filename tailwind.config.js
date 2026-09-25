/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff9f4",
          100: "#d7f0e3",
          200: "#b1e1c9",
          300: "#7fcaa8",
          400: "#4bab82",
          500: "#2b8f66",
          600: "#1f7352",
          700: "#1b5c44",
          800: "#194a38",
          900: "#153d2f",
        },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 1px rgb(0 0 0 / 0.06)",
      },
    },
  },
  plugins: [],
};
