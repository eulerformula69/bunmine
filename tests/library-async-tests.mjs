import assert from "node:assert/strict";
import {installDom} from "./dom-environment.mjs";
const dom = installDom("library");
const {pollLibraryJob} = await import("../dist/esm/library/job-polling.js");
let now=0;
let polls=0;
const deps={now:()=>now,wait:async ms=>{now+=ms;},request:async()=>({
    response:new Response(""),data:{job:{status:++polls<2?"running":"completed",result:{filesFound:3}}}
})};
assert.deepEqual(await pollLibraryJob("test",{failureMessage:"failed"},deps),{filesFound:3});
await assert.rejects(pollLibraryJob("test",{failureMessage:"failed",timeoutMs:1000}, {
    ...deps,request:async()=>({response:new Response(""),data:{job:{status:"running"}}})
}), /timed out/);
await assert.rejects(pollLibraryJob("test",{failureMessage:"failed"}, {
    ...deps,request:async()=>({response:new Response("",{status:404}),data:{error:"missing"}})
}), /missing/);
const cancelled=new AbortController();
cancelled.abort();
await assert.rejects(pollLibraryJob("test",{failureMessage:"failed",signal:cancelled.signal},deps),{name:"AbortError"});
const {retryOnRateLimit} = await import("../dist/esm/core/rate-limit.js");
const backoff = new AbortController();
const waiting = retryOnRateLimit(async()=>({response:new Response("",{status:429}),data:{retryAfter:60}}), {
    failureMessage:"failed",exhaustedMessage:"limit",signal:backoff.signal,onWait:()=>queueMicrotask(()=>backoff.abort())
});
await assert.rejects(waiting,{name:"AbortError"});
const state=await import("../dist/esm/library/library-state.js");
state.currentOpenedSeriesState.value={id:1,title:"Test"};
const items=Array.from({length:10},(_,id)=>({episodeId:id,status:"ready",selected:{filename:"test.srt"}}));
state.currentBulkSubtitlePlanState.value={items};
const list=document.getElementById("bulkSubtitleList");
for(const item of items) {
    const input=document.createElement("input");
    input.type="checkbox"; input.checked=true; input.className="bulk-subtitle-checkbox";
    input.dataset.episodeId=String(item.episodeId);list.appendChild(input);
}
const signals=[];
globalThis.fetch=(_url,options)=>new Promise((_resolve,reject)=>{
    signals.push(options.signal);
    options.signal.addEventListener("abort",()=>reject(options.signal.reason),{once:true});
});
const bulk=await import("../dist/esm/library/library-bulk-workflow.js");
bulk.openBulkSubtitleModal();
const downloading=bulk.downloadSelectedBulkSubtitles();
assert.ok(signals.length>0 && signals.length<10);
assert.equal(document.getElementById("cancelBulkSubtitleDownloadBtn").disabled,false);
const started=signals.length;
bulk.closeBulkSubtitleModal();
await downloading;
assert.equal(signals.length,started,"Cancellation must stop queued requests");
assert.ok(signals.every(signal=>signal.aborted));
assert.equal(state.isBulkSubtitleDownloadingState.value,false);
assert.ok(document.getElementById("bulkSubtitleModal").classList.contains("hidden"));
dom.window.close();
console.log("Job timeout, failed response, cancelled backoff and bulk cancellation tests passed");
