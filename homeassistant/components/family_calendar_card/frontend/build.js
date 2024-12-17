import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Read the package.json file
const packageJsonPath = join(__dirname, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

// Extract the current version
const version = packageJson.version;

// Get the current timestamp in New York timezone
const timestamp = new Date()
  .toLocaleString("en-US", { timeZone: "America/New_York", hour12: false })
  .replace(/, /g, "_")
  .replace(/:/g, "-");

// Full build version
const fullVersion = `${version}-dev.${timestamp}`;

// Log the new version
console.log(`Build version updated to: ${fullVersion}`);
