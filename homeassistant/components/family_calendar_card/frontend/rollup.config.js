import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import replace from "@rollup/plugin-replace";
import css from "rollup-plugin-css-only";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the version and timestamp
const version =
  process.env.VERSION ||
  JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8")).version;

// Generate timestamp
const timestamp = execSync("TZ='America/New_York' date +%Y-%m-%d_%H:%M:%S", {
  encoding: "utf8",
}).trim();

const fullVersion = `${version}-dev.${timestamp}`;

export default {
  input: ["src/family-calendar-card.ts", "src/editor.ts"],
  output: {
    dir: "dist",
    format: "es",
    sourcemap: true,
  },
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        __BUILD_VERSION__: JSON.stringify(fullVersion),
      },
    }),
    resolve({
      browser: true,
      preferBuiltins: false,
      dedupe: ["lit"],
      extensions: [".js", ".ts"],
      moduleDirectories: ["node_modules"],
    }),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.json",
    }),
    css({
      output: "styles.css",
      include: ["**/*.css", "**/*.lit.css", "node_modules/**/*.css"],
    }),
  ],
  external: ["custom-card-helpers", "home-assistant-js-websocket"],
  preserveEntrySignatures: false,
};
