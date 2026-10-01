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
dom.window.close();
