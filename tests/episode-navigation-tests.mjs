import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const elements = Object.fromEntries(
    ["episodeNavigation", "nextEpisodeLink", "allEpisodesLink"].map((id) => [id, { hidden: true }])
);
let episodes = [{ id: 4, hasVideo: true }, { id: 2, hasVideo: true, title: "Episode 2" }];
let request = async () => ({ response: { ok: true }, data: { episodes } });
const context = vm.createContext({
    document: { getElementById: (id) => elements[id] },
    apiJson: (...args) => request(...args),
    console: { warn() {} },
});
vm.runInContext(fs.readFileSync("dist/js/player/episode-navigation.js", "utf8"), context);
const playback = { seriesId: 8, episodeId: "4", seriesTitle: "Series" };
await context.updateEpisodeNavigation(playback);
assert.equal(elements.nextEpisodeLink.href, "/?episodeId=2");
assert.equal(elements.nextEpisodeLink.hidden, false);
assert.equal(elements.allEpisodesLink.href, "/library-page#series=8");

await context.updateEpisodeNavigation({ ...playback, episodeId: 2 });
assert.equal(elements.nextEpisodeLink.hidden, true);
assert.equal(elements.episodeNavigation.hidden, false);

episodes = [{ id: 4, hasVideo: true }, { id: 5, hasVideo: false }, { id: 6, hasVideo: true }];
await context.updateEpisodeNavigation(playback);
assert.equal(elements.nextEpisodeLink.hidden, true);
await context.updateEpisodeNavigation({ ...playback, episodeId: 999 });
assert.equal(elements.nextEpisodeLink.hidden, true);

request = async () => { throw new Error("Offline"); };
await context.updateEpisodeNavigation(playback);
assert.equal(elements.episodeNavigation.hidden, false);
assert.equal(elements.nextEpisodeLink.hidden, true);

let resolveRequest;
request = () => new Promise((resolve) => { resolveRequest = resolve; });
const pending = context.updateEpisodeNavigation(playback);
context.resetEpisodeNavigation();
resolveRequest({ response: { ok: true }, data: { episodes: [{ id: 4 }, { id: 5, hasVideo: true }] } });
await pending;
assert.equal(elements.episodeNavigation.hidden, true);
assert.equal(elements.nextEpisodeLink.hidden, true);
await context.updateEpisodeNavigation({});
assert.equal(elements.episodeNavigation.hidden, true);
console.log("Episode navigation tests passed");
