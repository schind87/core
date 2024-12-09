const fs = require("fs");
const path = require("path");

// Read the package.json file
const packageJsonPath = path.join(__dirname, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

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

// Read the source file
const sourceFile = path.join(__dirname, "src", "family-calendar-card.ts");
let content = fs.readFileSync(sourceFile, "utf8");

// Replace the version placeholder
content = content.replace(/__BUILD_VERSION__/g, fullVersion);

// Write the processed content back
fs.writeFileSync(sourceFile, content, "utf8");
