/** @type {import('tailwindcss').Config} */
export default {
  content: ["./views/**/*.handlebars"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Josefin Sans", "sans-serif"],
        alata: ["Alata"],
      },
    },
  },
  plugins: [],
};
