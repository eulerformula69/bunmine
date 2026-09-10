import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let created = 0;
class Element {
    children = [];
    dataset = {};
    style = {};
    className = '';
    classList = {
        toggle: (name, enabled) => {
            const names = new Set(this.className.split(' ').filter(Boolean));
            enabled ? names.add(name) : names.delete(name);
            this.className = [...names].join(' ');
        }
    };
    appendChild(child) {
        if (child.fragment) {
            for (const item of [...child.children]) this.appendChild(item);
        } else {
            child.parent = this;
            this.children.push(child);
        }
    }
    replaceChildren(...children) {
        this.children = [];
        children.forEach(child => this.appendChild(child));
    }
    set textContent(value) { this.replaceChildren(); this.text = value; }
    get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(''); }
    setAttribute() {}
    addEventListener() {}
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
    querySelector(selector) {
        const kind = selector.match(/data-kind="(.*?)"/)?.[1];
        const className = selector.slice(1).split('[')[0];
        return this.children.find(child => child.className === className && (!kind || child.dataset.kind === kind)) || null;
    }
}
const list = new Element();
let selected = { currentIdx: 0, startIdx: 0, endIdx: 0 };
let match = null;
const context = {
    document: {
        createElement: () => { created++; return new Element(); },
        createTextNode: text => ({ textContent: text }),
        createDocumentFragment: () => Object.assign(new Element(), { fragment: true }),
        getElementById: () => list
    },
    subtitles: Array.from({ length: 5000 }, (_, index) => ({ start: index, end: index + 1, text: `Line ${index}` })),
    globalSubDelay: 0,
    subtitleElements: [],
    initSubtitleSearchPanel() {},
    getSubtitleContextRange: () => selected,
    getCurrentSearchMatch: () => match,
    formatTime: String,
    startSubtitleContextDrag() {}
};
vm.createContext(context);
vm.runInContext(readFileSync('dist/js/subtitles/sidebar-render.js', 'utf8'), context);
context.renderSubtitles();
assert.equal(list.children.length, 5000);
const originalRows = [...list.children];
created = 0;
selected = { currentIdx: 4500, startIdx: 4499, endIdx: 4501 };
context.renderSubtitles();
assert.ok(created <= 4, `Selection created ${created} elements`);
assert.ok(list.children.every((row, index) => row === originalRows[index]));
assert.ok(!list.children[0].className.includes('active'));
assert.ok(list.children[4500].className.includes('active'));
assert.ok(list.children[4499].querySelector('.subtitle-depth-handle-row[data-kind="back"]'));
match = { type: 'word', subtitleIndex: 4999, start: 0, end: 4 };
created = 0;
context.renderSubtitles();
assert.equal(created, 1);
assert.equal(list.children[4999].querySelector('.text-content').children[1].textContent, 'Line');
match = null;
context.renderSubtitles();
assert.equal(list.children[4999].querySelector('.text-content').textContent, 'Line 4999');
assert.ok(!list.children[4999].className.includes('search-active'));
context.globalSubDelay = 5;
context.renderSubtitles();
assert.equal(list.children[0].children[0].children[0].textContent, '5');
context.subtitles = [{ start: 0, end: 1, text: 'Replacement' }];
selected = { currentIdx: 0, startIdx: 0, endIdx: 0 };
context.renderSubtitles();
assert.equal(list.children.length, 1);
assert.equal(list.children[0].querySelector('.text-content').textContent, 'Replacement');
context.subtitles = [];
context.renderSubtitles();
assert.equal(list.children.length, 0);
console.log('Subtitle sidebar: 5,000 rows, incremental selection/search, delay, replacement, and clearing passed.');
