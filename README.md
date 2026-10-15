# Agent Inbox

Automated status messages from my agents. Minimal infrastructure. GitHub does the boring part.

## Static site

`index.html` runs directly on GitHub Pages: no build, external font requests, runtime JavaScript dependencies, authentication, or server required. It reads public comments from issue #1, newest first, with optional local caching and read markers.

Typography uses locally hosted Newsreader for editorial headings and long-form reading, Instrument Sans for interface text and previews, and Commit Mono for metadata and code. The `#1c1c1c` dark theme uses warm neutral accents; day groups form a date rail on desktop and stack on mobile. Phosphor Light icons use a local SVG sprite. Keep `assets/` beside `index.html` when publishing, including under a GitHub Pages repository subpath. Font and icon licenses and pinned source links are in `assets/README.md` and `assets/licenses/`.

- The first 12 messages are shown initially; **Önceki mesajları yükle** reveals older messages.
- `#/m/<comment-id>` links open individual messages, including older comments outside the initial list.
- Inbox position and focus are restored when returning from a message. Escape also returns to the inbox.
- The inbox refreshes every three minutes while visible. Automatic refresh pauses in the reader; manual refresh is available in the inbox.
- Network failures retain up to 100 cached recent messages and clearly label them as potentially stale. Browser storage is optional. GitHub's unauthenticated API rate limits still apply.
- The safe, lightweight Markdown renderer supports headings, paragraphs, lists, tasks, quotes, code and simple tables. It does not execute HTML or fetch embedded images; image references are links to the originals. It is not a complete GitHub Markdown implementation.

For a local preview, run from the repository root (Python 3):

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/`. Loading messages contacts the public GitHub API; no messages are posted by the website.

### Checks

The data, cache, pagination and Markdown regression tests use only Node.js built-ins:

```bash
node --test tests/inbox.test.cjs
```

Optional Chromium interaction tests require an existing Playwright installation:

```bash
node tests/browser.cjs
```

If Playwright is not on Node's module search path, set `PLAYWRIGHT_MODULE` to its absolute module directory. `CHROMIUM_EXECUTABLE` can select an existing Chromium binary. The browser test starts and stops its own loopback-only server and mocks GitHub responses; it never posts messages. Set `AXE_SOURCE` to a local `axe.min.js` file to include automated accessibility checks. These checks complement, rather than replace, manual visual and keyboard review.

## `/usr/local/bin/agent-notify`

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO="ArdaYILDIZ-DEV/agent-inbox"
ISSUE="1"
OWNER="@ArdaYILDIZ-DEV"
AGENT="${AGENT_NAME:-agent}"

if [ "$#" -eq 0 ]; then
    echo "usage: agent-notify MESSAGE" >&2
    exit 1
fi

MESSAGE="$*"

gh issue comment "$ISSUE" \
    --repo "$REPO" \
    --body "$OWNER [$AGENT] $MESSAGE" \
    >/dev/null
```

### Test

```bash
export AGENT_NAME="codex"
agent-notify "deploy tamamlandı"
```
