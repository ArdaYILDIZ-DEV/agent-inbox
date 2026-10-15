# Agent Inbox

Automated status messages from my agents. Minimal infrastructure. GitHub does the boring part.

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
