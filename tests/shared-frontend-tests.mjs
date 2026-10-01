import assert from 'node:assert/strict';
import {installDom} from './dom-environment.mjs';
const dom = installDom('library');
const {requestWithRetry} = await import('../dist/esm/core/rate-limit.js');
const {safeWebUrl} = await import('../dist/esm/core/safe-url.js');
const {formatTime} = await import('../dist/esm/core/formatters.js');
const {confirmToast} = await import('../dist/esm/core/notifications.js');
const {t} = await import('../dist/esm/core/translate.js');
assert.equal(t('episodeLabel', {number: 4}, 'en'), 'Episode 4');
assert.equal(t('candidateTitle', {}, 'ja'), '候補');
assert.equal(formatTime(3720, 'duration'), '1h 2m');
// Preserve the existing fractional-floor display during this refactor.
assert.equal(formatTime(62.345), '1:02.344');
assert.equal(formatTime(62.5), '1:02.500');
for (const value of ['javascript:alert(1)', 'data:image/svg+xml,x', 'file:///secret']) {
    assert.equal(safeWebUrl(value), '');
}
const credentialUrl = new URL('https://example.com');
credentialUrl.username = 'test';
assert.equal(safeWebUrl(credentialUrl.href), '');
assert.equal(safeWebUrl('/library/file/1'), 'http://localhost:5000/library/file/1');
const waits=[];
let calls=0;
const result=await requestWithRetry(async()=>{
    calls++;
    if(calls===1) throw new TypeError('offline');
    return {response:new Response('',{status:calls===2?429:200,headers:{'Retry-After':'2'}}),data:{retryAfter:50}};
},{networkRetries:1,retries:1,delayMs:10,exhaustedMessage:'limited',wait:async ms=>{waits.push(ms);}});
assert.equal(result.response.status,200);
assert.deepEqual(waits,[10,2000]);
let permanentCalls=0;
await assert.rejects(requestWithRetry(async()=>{
    permanentCalls++; throw new TypeError('offline');
},{networkRetries:1,retries:4,exhaustedMessage:'limited',wait:async()=>{}}),/offline/);
assert.equal(permanentCalls,2);
const abort=new AbortController();
await assert.rejects(requestWithRetry(async()=>({response:new Response('',{status:429})}),{
    exhaustedMessage:'limited',signal:abort.signal,onWait:()=>abort.abort(),
}),{name:'AbortError'});
let resolved=false;
const confirmation=confirmToast('<delete?>','Delete','Cancel').then(value=>{resolved=true;return value;});
assert.equal(resolved,false);
assert.equal(document.querySelector('.mp-toast-action-message').textContent,'<delete?>');
document.querySelectorAll('.mp-toast-action-button')[1].click();
assert.equal(await confirmation,false);
const accepted=confirmToast('Delete?','Delete','Cancel');
document.querySelectorAll('.mp-toast-action-button')[2].click();
assert.equal(await accepted,true);
dom.window.close();
