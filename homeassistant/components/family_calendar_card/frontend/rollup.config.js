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

export default {
  input: "src/family-calendar-card.ts",
  output: {
    dir: "dist",
    format: "es",
    sourcemap: true,
  },
  plugins: [
    replace({
      preventAssignment: true,
      __BUILD_VERSION__: () => {
        // Generate timestamp on each build
        const timestamp = execSync(
          "TZ='America/New_York' date +%Y-%m-%d_%H:%M:%S",
          {
            encoding: "utf8",
          },
        ).trim();
        return JSON.stringify(`${version}-dev.${timestamp}`);
      },
    }),
    resolve({
      browser: true,
      preferBuiltins: false,
    }),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.json",
    }),
    css({ output: "bundle.css" }),
  ],
  external: ["custom-card-helpers", "home-assistant-js-websocket"],
  preserveEntrySignatures: false,
};
