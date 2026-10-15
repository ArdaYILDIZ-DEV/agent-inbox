// No test dependencies: exercise the inline app with a small DOM and mocked public API.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const setup = script.slice(0, script.indexOf('    $("#toc-toggle").addEventListener'));

class Node {
  constructor(tag = '#fragment') { this.tag = tag; this.children = []; this.attributes = {}; this.dataset = {}; this.listeners = {}; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this.attributes[key] = value; }
  getAttribute(key) { return this.attributes[key] ?? null; }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  querySelectorAll(selector) { return selector.split(/,\s*/).flatMap(tag => descendants(this, tag)); }
  getAnimations() { return []; }
  get textContent() { return this.children.map(c => typeof c === 'string' ? c : c.textContent).join(''); }
  set textContent(value) { this.children = [String(value)]; }
}
function app({ fetch, storage = {}, nodes = {}, navigator = {} } = {}) {
  const sandbox = {
    document: { createElement: tag => new Node(tag), createElementNS: (namespace, tag) => new Node(tag), createDocumentFragment: () => new Node(), querySelector: selector => nodes[selector], addEventListener() {} },
    window: { addEventListener() {}, matchMedia: () => ({ matches: false }) }, history: {}, navigator,
    localStorage: { getItem: key => storage[key] ?? null, setItem() {} },
    location: { hash: '' }, fetch, URL, AbortController, setTimeout, clearTimeout
  };
  vm.createContext(sandbox);
  vm.runInContext(setup + '\nglobalThis.api = { parseMessage, plain, summary, markdown, validItem, get, fetchRecent, commentsToItems, sortItems, dayLabel, renderReader, cachedItems: items, read };', sandbox);
  return sandbox.api;
}
const json = value => JSON.parse(JSON.stringify(value));
const comment = (id, body = '[atheris] Merhaba') => ({ id, body, created_at: '2026-10-15T10:00:00Z' });
const response = (data, link = '', status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data, headers: { get: () => link } });
function descendants(node, tag) {
  return node.children.flatMap(child => typeof child === 'string' ? [] : [ ...(child.tag === tag ? [child] : []), ...descendants(child, tag) ]);
}

