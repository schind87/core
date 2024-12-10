import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import replace from "@rollup/plugin-replace";
import css from "rollup-plugin-css-only";
import { execSync } from "child_process";
import { readFileSync } from "fs";

// Get the version and timestamp
const version =
  process.env.VERSION ||
  JSON.parse(readFileSync("./package.json", "utf8")).version;
const timestamp = execSync("TZ='America/New_York' date +%Y-%m-%d_%H:%M:%S", {
  encoding: "utf8",
}).trim();
const fullVersion = `${version}-dev.${timestamp}`;

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
    }),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.json",
    }),
    replace({
      preventAssignment: true,
      "process.env.NODE_ENV": JSON.stringify("production"),
      "process.env": JSON.stringify({}),
      "global.process": JSON.stringify({}),
      "process.browser": JSON.stringify(true),
      "process.version": JSON.stringify(""),
      "process.versions": JSON.stringify({}),
      __BUILD_VERSION__: `'${fullVersion}'`,
    }),
    css({ output: "bundle.css" }),
  ],
  external: ["custom-card-helpers", "home-assistant-js-websocket"],
  preserveEntrySignatures: false,
};
