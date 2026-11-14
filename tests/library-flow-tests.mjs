import assert from 'node:assert/strict';
import {installDom} from './dom-environment.mjs';

const dom = installDom('library');
const calls = [];
globalThis.fetch = async (url, options = {}) => {
    calls.push({url: String(url), options});
    let data = {series: []};
    if (String(url).endsWith('/library/scan')) data = {job: {id: 'scan-1'}};
    if (String(url).endsWith('/library/jobs/scan-1')) data = {job: {status: 'completed', result: {}}};
    return new Response(JSON.stringify(data));
};
const api = await import('../dist/esm/library/library-api.js');
await api.libraryDeleteSeries('a/b');
assert.ok(calls.at(-1).url.endsWith('/library/series/a%2Fb'));
assert.equal(calls.at(-1).options.method, 'DELETE');
const signal = new AbortController().signal;
await api.librarySelectEpisodeSubtitle(12, {filename: 'test.srt'}, signal);
assert.equal(calls.at(-1).options.signal, signal);
assert.deepEqual(JSON.parse(calls.at(-1).options.body), {filename: 'test.srt'});
await import('../dist/esm/library/library-bindings.js');
const scan = document.getElementById('scanLibraryBtn');
scan.click();
assert.equal(scan.disabled, true);
for (let attempt = 0; attempt < 20 && scan.disabled; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 10));
}
assert.equal(scan.disabled, false);
const scans = calls.filter(call => call.url.endsWith('/library/scan'));
assert.equal(scans.length, 1);
assert.equal(scans[0].options.method, 'POST');
assert.ok(calls.some(call => call.url.endsWith('/library/jobs/scan-1')));
assert.ok(calls.filter(call => call.url.endsWith('/library/series')).length >= 2);
const state = await import('../dist/esm/library/library-state.js');
state.librarySeriesState.value = [
    {id: 1, title: 'Zebra', episodesCount: 10, completedEpisodes: 2},
    {id: 2, title: 'Alpha', episodesCount: 10, completedEpisodes: 8},
];
const sortSelect = document.getElementById('librarySortSelect');
sortSelect.value = 'title';
sortSelect.dispatchEvent(new Event('change', {bubbles: true}));
assert.deepEqual([...document.querySelectorAll('.series-card h3')].map(el => el.textContent), ['Alpha', 'Zebra']);
assert.equal(JSON.parse(localStorage.getItem('bunmineLibraryViewState')).sort, 'title');
document.querySelector('[data-filter="watching"]').click();
assert.equal(sortSelect.value, 'title', 'Filtering preserves the selected sort');
assert.equal(document.querySelector('[data-filter="watching"]').getAttribute('aria-pressed'), 'true');
sortSelect.value = 'progress';
sortSelect.dispatchEvent(new Event('change', {bubbles: true}));
assert.equal(JSON.parse(localStorage.getItem('bunmineLibraryViewState')).sort, 'progress');

