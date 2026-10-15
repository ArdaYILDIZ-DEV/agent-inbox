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
const sections = Array.from({ length: 18 }, (_, i) => `## ${i < 2 ? 'Tekrarlanan başlık' : 'Bölüm ' + (i + 1)}\n\n${'Uzun içerikte başlıklarla metin birbirinden ayrılmalı; okuma alanı rahat kalmalı. '.repeat(12)}\n\n`).join('');
const rich = '# Okunabilir bir mesaj\n\nBirinci paragraf. **Önemli bir not** ve `index.html` içeriği.\n\n## [Kontroller](https://example.com)\n\n- [x] Masaüstü\n- [ ] Mobil\n\n> Sade ve okunabilir.\n\n```js\nconst longLine = "' + 'x'.repeat(250) + '";\n```\n\n| Başlık | Sonuç |\n| --- | --- |\n| Mobil | Tamam |\n\n[Kaynak](https://example.com)\n\n<img src=x onerror="window.injected=true">\n\n[Tehlike](javascript:alert(1))\n\n' + sections + '### Alt bölüm\n\nAlt bölüm metni.\n\n#### Ayrıntı\n\nAyrıntı metni.\n\n##### Beşinci düzey\n\nBeşinci düzey metni.\n\n###### Altıncı düzey\n\n' + 'Son bölümde de kaydırma için yeterli metin olmalı. '.repeat(60);
const comment = (id, body = `@ArdaYILDIZ-DEV [codex] # Mesaj ${id}\n\nTamamlanan işler ve sonraki adımlar.`) => ({ id, body, created_at: date, issue_url: issue });
const fixtures = Array.from({ length: 30 }, (_, i) => comment(1001 + i));
fixtures[29] = comment(1030, `@ArdaYILDIZ-DEV [atheris] ${rich}`);
fixtures[0] = { ...fixtures[0], created_at: '2020-09-01T10:00:00Z' };
let checks = 0;
function check(value, message) { assert.ok(value, message); console.log(`PASS ${++checks}: ${message}`); }
async function inspectEntry(locator) {
  return locator.evaluate(node => {
    // Restart the CSS entry synchronously, avoiding timing-dependent sleeps.
    node.style.animationName = 'none'; void node.offsetWidth; node.style.removeProperty('animation-name');
    const animation = node.getAnimations().find(a => a.animationName === getComputedStyle(node).animationName);
    if (!animation) return null;
    const timing = animation.effect.getTiming(), frames = animation.effect.getKeyframes();
    animation.pause(); animation.currentTime = timing.duration / 2;
    const style = getComputedStyle(node);
    const result = { name: animation.animationName, duration: timing.duration, easing: style.animationTimingFunction, frames, filter: style.filter, transform: style.transform, opacity: Number(style.opacity) };
    animation.finish(); return result;
  });
}

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
      if (id === 996) return route.fulfill({ json: comment(996, '[atheris] # İnceleme notları\n\n' + 'Okuma deneyimini gerçek içerikle değerlendiriyoruz. '.repeat(60) + '\n\n## Sonuç\n\nKısa sonuç.') });
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
    check(await page.locator('.day').first().evaluate(n => {
      const title = n.querySelector('h2').getBoundingClientRect(), rows = n.querySelector('.rows').getBoundingClientRect();
      return title.right <= rows.left && title.top >= rows.top && title.height > title.width;
    }), 'date headings stay in a compact rail to the left of the messages');
    check(await page.locator('.day h2').first().evaluate(n => {
      const style = getComputedStyle(n);
      return style.writingMode === 'vertical-rl' && style.textOrientation === 'mixed' && style.position === 'sticky';
    }), 'date text is rotated 90 degrees and follows its message group');
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'inbox-desktop.png') });
    await page.keyboard.press('Tab');
    check(await page.evaluate(() => document.activeElement.classList.contains('skip')), 'keyboard users can skip to the content');
    await page.keyboard.press('Enter');
    check(await page.evaluate(() => document.activeElement.id) === 'main', 'skip link focuses the main landmark');
    await page.locator('#refresh').hover();
    await page.waitForFunction(() => new DOMMatrix(getComputedStyle(document.querySelector('#refresh')).transform).f < -.9);
    check(true, 'surface controls rise by only 1px on hover');
    await page.mouse.down();
    await page.waitForFunction(() => {
      const matrix = new DOMMatrix(getComputedStyle(document.querySelector('#refresh')).transform);
      return matrix.f > .9 && matrix.a < .99;
    });
    check(true, 'press feedback moves the control down and applies a restrained scale');
    await page.mouse.up(); await ready();

    const row = page.locator('.row').nth(7); await row.scrollIntoViewIfNeeded();
    const position = await page.evaluate(() => scrollY), origin = await row.getAttribute('data-id');
    await row.click(); await page.waitForSelector('#rmain:visible');
    check(await page.evaluate(() => document.activeElement.id) === 'rmain', 'opening a message focuses its article');
    await page.locator('#older').click(); await page.waitForURL(`**/#/m/${Number(origin) - 1}`);
    check(await page.locator('.message-head').evaluate(n => n.getAnimations().some(a => a.animationName === 'soft-enter' && a.playState === 'running')), 'adjacent message changes replay the small header entry');
    await page.goBack(); await page.waitForSelector('#home:visible');
    check(Math.abs(await page.evaluate(() => scrollY) - position) <= 2, 'browser Back restores the inbox scroll position after adjacent navigation');
    check(await page.evaluate(() => document.activeElement.dataset.id) === origin, 'return focus belongs to the originating list row');
    check(!await page.locator(`.row[data-id="${origin}"]`).evaluate(n => n.classList.contains('unread')), 'opened messages retain their read state');
    check((await page.locator('#count').innerText()).includes(`${await page.locator('.row.unread').count()} okunmamış`), 'unread counter stays consistent with visible rows on return');
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
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedCode = text; } } }));
    await page.locator('.copy-code').click();
    await page.waitForFunction(() => document.querySelector('.copy-code').textContent === 'Kopyalandı');
    check(await page.evaluate(() => window.copiedCode === document.querySelector('#body pre code').textContent), 'copy action transfers only the exact code text, not the toolbar or language label');
    check(await page.locator('.copy-code').evaluate(n => n === document.activeElement), 'copy feedback preserves focus on the action instead of disabling and blurring it');
    await page.evaluate(() => { navigator.clipboard.writeText = () => new Promise(resolve => { window.copyCalls = (window.copyCalls || 0) + 1; window.resolveCopy = resolve; }); });
    await page.locator('.copy-code').click(); await page.locator('.copy-code').click();
    check(await page.evaluate(() => window.copyCalls === 1) && await page.locator('.copy-code').getAttribute('aria-busy') === 'true', 'repeated clicks cannot start duplicate in-flight clipboard operations');
    await page.evaluate(() => window.resolveCopy());
    await page.waitForFunction(() => !document.querySelector('.copy-code').hasAttribute('aria-busy'));
    await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new DOMException('Denied', 'NotAllowedError'); }; });
    await page.locator('.copy-code').click();
    await page.waitForFunction(() => document.querySelector('.code-status').textContent.includes('Kopyalanamadı'));
    check(!await page.locator('.copy-code').isDisabled() && await page.locator('#body pre').isVisible(), 'clipboard denial leaves selectable code and a recoverable copy action');
    await page.evaluate(() => { navigator.clipboard.writeText = async text => { window.copiedCode = text; }; });
    await page.locator('.copy-code').click();
    await page.waitForFunction(() => document.querySelector('.copy-code').textContent === 'Kopyalandı');
    check(await page.locator('.toc-item').count() === await page.locator('#body :is(h2,h3,h4,h5,h6)').count(), 'TOC includes every rendered heading, not code or raw HTML');
    check(await page.locator('#body [id]').evaluateAll(nodes => new Set(nodes.map(n => n.id)).size === nodes.length), 'repeated headings have unique targets');
    check(await page.locator('.toc-item').nth(1).innerText() === 'Kontroller', 'TOC labels exclude Markdown syntax and auxiliary link announcements');
    check((await page.locator('#rmain').boundingBox()).width === 720 && (await page.locator('#toc').boundingBox()).x < (await page.locator('#rmain').boundingBox()).x, 'desktop TOC uses the gutter without shrinking the article');
    check(await page.locator('#body h3').first().evaluate(n => {
      const h = getComputedStyle(n), p = getComputedStyle(document.querySelector('#body p'));
      return h.fontFamily.includes('Instrument Sans') && h.fontWeight === '600' && parseFloat(h.fontSize) > parseFloat(p.fontSize) && parseFloat(h.marginTop) > parseFloat(p.marginBottom);
    }), 'section headings have a stronger typographic hierarchy than prose');
    await page.keyboard.press('Tab');
    await page.evaluate(() => document.querySelector('#rmain').focus({ preventScroll: true }));
    check(await page.locator('#rmain').evaluate(n => n === document.activeElement && getComputedStyle(n).outlineStyle === 'none'), 'article focus never draws a wrapper outline, including keyboard modality');
    const routeHash = await page.evaluate(() => location.hash), historyLength = await page.evaluate(() => history.length);
    const target = page.locator('.toc-item').nth(12), targetId = await target.getAttribute('aria-controls');
    await target.focus();
    check(await target.evaluate(n => n.matches(':focus-visible') && getComputedStyle(n).outlineStyle === 'solid'), 'interactive navigation retains its keyboard focus ring');
    await page.keyboard.press('Enter');
    await page.waitForFunction(id => document.querySelector('.toc-item[aria-current]')?.getAttribute('aria-controls') === id && Math.abs(document.getElementById(id).getBoundingClientRect().top - parseFloat(getComputedStyle(document.getElementById(id)).scrollMarginTop)) < 2, targetId);
    check(await page.evaluate(id => document.activeElement.id === id && document.getElementById(id).getBoundingClientRect().top > document.querySelector('.reader-bar').getBoundingClientRect().bottom, targetId), 'keyboard TOC activation focuses an unobscured heading and updates the current section');
    check(await page.evaluate(() => location.hash) === routeHash && await page.evaluate(() => history.length) === historyLength, 'section navigation preserves the message route and Back history');
    if (process.env.SCREENSHOT_DIR) {
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'reader-desktop.png') });
    }
    for (const width of [320, 360, 390, 540, 541, 768, 1024, 1279, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 844 });
      check(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), `reader reflows without page overflow at ${width}px`);
      check((await page.locator('#rmain').boundingBox()).width === Math.min(720, width - (width <= 540 ? 40 : width <= 760 ? 48 : 80)), `reading width is preserved at ${width}px`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => scrollTo(0, 0));
    check(!await page.locator('#toc-links').isVisible() && await page.locator('#toc-toggle').getAttribute('aria-expanded') === 'false', 'mobile TOC starts collapsed');
    await page.locator('#toc-toggle').click();
    check(await page.locator('#toc-links').isVisible() && await page.locator('.toc-item').first().evaluate(n => n.getBoundingClientRect().height >= 44), 'mobile contents provide touch-sized targets');
    const initialEntry = await inspectEntry(page.locator('#toc-links'));
    check(initialEntry?.name === 'soft-enter' && initialEntry.duration === 180, 'contents consistently use the single soft-enter animation');
    await page.keyboard.press('Escape');
    check(await page.locator('#read').isVisible() && !await page.locator('#toc-links').isVisible() && await page.evaluate(() => document.activeElement.id) === 'toc-toggle', 'Escape closes mobile contents first and restores toggle focus');
    await page.locator('#toc-toggle').click();
    const mobileTarget = page.locator('.toc-item').nth(5), mobileId = await mobileTarget.getAttribute('aria-controls');
    await mobileTarget.click();
    await page.waitForFunction(id => document.querySelector('.toc-item[aria-current]')?.getAttribute('aria-controls') === id && Math.abs(document.getElementById(id).getBoundingClientRect().top - parseFloat(getComputedStyle(document.getElementById(id)).scrollMarginTop)) < 2, mobileId);
    check(!await page.locator('#toc-links').isVisible() && await page.evaluate(id => document.getElementById(id).getBoundingClientRect().top >= document.querySelector('#toc-toggle').getBoundingClientRect().bottom, mobileId), 'mobile navigation closes the list and reveals the destination below sticky bars');
    await page.evaluate(() => document.querySelectorAll('#body h3')[9].scrollIntoView());
    await page.waitForFunction(() => document.querySelector('.toc-item[aria-current]')?.textContent === 'Bölüm 9');
    check(await page.locator('.toc-item[aria-current]').count() === 1, 'manual scrolling tracks exactly one current section');
    check(await page.locator('.message-head').evaluate(n => n.getAnimations().every(a => a.playState === 'finished')), 'reading and scrollspy do not replay header entry effects');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('#toc-toggle').click();
    const dropdownEntry = await inspectEntry(page.locator('#toc-links'));
    check(dropdownEntry?.name === 'soft-enter' && dropdownEntry.duration === 180 && dropdownEntry.easing === 'cubic-bezier(0.165, 0.84, 0.44, 1)' && dropdownEntry.frames[0].filter === 'blur(4px)' && dropdownEntry.frames[0].transform === 'translateY(6px)', 'contents use the preferred 180ms soft-out blur-and-slide entry');
    check(dropdownEntry.opacity > 0 && dropdownEntry.opacity < 1 && dropdownEntry.filter !== 'none' && dropdownEntry.transform !== 'none', 'the dropdown entry renders intermediate opacity, blur and translation');
    const headerEntry = await inspectEntry(page.locator('.message-head'));
    check(headerEntry?.duration === 240 && headerEntry.easing === 'cubic-bezier(0.22, 1, 0.36, 1)', 'message headers use a restrained 240ms weighted entry');
    check(await page.locator('.reader-bar').evaluate(n => getComputedStyle(n).animationName === 'none') && await page.locator('#rmain').evaluate(n => getComputedStyle(n).animationName === 'none'), 'sticky navigation and the long article are not animated as large surfaces');
    check(await page.locator('#toc-toggle svg').evaluate(n => {
      const style = getComputedStyle(n);
      return style.transitionProperty.includes('transform') && style.transitionDuration.includes('0.18s') && style.transitionTimingFunction.includes('cubic-bezier(0.165, 0.84, 0.44, 1)');
    }), 'the contents chevron rotates with the preferred short easing');
    const smoothTarget = page.locator('.toc-item').nth(3), smoothId = await smoothTarget.getAttribute('aria-controls');
    await smoothTarget.click();
    await page.waitForFunction(id => Math.abs(document.getElementById(id).getBoundingClientRect().top - parseFloat(getComputedStyle(document.getElementById(id)).scrollMarginTop)) < 2, smoothId);
    check(await page.evaluate(() => location.hash) === routeHash, 'smooth scrolling reaches the section without changing the route');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    check(await page.locator('#toc-toggle svg').evaluate(n => getComputedStyle(n).transitionDuration.includes('0.18s')), 'chevron timing stays consistent across system preferences');
    if (process.env.SCREENSHOT_DIR) {
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'reader-mobile.png') });
      await page.locator('#toc-toggle').click();
      await page.locator('#toc-links').evaluate(n => Promise.all(n.getAnimations().map(a => a.finished)));
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'contents-mobile.png') });
      await page.keyboard.press('Escape');
    }
    await page.setViewportSize({ width: 1440, height: 844 });
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
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'inbox-mobile.png') });
    for (const width of [320, 360, 390, 540, 541, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      check(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), `inbox reflows without overflow at ${width}px`);
      if (width <= 390) check(await page.locator('.day').first().evaluate(n => getComputedStyle(n.querySelector('h2')).writingMode === 'vertical-rl' && getComputedStyle(n).gridTemplateColumns.startsWith('40px')), `mobile dates use a compact 40px rotated rail at ${width}px`);
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
    await direct.goto(`${url}#/m/996`); await direct.waitForSelector('.toc-item');
    const finalSection = direct.locator('.toc-item').last(), finalId = await finalSection.getAttribute('aria-controls');
    await finalSection.click();
    await direct.waitForFunction(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 2);
    check(await direct.locator('.toc-item[aria-current]').getAttribute('aria-controls') === finalId, 'a short last section is current when scrolling reaches the document end');
    await finalSection.focus();
    for (let attempt = 1; attempt <= 3; attempt++) {
      await direct.setViewportSize({ width: 390, height: 844 });
      await direct.waitForFunction(() => document.activeElement.id === 'toc-toggle');
      check(await direct.evaluate(() => document.activeElement.id) === 'toc-toggle', `narrowing preserves visible TOC focus (cycle ${attempt})`);
      await direct.setViewportSize({ width: 1440, height: 900 });
      await direct.waitForFunction(() => document.activeElement.classList.contains('toc-item'));
      check(await direct.evaluate(() => document.activeElement.classList.contains('toc-item')), `widening preserves sidebar focus (cycle ${attempt})`);
    }
    await direct.locator('#back').focus();
    await direct.setViewportSize({ width: 390, height: 844 });
    await direct.waitForFunction(() => document.querySelector('#toc-links').inert);
    check(await direct.evaluate(() => document.activeElement.id) === 'back', 'responsive focus repair never steals focus from unrelated navigation');
    await direct.setViewportSize({ width: 390, height: 400 });
    await direct.locator('#toc-toggle').click();
    await direct.locator('.toc-item').first().focus();
    await direct.keyboard.press('Shift+Tab'); await direct.keyboard.press('Shift+Tab');
    check(await direct.locator('#toc-toggle').getAttribute('aria-expanded') === 'false', 'tabbing out dismisses the compact contents panel');
    check(await direct.locator('#toc-links').evaluate(n => n.inert), 'closed compact contents cannot receive keyboard focus');
    await direct.setViewportSize({ width: 1440, height: 900 });
    await direct.goto(`${url}#/m/999`); await direct.waitForSelector('#rmain:visible');
    check(await direct.locator('#message-title').innerText() === 'archive', 'old deep links resolve independently of the latest twelve');
    check(!await direct.locator('#toc').isVisible() && await direct.locator('.toc-item').count() === 0, 'heading-free messages do not show an empty contents area');
    await direct.goto(`${url}#/m/1030`); await direct.waitForSelector('.toc-item');
    await direct.goto(`${url}#/m/998`); await direct.waitForSelector('#rstate button');
    check((await direct.locator('#rstate').innerText()).includes('Mesaj açılamadı'), 'comments belonging to another issue are rejected');
    check(!await direct.locator('#toc').isVisible(), 'unavailable messages do not retain stale contents');
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

    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: 'light', reducedMotion: 'reduce' });
    await touch.route('https://api.github.com/**', route => route.fulfill({ json: fixtures }));
    const phone = await touch.newPage(); phone.on('pageerror', error => errors.push(error.message));
    await phone.goto(`${url}#/m/1030`); await phone.waitForSelector('#toc-toggle:visible');
    check(await phone.locator('#rmain').evaluate(n => n === document.activeElement && getComputedStyle(n).outlineStyle === 'none'), 'fresh touch-device deep links do not acquire a gold article frame');
    for (const width of [320, 390, 430]) {
      await phone.setViewportSize({ width, height: 844 });
      await phone.locator('#toc-toggle').tap();
      check(await phone.locator('#toc-toggle').getAttribute('aria-expanded') === 'true' && await phone.evaluate(() => document.documentElement.scrollWidth === innerWidth), `touch contents open without overflow at ${width}px`);
      const section = phone.locator('.toc-item').nth(8), id = await section.getAttribute('aria-controls');
      await section.tap();
      await phone.waitForFunction(id => document.activeElement.id === id && Math.abs(document.getElementById(id).getBoundingClientRect().top - parseFloat(getComputedStyle(document.getElementById(id)).scrollMarginTop)) < 2, id);
      check(await phone.locator('#toc-toggle').getAttribute('aria-expanded') === 'false' && await phone.evaluate(() => location.hash === '#/m/1030'), `touch section navigation closes contents and preserves the route at ${width}px`);
    }
    await phone.setViewportSize({ width: 390, height: 400 });
    await phone.locator('#toc-toggle').tap();
    check(await phone.locator('#toc-links').evaluate(n => n.getBoundingClientRect().bottom <= innerHeight && n.scrollHeight > n.clientHeight), 'contents remain bounded and scrollable in a short mobile viewport');
    await touch.close();
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
