// Optional real-browser checks. Runtime site remains dependency-free.
// PLAYWRIGHT_MODULE can point to an existing Playwright installation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const apiRoot = 'https://api.github.com/repos/ArdaYILDIZ-DEV/agent-inbox';
const issue = `${apiRoot}/issues/1`;
const date = new Date().toISOString();
const rich = '# Okunabilir bir mesaj\n\nBirinci paragraf. **Önemli bir not** ve `index.html` içeriği.\n\n## Kontroller\n\n- [x] Masaüstü\n- [ ] Mobil\n\n> Sade ve okunabilir.\n\n```js\nconst longLine = "' + 'x'.repeat(250) + '";\n```\n\n| Başlık | Sonuç |\n| --- | --- |\n| Mobil | Tamam |\n\n[Kaynak](https://example.com)\n\n<img src=x onerror="window.injected=true">\n\n[Tehlike](javascript:alert(1))\n\n' + ('Uzun mesajlarda satır uzunluğu ve paragraf araları rahat bir okuma deneyimi sunmalı. '.repeat(5) + '\n\n').repeat(12);
const comment = (id, body = `@ArdaYILDIZ-DEV [codex] # Mesaj ${id}\n\nTamamlanan işler ve sonraki adımlar.`) => ({ id, body, created_at: date, issue_url: issue });
const fixtures = Array.from({ length: 30 }, (_, i) => comment(1001 + i));
fixtures[29] = comment(1030, `@ArdaYILDIZ-DEV [atheris] ${rich}`);
let checks = 0;
function check(value, message) { assert.ok(value, message); console.log(`PASS ${++checks}: ${message}`); }

