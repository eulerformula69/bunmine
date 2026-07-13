import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(projectDir, "frontend", "libs", "media-captions");

await mkdir(outputDir, { recursive: true });
await build({
    stdin: {
        contents: `
            import { ParseErrorCode, parseText } from "media-captions";
            globalThis.MediaCaptions = Object.freeze({ ParseErrorCode, parseText });
        `,
        loader: "js",
        resolveDir: projectDir,
        sourcefile: "media-captions-browser-entry.js"
    },
    bundle: true,
    format: "iife",
    target: "es2020",
    minify: false,
    legalComments: "inline",
    outfile: path.join(outputDir, "media-captions.js")
});
