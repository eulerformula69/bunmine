import { cp, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageDir = path.dirname(require.resolve("kuromoji/package.json"));
const outputDir = path.join(projectDir, "frontend", "libs", "kuromoji");

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await cp(path.join(packageDir, "build", "kuromoji.js"), path.join(outputDir, "kuromoji.js"));
await cp(path.join(packageDir, "dict"), path.join(outputDir, "dict"), { recursive: true });
