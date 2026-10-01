import { build } from "esbuild";
import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

if (process.argv.includes("--compile")) {
    const output = path.resolve("dist");
    if (output !== path.join(process.cwd(), "dist")) throw new Error("Invalid build output path");
    rmSync(output, { recursive: true, force: true });
    const result = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.json"], { stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status || 1);
}
await build({
    entryPoints: { player: "dist/esm/bootstrap.js", library: "dist/esm/library-bootstrap.js" },
    outdir: "dist/js", bundle: true, format: "esm", target: "es2020", sourcemap: true,
    external: ["kuromoji", "media-captions"],
});