(async () => {
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = path.resolve(root, pathname.slice('/agent-inbox/'.length) || 'index.html');
    if (!pathname.startsWith('/agent-inbox/') ||
        (file !== path.join(root, 'index.html') && !file.startsWith(path.join(root, 'assets') + path.sep)) ||
        !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404); response.end(); return;
    }
    const types = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
    response.setHeader('Content-Type', types[path.extname(file)] || 'text/plain; charset=utf-8');
    response.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const errors = [];
  const url = `http://127.0.0.1:${server.address().port}/agent-inbox/`;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', reducedMotion: 'reduce' });
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  let mode = 'normal', calls = [], version = 1;
  await context.route('https://api.github.com/**', async route => {
    const requestUrl = new URL(route.request().url()); calls.push(requestUrl.pathname + requestUrl.search);
    const id = Number(requestUrl.pathname.split('/').pop());
    if (mode === 'offline') return route.abort('internetdisconnected');
    if (mode === 'rate-limit') return route.fulfill({ status: 403, json: { message: 'Rate limit' } });
    if (requestUrl.pathname.includes('/issues/comments/')) {
      if (id === 999) return route.fulfill({ json: comment(999, '[archive] Ancien message hors des douze derniers.') });
      if (id === 998) return route.fulfill({ json: { ...comment(998), issue_url: `${apiRoot}/issues/2` } });
      return route.fulfill({ status: 404, json: { message: 'Not found' } });
    }
    if (mode === 'empty') return route.fulfill({ json: [] });
    if (mode === 'paginated') {
      const page = Number(requestUrl.searchParams.get('page') || 1);
      if (page === 3) return route.fulfill({ json: [comment(1201), comment(1202)] });
      const base = page === 2 ? 1101 : 1001;
      return route.fulfill({ json: Array.from({ length: 100 }, (_, i) => comment(base + i)), headers: page === 1 ? { Link: `<${issue}/comments?per_page=100&page=3>; rel="last"`, "Access-Control-Expose-Headers": "Link" } : {} });
    }
    const result = version === 1 ? fixtures : fixtures.map(c => c.id === 1030 ? { ...c, body: c.body + '\n\nContenu modifié.' } : c);
    return route.fulfill({ json: result });
  });
  try {
    const page = await context.newPage();
    const ready = () => page.waitForFunction(() => !document.querySelector('#refresh').disabled);
    const more = async () => { await page.locator('#load-more').click(); await page.waitForFunction(() => !document.querySelector('#load-more').disabled); };
    await page.goto(url); await ready();
    check(await page.locator('.row').count() === 12, 'initial list shows the newest twelve messages');
    check(await page.locator('.row').first().getAttribute('data-id') === '1030', 'newest-first order is preserved');
    check(await page.locator('.row-title').first().innerText() === 'Okunabilir bir mesaj', 'agent transport prefix is removed and a useful title is shown');
    check(!/##|\[x\]/.test(await page.locator('.preview').first().innerText()), 'previews do not leak Markdown syntax');
    check(await page.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(28, 28, 28)', '#1c1c1c is used even with a light system preference');
    // Extended subsets load on demand; request Turkish glyphs before checking their availability.
    await page.evaluate(async () => {
      await Promise.all(['Newsreader', 'Instrument Sans', 'Commit Mono'].map(family =>
        document.fonts.load(`16px "${family}"`, 'Türkçe: ıİşŞğĞçÇöÖüÜ')));
      await document.fonts.ready;
    });
    check(await page.evaluate(() => ['Newsreader', 'Instrument Sans', 'Commit Mono'].every(family =>
      [...document.fonts].some(font => font.family.replaceAll('"', '') === family && font.status === 'loaded') &&
      document.fonts.check(`16px "${family}"`, 'Türkçe: ıİşŞğĞçÇöÖüÜ'))), 'all three self-hosted fonts load, including Turkish text');
    const sprite = await page.request.get(`${url}assets/icons.svg`);
    check(sprite.ok() && (await sprite.text()).includes('id="tray"') &&
      await page.locator('.brand use').getAttribute('href') === 'assets/icons.svg#tray', 'local Phosphor sprite resolves under a GitHub Pages repository subpath');
    check(await page.locator('.day').first().evaluate(n => getComputedStyle(n).display) === 'grid', 'desktop date rail groups messages without separate cards');
    check(await page.locator('.day h2').first().evaluate(n => {
      const style = getComputedStyle(n);
      return style.writingMode === 'horizontal-tb' && style.whiteSpace === 'nowrap' && parseFloat(style.fontSize) >= 27;
    }), 'day headings are prominent, horizontal and unbroken');
    await page.keyboard.press('Tab');
    check(await page.evaluate(() => document.activeElement.classList.contains('skip')), 'keyboard users can skip to the content');
    await page.keyboard.press('Enter');
    check(await page.evaluate(() => document.activeElement.id) === 'main', 'skip link focuses the main landmark');

    const row = page.locator('.row').nth(7); await row.scrollIntoViewIfNeeded();
    const position = await page.evaluate(() => scrollY), origin = await row.getAttribute('data-id');
    await row.click(); await page.waitForSelector('#rmain:visible');
    check(await page.evaluate(() => document.activeElement.id) === 'rmain', 'opening a message focuses its article');
    await page.locator('#older').click(); await page.waitForURL(`**/#/m/${Number(origin) - 1}`);
    await page.goBack(); await page.waitForSelector('#home:visible');
    check(Math.abs(await page.evaluate(() => scrollY) - position) <= 2, 'browser Back restores the inbox scroll position after adjacent navigation');
    check(await page.evaluate(() => document.activeElement.dataset.id) === origin, 'return focus belongs to the originating list row');
    check(!await page.locator(`.row[data-id="${origin}"]`).evaluate(n => n.classList.contains('unread')), 'opened messages retain their read state');
    await more();
    check(await page.locator('.row').count() === 24, 'load more reveals the next batch');
    check(await page.evaluate(() => document.activeElement.dataset.id) === '1018', 'load more focuses the first newly revealed message');
    await more();
    check(await page.locator('.row').count() === 30 && !await page.locator('#more').isVisible(), 'end of history hides load more');

    await page.locator('.row').first().click(); await page.waitForSelector('#rmain:visible');
    check(await page.locator('#body pre').count() === 1 && await page.locator('#body table').count() === 1, 'reader renders code and tables');
    check(await page.locator('#newer').getAttribute('role') === 'link' && !await page.locator('#newer').getAttribute('href') &&
      await page.locator('#newer').getAttribute('aria-disabled') === 'true', 'disabled adjacent navigation keeps a valid accessible link role without an active destination');
    check(await page.locator('#body').evaluate(n => getComputedStyle(n).fontFamily.includes('Newsreader')) &&
      await page.locator('#body pre').evaluate(n => getComputedStyle(n).fontFamily.includes('Commit Mono')), 'long-form prose and code retain distinct typographic roles');
    check(await page.locator('#body img, #body script, #body a[href^="javascript:"]').count() === 0 && !await page.evaluate(() => window.injected), 'untrusted Markdown is inert');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      check(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), `reader reflows without page overflow at ${width}px`);
    }
    await page.locator('#body pre').focus();
    check(await page.locator('#body pre').evaluate(n => n.scrollWidth > n.clientWidth && n === document.activeElement), 'wide code scrolls inside a keyboard-focusable region');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => scrollTo(0, 1400));
    const beforeRefresh = calls.length, readingPosition = await page.evaluate(() => scrollY);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    check(calls.length === beforeRefresh && await page.evaluate(() => scrollY) === readingPosition, 'visibility refresh does not interrupt a message being read');
    check((await page.locator('#back').boundingBox()).y >= 0 && (await page.locator('#back').boundingBox()).y < 70, 'return navigation stays available while reading a long message');
    await page.keyboard.press('Escape'); await page.waitForSelector('#home:visible');
    check(await page.locator('#home').isVisible(), 'Escape returns to the inbox without letter-key shortcuts');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      check(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), `inbox reflows without overflow at ${width}px`);
      if (width <= 390) check(await page.locator('.day').first().evaluate(n => getComputedStyle(n).display) === 'block', `date groups stack above messages at ${width}px`);
    }
    await page.locator('#refresh').click(); await ready();
    const title = page.locator('.row-title').first();
    version = 2; await page.locator('#refresh').click(); await ready();
    await title.click(); await page.waitForSelector('#rmain:visible');
    check((await page.locator('#body').innerText()).includes('Contenu modifié.'), 'edited comments are updated even if message IDs are unchanged');
    await page.reload(); await ready();
    check(await page.locator('#rmain').isVisible(), 'refresh preserves a message deep link');
    await page.locator('#back').click(); await page.waitForSelector('#home:visible');
    check(await page.locator('#home').isVisible(), 'a directly loaded message has a safe inbox fallback');

    const direct = await context.newPage();
    await direct.goto(`${url}#/m/999`); await direct.waitForSelector('#rmain:visible');
    check(await direct.locator('#message-title').innerText() === 'archive', 'old deep links resolve independently of the latest twelve');
    await direct.goto(`${url}#/m/998`); await direct.waitForSelector('#rstate button');
    check((await direct.locator('#rstate').innerText()).includes('Mesaj açılamadı'), 'comments belonging to another issue are rejected');
    await direct.goto(`${url}#/m/997`); await direct.waitForSelector('#rstate button');
    check(await direct.locator('#rstate .text-link').getAttribute('href') === 'https://github.com/ArdaYILDIZ-DEV/agent-inbox/issues/1#issuecomment-997', 'missing messages have a source fallback and retry');
    await direct.close();

    mode = 'offline'; await page.reload(); await ready();
    check(await page.locator('.row').count() > 0 && (await page.locator('#notice').innerText()).includes('Kaydedilmiş'), 'network failure retains cached content and labels it stale');
    mode = 'normal'; await page.locator('#retry').click(); await ready();
    check(!await page.locator('#notice').isVisible(), 'retry recovers from a network error');
    check(await page.evaluate(() => document.activeElement.id) === 'refresh', 'successful retry restores keyboard focus to a visible control');
    await page.evaluate(() => { localStorage.setItem('ai:cache', '{}'); localStorage.setItem('ai:read', '{}'); });
    mode = 'rate-limit'; await page.reload(); await ready();
    check((await page.locator('#notice').innerText()).includes('istek sınırına') && await page.locator('.row').count() === 0, 'malformed cache and rate limiting produce a recoverable empty state');
    mode = 'empty'; await page.locator('#retry').click(); await ready();
    check((await page.locator('#list').innerText()).includes('Henüz mesaj yok'), 'an empty inbox differs from an API error');

    mode = 'paginated'; calls = []; await page.locator('#refresh').click(); await ready();
    const firstPagedId = await page.locator('.row').first().getAttribute('data-id');
    check(firstPagedId === '1202' && calls.length === 3, `multi-page history fetches last and previous pages correctly (first=${firstPagedId}, requests=${JSON.stringify(calls)})`);
    for (let i = 0; i < 8; i++) await more();
    check(await page.locator('.row').count() === 102, 'all already-fetched comments can be revealed');
    mode = 'offline'; await more();
    check(await page.locator('.row').count() === 102 && await page.evaluate(() => document.activeElement.id) === 'load-more', 'failed history loading preserves messages and button focus');
    mode = 'paginated'; await more();
    check(calls.some(u => u.endsWith('&page=1')) && await page.locator('.row').count() === 120, 'older history is fetched only when requested');

    // Denied browser storage must not be a prerequisite for reading.
    const denied = await browser.newContext({ viewport: { width: 320, height: 720 } });
    await denied.route('https://api.github.com/**', route => route.fulfill({ json: fixtures }));
    await denied.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } }));
    const noStore = await denied.newPage(); noStore.on('pageerror', error => errors.push(error.message));
    await noStore.goto(url); await noStore.waitForSelector('.row'); await noStore.locator('.row').first().click();
    await noStore.waitForSelector('#rmain:visible');
    check(await noStore.locator('#rmain').isVisible(), 'reading works when localStorage is unavailable');
    await denied.close();
    if (process.env.AXE_SOURCE) {
      await page.goto(url); await ready();
      for (const reader of [false, true]) {
        if (reader) { await page.locator('.row').first().click(); await page.waitForSelector('#rmain:visible'); }
        await page.addScriptTag({ path: process.env.AXE_SOURCE });
        const result = await page.evaluate(async () => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } }));
        check(!result.violations.length, `axe WCAG checks (${reader ? 'reader' : 'inbox'}): ${result.violations.map(v => v.id).join(', ') || 'no violations'}`);
      }
    }
    check(errors.length === 0, `no browser JavaScript errors: ${errors.join('; ')}`);
    console.log(`\n${checks} browser checks passed.`);
  } finally { await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