test('app has valid JavaScript and no external runtime dependencies', () => {
  new vm.Script(script);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+rel="stylesheet"/);
  assert.match(html, /--bg: #1c1c1c/);
  assert.match(html, /<html lang="tr">/);
});
test('design assets stay local, licensed and compatible with repository subpaths', () => {
  const assets = [...html.matchAll(/(?:url\(["']?|href=")(assets\/[^"')#]+)(?:["')#])/g)].map(match => match[1]);
  assert.ok(assets.length >= 13, 'font subsets and interface icons are declared locally');
  for (const asset of assets) assert.ok(fs.existsSync(path.join(__dirname, '..', asset)), asset);
  for (const family of ['Newsreader', 'Instrument Sans', 'Commit Mono']) assert.ok(html.includes('font-family: "' + family + '"'));
  for (const name of ['newsreader', 'instrument-sans', 'commit-mono', 'phosphor']) {
    assert.ok(fs.readFileSync(path.join(__dirname, '../assets/licenses', name + '.txt'), 'utf8').length > 500);
  }
  const sprite = fs.readFileSync(path.join(__dirname, '../assets/icons.svg'), 'utf8');
  for (const name of ['tray', 'arrow-up-right', 'arrow-clockwise', 'arrow-left', 'caret-left', 'caret-right', 'copy']) {
    assert.ok(sprite.includes('id="' + name + '"'), name);
  }
  assert.doesNotMatch(html, /https?:\/\/[^"'\s]+\.(?:woff2?|ttf)(?:["')]|$)/);
});
test('day headings use Bugün and Dün, then explicit Turkish dates', () => {
  const api = app(), today = new Date(), yesterday = new Date(), older = new Date();
  yesterday.setDate(today.getDate() - 1); older.setDate(today.getDate() - 7);
  assert.equal(api.dayLabel(today.toISOString()), 'Bugün');
  assert.equal(api.dayLabel(yesterday.toISOString()), 'Dün');
  assert.equal(api.dayLabel(older.toISOString()), new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(older));
});
test('parses notifier mention and agent without changing message content', () => {
  const api = app();
  assert.deepEqual(json(api.parseMessage('@ArdaYILDIZ-DEV [codex] # Bitti\n\n**Notlar**')), { agent: 'codex', text: '# Bitti\n\n**Notlar**' });
  assert.deepEqual(json(api.parseMessage('[agent] Merhaba')), { agent: 'agent', text: 'Merhaba' });
  assert.equal(api.parseMessage('Bir not @ArdaYILDIZ-DEV').text, 'Bir not @ArdaYILDIZ-DEV');
});
test('does not mistake a leading Markdown link for an agent name', () => {
  assert.equal(app().parseMessage('[Belge](https://example.com) güncellendi').text, '[Belge](https://example.com) güncellendi');
});
test('previews separate the first line and clean Markdown from subsequent lines', () => {
  const content = app().summary({ text: '# Başlık\n\nParagraf.\n\n## Alt başlık\n- [x] Tamamlandı\n- İkinci madde' });
  assert.equal(content.title, 'Başlık');
  assert.equal(content.preview, 'Paragraf. Alt başlık Tamamlandı İkinci madde');
});
test('previews remove raw HTML and table separator syntax without losing cell text', () => {
  const content = app().summary({ text: '# Sonuç\n\n<img src=x onerror=alert(1)>\n\n| Başlık | Sonuç |\n| --- | :---: |\n| Mobil | Tamam |' });
  assert.equal(content.preview, 'Başlık · Sonuç Mobil · Tamam');
  assert.equal(app().plain('<https://example.com/path> ve <span>güvenli metin</span>'), 'https://example.com/path ve güvenli metin');
});
test('short messages do not repeat the title as a preview', () => {
  assert.deepEqual(json(app().summary({ text: 'İş tamamlandı.' })), { title: 'İş tamamlandı.', preview: '' });
});
test('long single-line messages have bounded titles and useful previews', () => {
  const content = app().summary({ text: 'Okunabilir bir mesaj. '.repeat(40) });
  assert.ok(content.title.length <= 131);
  assert.match(content.title, /…$/);
  assert.ok(content.preview.length > 100 && content.preview.length <= 360);
});
test('invalid and malformed persisted state is ignored', () => {
  for (const storage of [
    { 'ai:cache': 'not-json', 'ai:read': 'not-json' },
    { 'ai:cache': '{}', 'ai:read': '{}' },
    { 'ai:cache': JSON.stringify([null, {}, { id: 1, agent: 'a', text: 'x', at: 'bad-date' }]), 'ai:read': '[null,"1"]' }
  ]) {
    const api = app({ storage });
    assert.equal(api.cachedItems.length, 0);
    assert.equal(api.read.size, 0);
  }
});
test('valid old cache remains compatible, deduplicated and newest first', () => {
  const cached = [1, 3, 2, 3].map(id => ({ id, agent: 'a', text: 'x', at: '2026-01-01T12:00:00Z', hue: 42 }));
  assert.deepEqual(json(app({ storage: { 'ai:cache': JSON.stringify(cached) } }).cachedItems).map(m => m.id), [3, 2, 1]);
});
test('API comments are parsed, sorted and all content is retained', async () => {
  const api = app({ fetch: async () => response([comment(1), comment(2, '@ArdaYILDIZ-DEV [codex] Yeni mesaj')]) });
  const result = await api.fetchRecent(12);
  assert.deepEqual(json(result.items).map(m => m.id), [2, 1]);
  assert.equal(result.items[0].agent, 'codex');
  assert.equal(result.nextPage, null);
});
test('pagination jumps to the last page and fills a short last batch from the previous page', async () => {
  const calls = [], first = Array.from({ length: 100 }, (_, i) => comment(i + 1));
  const second = Array.from({ length: 100 }, (_, i) => comment(i + 101));
  const api = app({ fetch: async url => {
    calls.push(url);
    const page = new URL(url).searchParams.get('page');
    return page === '3' ? response([comment(201), comment(202)]) : page === '2' ? response(second) : response(first, '<https://api.github.com/comments?page=3>; rel="last"');
  } });
  const result = await api.fetchRecent(12);
  assert.equal(calls.length, 3);
  assert.deepEqual(json(result.items).slice(0, 3).map(m => m.id), [202, 201, 200]);
  assert.equal(result.nextPage, 1);
});
test('pagination reuses page one instead of downloading it twice', async () => {
  const calls = [];
  const api = app({ fetch: async url => {
    calls.push(url);
    return new URL(url).searchParams.has('page') ? response([comment(101)]) : response([comment(1)], '<https://api.github.com/comments?page=2>; rel="last"');
  } });
  const result = await api.fetchRecent(12);
  assert.equal(calls.length, 2);
  assert.equal(result.nextPage, null);
  assert.deepEqual(json(result.items).map(m => m.id), [101, 1]);
});
test('rate limits and unavailable APIs have actionable errors', async () => {
  await assert.rejects(app({ fetch: async () => response({}, '', 403) }).get('https://example.com'), /istek sınırına/);
  await assert.rejects(app({ fetch: async () => response({}, '', 404) }).get('https://example.com'), /bulunamadı/);
  await assert.rejects(app({ fetch: async () => response({}, '', 500) }).get('https://example.com'), /HTTP 500/);
  await assert.rejects(app({ fetch: async () => response({ unexpected: true }) }).fetchRecent(12), /beklenmeyen/);
});
test('Markdown supports headings, emphasis, code, quotes and accessible tasks', () => {
  const tree = app().markdown('# Başlık\n\n**Kalın** ve `kod`.\n\n> Alıntı\n\n- [x] Bitti\n- [ ] Bekliyor\n\n```js\nlet x = 1;\n```');
  for (const tag of ['h2', 'strong', 'code', 'blockquote', 'ul', 'pre']) assert.ok(descendants(tree, tag).length, tag);
  assert.match(tree.textContent, /Tamamlandı: Bitti/);
  assert.match(tree.textContent, /Tamamlanmadı: Bekliyor/);
  assert.equal(descendants(tree, 'pre')[0].tabIndex, 0);
});
test('Markdown preserves all six source heading levels for navigation, including repeated and nested headings', () => {
  const source = '# Aynı\n\n## **Aynı**\n\n### Üç\n\n#### Dört\n\n##### Beş\n\n###### Altı\n\n> ## Alıntı başlığı\n\n```md\n## Başlık değil\n```';
  const tree = app().markdown(source);
  const headings = descendants(tree, 'h2').concat(descendants(tree, 'h3'), descendants(tree, 'h4'), descendants(tree, 'h5'), descendants(tree, 'h6'));
  assert.equal(headings.length, 7);
  assert.deepEqual(headings.map(h => h.attributes['data-level']).sort(), ['1', '2', '2', '3', '4', '5', '6']);
  assert.equal(headings.filter(h => h.textContent === 'Aynı').length, 2);
  assert.ok(!headings.some(h => h.textContent.includes('Başlık değil')));
});
test('ordered and unordered lists remain separate, nested lists retain hierarchy', () => {
  const tree = app().markdown('3. Üçüncü\n4. Dördüncü\n- Ana madde\n  - Alt madde\n- Son madde');
  assert.equal(descendants(tree, 'ol').length, 1);
  assert.equal(descendants(tree, 'ol')[0].start, 3);
  assert.equal(descendants(tree, 'ul').length, 2);
  assert.equal(descendants(tree, 'ul')[0].children[0].children.some(c => c.tag === '#fragment'), true);
});
test('Markdown tables have header scopes and a keyboard-scrollable wrapper', () => {
  const tree = app().markdown('| Başlık | Diğer |\n| --- | --- |\n| Bir | İki |');
  assert.equal(descendants(tree, 'table').length, 1);
  assert.equal(descendants(tree, 'th')[0].scope, 'col');
  assert.equal(descendants(tree, 'div')[0].tabIndex, 0);
});
test('raw HTML and script protocols never create executable content', () => {
  const tree = app().markdown('<img src=x onerror=alert(1)>\n\n[Tehlike](javascript:alert(1))\n\n[Belge](https://example.com)\n\n![Görsel](https://example.com/image.png)');
  assert.equal(descendants(tree, 'img').length, 0);
  assert.equal(descendants(tree, 'script').length, 0);
  const links = descendants(tree, 'a');
  assert.equal(links.length, 2);
  assert.ok(links.every(a => a.href.startsWith('https://') && a.rel === 'noopener noreferrer'));
  assert.match(tree.textContent, /<img src=x onerror=alert\(1\)>/);
});
test('tasks use font-independent state markers and code has an accessible copy action', () => {
  const tree = app().markdown('- [x] Bitti\n- [ ] Bekliyor\n\n```js\nconst text = "**düz metin**";\n```');
  const tasks = descendants(tree, 'li');
  assert.ok(tasks.every(li => li.className === 'task-item'));
  const markers = descendants(tree, 'span').filter(node => node.className === 'task-mark');
  assert.deepEqual(markers.map(node => node.attributes['data-checked']), ['true', 'false']);
  assert.ok(markers.every(node => node.textContent === '' && node.attributes['aria-hidden'] === 'true'));
  const copy = descendants(tree, 'button')[0];
  assert.equal(copy.textContent, 'Kopyala');
  assert.equal(copy.type, 'button');
  assert.equal(copy.attributes['aria-label'], 'Kod bloğunu kopyala');
  assert.equal(descendants(tree, 'code')[0].textContent, 'const text = "**düz metin**";');
});
function reader(navigator) {
  const nodes = Object.fromEntries(['#newer', '#older', '#fnav', '#rstate', '#rmain', '#message-title', '#message-meta', '#body', '#toc', '#toc-toggle', '#toc-links', '#toc-list', '#toc-current', '.message-head', '#original'].map(selector => [selector, new Node('div')]));
  nodes['#toc'].classList = { remove() {} };
  const api = app({ nodes, navigator });
  const show = message => {
    api.cachedItems.push(message);
    api.renderReader(String(message.id));
    const meta = nodes['#message-meta'];
    return { copy: descendants(meta, 'button')[0], status: descendants(meta, 'span').find(node => node.getAttribute('role') === 'status') };
  };
  return { api, show };
}
test('reader copies the agent, Turkish timestamp and untouched Markdown with accessible feedback', async () => {
  const writes = [];
  let finish;
  const { show } = reader({ clipboard: { writeText: text => { writes.push(text); return new Promise(resolve => { finish = resolve; }); } } });
  const message = { id: 1, agent: 'atheris', at: '2026-10-15T10:00:00Z', text: '**Notlar**\r\n\r\n- [x] Bitti\r\n\r\n```js\r\nconst x = "<ham>";\r\n```\r\n[Belge](https://example.com)  \n' };
  const { copy, status } = show(message);
  assert.ok(copy, 'message metadata includes a copy button');
  assert.equal(copy.type, 'button');
  assert.equal(copy.textContent, 'Markdown kopyala');
  assert.equal(copy.getAttribute('aria-label'), 'Mesajı Markdown olarak kopyala');
  assert.ok(status, 'copy feedback has a live status role');
  const icon = descendants(copy, 'svg')[0];
  assert.equal(icon.getAttribute('aria-hidden'), 'true');
  assert.equal(icon.getAttribute('focusable'), 'false');
  assert.equal(descendants(icon, 'use')[0].getAttribute('href'), 'assets/icons.svg#copy');
  const pending = copy.listeners.click();
  assert.equal(copy.getAttribute('aria-busy'), 'true');
  assert.equal(copy.textContent, 'Kopyalanıyor…');
  await copy.listeners.click();
  assert.equal(writes.length, 1, 'ignore repeated clicks while copying');
  const date = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(message.at));
  const time = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(new Date(message.at));
  assert.equal(writes[0], `# [atheris] (${date}, ${time})\n\n${message.text}`);
  finish(); await pending;
  assert.equal(copy.textContent, 'Kopyalandı');
  assert.equal(descendants(copy, 'svg')[0], icon, 'feedback preserves the icon');
  assert.equal(status.textContent, 'Mesaj Markdown olarak panoya kopyalandı.');
  assert.equal(copy.getAttribute('aria-busy'), null);
  const again = copy.listeners.click();
  finish(); await again;
  assert.equal(writes.length, 2);
});
test('reader copy follows message changes and preserves empty raw content', async () => {
  const writes = [];
  let finish;
  const { show } = reader({ clipboard: { writeText: text => { writes.push(text); return new Promise(resolve => { finish = resolve; }); } } });
  const first = show({ id: 1, agent: 'first', at: '2026-10-15T10:00:00Z', text: 'Eski mesaj' });
  const pending = first.copy.listeners.click(), finishFirst = finish;
  const second = show({ id: 2, agent: 'second', at: '2026-10-16T12:00:00Z', text: '' });
  finishFirst(); await pending;
  assert.equal(second.copy.textContent, 'Markdown kopyala');
  assert.equal(second.status.textContent, '');
  const next = second.copy.listeners.click();
  finish(); await next;
  assert.match(writes[1], /^# \[second\] \(/);
  assert.ok(writes[1].endsWith(')\n\n'));
  assert.doesNotMatch(writes[1], /Eski mesaj|Boş mesaj/);
});
test('reader reports unavailable or denied clipboard access and allows retry', async () => {
  for (const navigator of [{}, { clipboard: { writeText: async () => { throw new Error('Permission denied'); } } }]) {
    const { show } = reader(navigator);
    const { copy, status } = show({ id: 1, agent: 'atheris', at: '2026-10-15T10:00:00Z', text: 'Not' });
    await copy.listeners.click();
    assert.equal(copy.textContent, 'Tekrar dene');
    assert.match(status.textContent, /Kopyalanamadı/);
    assert.notEqual(status.className, 'sr-only');
    assert.equal(copy.getAttribute('aria-busy'), null);
    navigator.clipboard = { writeText: async () => {} };
    await copy.listeners.click();
    assert.equal(copy.textContent, 'Kopyalandı');
    assert.equal(status.className, 'sr-only');
  }
});
test('inline code keeps Markdown markers literal', () => {
  const tree = app().markdown('`**kelime**` ve `https://example.com`');
  assert.deepEqual(descendants(tree, 'code').map(node => node.textContent), ['**kelime**', 'https://example.com']);
  assert.equal(descendants(tree, 'strong').length, 0);
  assert.equal(descendants(tree, 'a').length, 0);
});
test('an unclosed code fence keeps the remaining source visible', () => {
  const tree = app().markdown('```\nfirst\nsecond');
  assert.equal(descendants(tree, 'code')[0].textContent, 'first\nsecond');
});
