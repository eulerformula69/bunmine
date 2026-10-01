import fs from "node:fs";
import { spawnSync } from "node:child_process";

function run(args) {
    const result = spawnSync(process.execPath, args, {stdio: "inherit"});
    if (result.status !== 0) process.exit(result.status ?? 1);
}
run(["tools/build-frontend.mjs", "--compile"]);
run(["tools/build-frontend.mjs"]);
for (const name of fs.readdirSync("tests").filter(name => name.endsWith("-tests.mjs")).sort()) {
    run([`tests/${name}`]);
}
run(["tests/module-startup-tests.mjs", "library"]);
