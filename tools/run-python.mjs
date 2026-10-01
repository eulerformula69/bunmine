import { spawnSync } from "node:child_process";

const candidates = process.platform === "win32" ? ["py", "python"] : ["python3", "python"];
for (const executable of candidates) {
    const result = spawnSync(executable, process.argv.slice(2), {stdio: "inherit"});
    if (result.error?.code === "ENOENT") continue;
    if (result.error) console.error(result.error.message);
    process.exit(result.status ?? 1);
}
console.error("Python was not found. Install Python 3.13 and try again.");
process.exit(1);
