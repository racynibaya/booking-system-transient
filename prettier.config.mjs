/** @type {import("prettier").Config} */
const config = {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 100,
  tabWidth: 2,
  plugins: ["prettier-plugin-tailwindcss"],
  // Tailwind v4: point the class sorter at the stylesheet that defines the theme.
  tailwindStylesheet: "./app/globals.css",
};

export default config;
