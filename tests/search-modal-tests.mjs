import assert from 'node:assert/strict';
import {installDom} from './dom-environment.mjs';
const dom=installDom('library');
const {createLibrarySearchModal}=await import('../dist/esm/library/search-modal.js');
const {escapeHtml}=await import('../dist/esm/core/formatters.js');
const pending=[];
const results=document.createElement('div');
const button=document.createElement('button');
const modal=createLibrarySearchModal({
    modal:document.createElement('div'),title:document.createElement('div'),subtitle:document.createElement('div'),
    searchInput:document.createElement('input'),searchButton:button,results,
    translate:key=>key,escapeHtml,
    search:id=>new Promise(resolve=>pending.push({id,resolve})),select:async()=>({response:new Response(''),data:{}}),
},{
    describe:item=>({id:item.id,query:item.title,title:item.title,subtitle:''}),
    render:item=>{const el=document.createElement('button');el.textContent=item.title;return el;},
    payload:item=>item,saved:()=>{},empty:'noResultsFound',searching:'searching',searchError:'coverSearchFailed',saveError:'couldNotSaveCover',searchOnOpen:true,
});
const oldSearch=modal.open({id:1,title:'Old'});
const currentSearch=modal.open({id:2,title:'Current'});
pending[1].resolve({response:new Response(''),data:{results:[{title:'Current result'}]}});
await currentSearch;
pending[0].resolve({response:new Response(''),data:{results:[{title:'Old result'}]}});
await oldSearch;
assert.equal(results.textContent,'Current result','An older search must not replace the current series results');
assert.equal(button.disabled,false);
const failing=modal.search();
pending[2].resolve({response:new Response('',{status:500}),data:{error:{code:'search_failed',message:'<unsafe>'}}});
await failing;
assert.equal(results.textContent,'<unsafe>');
assert.equal(results.querySelector('unsafe'),null);
assert.equal(button.disabled,false);
const closedSearch=modal.search();
modal.close();
const closedText=results.textContent;
pending[3].resolve({response:new Response(''),data:{results:[{title:'Late result'}]}});
await closedSearch;
assert.equal(results.textContent,closedText);
assert.equal(button.disabled,false);
dom.window.close();
