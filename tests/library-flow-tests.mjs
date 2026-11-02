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
dom.window.close();
