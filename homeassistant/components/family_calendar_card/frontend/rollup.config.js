import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import css from "rollup-plugin-css-only";

export default {
  input: "src/family-calendar-card.ts",
  output: {
    dir: "dist",
    format: "es",
    sourcemap: true,
  },
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false,
      dedupe: ["lit"],
      exportConditions: ["browser", "module", "import", "default"],
    }),
    commonjs({
      include: [
        "node_modules/**",
        "node_modules/custom-card-helpers/**",
        "node_modules/swiper/**",
      ],
    }),
    typescript({
      tsconfig: "./tsconfig.json",
    }),
    css({
      output: "bundle.css",
      minimize: true,
    }),
  ],
  external: ["custom-card-helpers", "home-assistant-js-websocket"],
  preserveEntrySignatures: false,
};