for (const language of ['ru', 'ja', 'en']) {
    localStorage.setItem('subtitlePlayerSettings', JSON.stringify({language}));
    const library = await import('../dist/esm/library/library.js');
    library.applyLibraryLanguage();
    library.renderCatalog();
    assert.equal(sortSelect.options.length, 4);
    assert.equal(sortSelect.value, 'progress');
}
const episodesTab = document.getElementById('episodesTabButton');
const filesTab = document.getElementById('filesTabButton');
const toolsTab = document.getElementById('toolsTabButton');
episodesTab.focus();
episodesTab.dispatchEvent(new window.KeyboardEvent('keydown', {key:'ArrowRight', bubbles:true}));
assert.equal(document.activeElement, filesTab);
assert.equal(filesTab.getAttribute('aria-selected'), 'true');
assert.equal(document.getElementById('filesTab').classList.contains('hidden'), false);
assert.equal(document.getElementById('episodesTab').classList.contains('hidden'), true);
filesTab.dispatchEvent(new window.KeyboardEvent('keydown', {key:'End', bubbles:true}));
assert.equal(document.activeElement, toolsTab);
toolsTab.dispatchEvent(new window.KeyboardEvent('keydown', {key:'ArrowRight', bubbles:true}));
assert.equal(document.activeElement, episodesTab, 'Arrow navigation wraps');
filesTab.click();
assert.equal(filesTab.tabIndex, 0);
assert.equal(episodesTab.tabIndex, -1);
assert.equal(filesTab.getAttribute('aria-selected'), 'true');
const libraryView = await import('../dist/esm/library/library.js');
let ignored = false;
let rejectIgnore = false;
let ignoreRequests = 0;
let finishIgnore;
globalThis.fetch = async (url, options = {}) => {
    const path = String(url);
    if (path.endsWith('/ignored')) {
        ignoreRequests += 1;
        if (rejectIgnore) return new Response(JSON.stringify({error: 'Save failed'}), {status: 500});
        await new Promise(resolve => { finishIgnore = resolve; });
        ignored = JSON.parse(options.body).ignored;
        return new Response(JSON.stringify({ok: true}));
    }
    const series = {id: 24, title: 'Show', episodesCount: ignored ? 0 : 1};
    if (path.endsWith('/library/series')) return new Response(JSON.stringify({series: [series]}));
    return new Response(JSON.stringify({series, episodes: [
        {id: 1, hasVideo: true, videoFilename: 'creditless OP.mkv', isIgnored: ignored},
    ]}));
};
window.scrollTo = () => {};
Object.defineProperty(globalThis, 'history', {configurable: true, value: window.history});
await libraryView.openSeries(24);
filesTab.click();
let ignoreButton = document.querySelector('.ignore-episode-btn');
ignoreButton.click();
ignoreButton.click();
assert.equal(ignoreButton.disabled, true);
assert.equal(ignoreRequests, 1, 'Repeated clicks do not submit a second request');
finishIgnore();
for (let attempt = 0; attempt < 30 && document.querySelector('.ignore-episode-btn') === ignoreButton; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 5));
}
assert.equal(document.querySelectorAll('#episodeList .episode-row').length, 0);
assert.equal(document.querySelectorAll('#fileList .file-row').length, 1);
assert.equal(document.querySelector('.ignore-episode-btn').getAttribute('aria-pressed'), 'true');
assert.equal(document.querySelector('.subtitle-file-action'), null);
assert.equal(document.getElementById('filesTab').classList.contains('hidden'), false);
rejectIgnore = true;
ignoreButton = document.querySelector('.ignore-episode-btn');
ignoreButton.click();
for (let attempt = 0; attempt < 30 && ignoreButton.disabled; attempt += 1) await new Promise(resolve => setTimeout(resolve, 5));
assert.equal(ignored, true, 'A failed save keeps the previous classification');
assert.equal(ignoreButton.disabled, false);
rejectIgnore = false;
ignoreButton.click();
finishIgnore();
for (let attempt = 0; attempt < 30 && document.querySelector('.ignore-episode-btn') === ignoreButton; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 5));
}
assert.equal(document.querySelectorAll('#episodeList .episode-row').length, 1);
assert.equal(document.querySelector('.ignore-episode-btn').getAttribute('aria-pressed'), 'false');
const episode = {id: 1, title: 'Episode 1', hasVideo: true, currentTimeSeconds: 120, durationSeconds: 0};
assert.equal(libraryView.renderEpisodeRow(episode).querySelector('.episode-main p').textContent.includes('/ 0m'), false,
    'Unknown duration must not look like a zero-minute episode');
assert.ok(libraryView.renderEpisodeRow({...episode, durationSeconds: 600}).querySelector('.episode-main p').textContent.includes('2m / 10m'));
const navigation = {href: ''};
Object.defineProperty(globalThis, 'location', {configurable: true, value: navigation});
globalThis.fetch = async () => new Response(JSON.stringify({
    series: {id: 24, title: 'Between episodes', episodesCount: 3},
    episodes: [
        {id: 1, hasVideo: true, completed: true},
        {id: 2, hasVideo: true, completed: false, currentTimeSeconds: 0},
    ],
}));
for (const activation of ['click', 'Enter', ' ']) {
    navigation.href = '';
    const card = libraryView.renderSeriesCard({id: 24, title: 'Between episodes', episodesCount: 3, completedEpisodes: 1});
    if (activation === 'click') card.click();
    else card.dispatchEvent(new window.KeyboardEvent('keydown', {key: activation}));
    for (let attempt = 0; attempt < 20 && !navigation.href; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.equal(navigation.href, '/player?episodeId=2', 'Continue opens the next episode when its saved time is zero');
}
dom.window.close();
