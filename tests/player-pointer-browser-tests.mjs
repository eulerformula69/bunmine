import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || "playwright");
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
    const page = await browser.newPage();
    const html = fs.readFileSync("frontend/player.html", "utf8")
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<link\b[^>]*>/gi, "");
    await page.setContent(html);
    for (const path of ["frontend/styles/player.css", "frontend/styles/episode-navigation.css"]) {
        await page.addStyleTag({ content: fs.readFileSync(path, "utf8") });
    }
    await page.addScriptTag({ content: fs.readFileSync("dist/js/player/shell-bindings.js", "utf8") });
    await page.evaluate(() => {
        const byId = (id) => document.getElementById(id);
        byId("dropzone").classList.add("hidden");
        byId("sidebar").style.display = "none";
        for (const id of ["episodeNavigation", "nextEpisodeLink"]) byId(id).hidden = false;
        byId("nextEpisodeLink").href = "#next";
        byId("allEpisodesLink").href = "#all";
        byId("subtitleOverlay").innerHTML = '<div class="subtitle-overlay-region subtitle-overlay-region-bottom"><div class="subtitle-overlay-line">字幕の選択テスト</div></div>';
        window.playbackToggleCount = 0;
        byId("video").play = async () => { window.playbackToggleCount += 1; };
        bindPlayerShell({
            ...Object.fromEntries(["video", "volume", "dropzone", "videoContainer", "multiInput",
                "playPause", "settingsModal", "progress", "controls"].map((id) => [id, byId(id)])),
            closeSettingsButton: byId("closeSettingsBtn"),
            handleFiles() {},
        });
    });

    await page.evaluate(() => {
        document.getElementById("videoContainer").style.height = "90%";
    });
    await page.mouse.move(1, 1);
    await page.waitForFunction(() => getComputedStyle(document.getElementById("episodeNavigation")).opacity === "0");
    assert.equal(await page.locator("#nextEpisodeLink").evaluate((el) => getComputedStyle(el).pointerEvents), "none");
    await page.locator("#allEpisodesLink").focus();
    await page.waitForFunction(() => getComputedStyle(document.getElementById("episodeNavigation")).opacity === "1");
    await page.evaluate(() => document.activeElement.blur());
    await page.mouse.move(300, 300);
    await page.waitForFunction(() => getComputedStyle(document.getElementById("episodeNavigation")).opacity === "1");
    await page.mouse.move(1, 1);
    await page.waitForFunction(() => getComputedStyle(document.getElementById("episodeNavigation")).opacity === "0");
    console.log("Episode links appear on hover or keyboard focus and hide after pointer exit");

    for (const width of [1280, 768, 390]) {
        await page.setViewportSize({ width, height: 800 });
        const line = page.locator(".subtitle-overlay-line");
        const rect = await line.boundingBox();
        await page.mouse.move(rect.x + 2, rect.y + rect.height / 2);
        await page.mouse.down();
        await page.mouse.move(rect.x + rect.width - 2, rect.y + rect.height / 2, { steps: 15 });
        await page.mouse.up();
        assert.equal(await page.evaluate(() => getSelection().toString()), "字幕の選択テスト");
        await page.locator("#nextEpisodeLink").click({ timeout: 2000 });
        assert.ok(page.url().endsWith("#next"));
        await page.locator("#allEpisodesLink").click({ timeout: 2000 });
        assert.ok(page.url().endsWith("#all"));
        assert.equal(await page.evaluate(() => window.playbackToggleCount), 0);
        const emptyAreaTarget = await page.evaluate(() => {
            const rect = document.getElementById("subtitleOverlay").getBoundingClientRect();
            const target = document.elementFromPoint(rect.x + 8, rect.bottom - 8);
            return document.getElementById("subtitleOverlay").contains(target);
        });
        assert.equal(emptyAreaTarget, true);
        console.log(`Subtitle selection, overlay hit testing and episode links passed at ${width}px`);
    }
} finally {
    await browser.close();
}
