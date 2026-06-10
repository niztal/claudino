---
description: Remove claudino — strip the claudino status line and hooks from settings. Use when the user asks to uninstall, disable, or remove claudino.
disable-model-invocation: true
---

# Uninstall claudino

Remove claudino's `statusLine` and hook entries from `~/.claude/settings.json`
(a backup is written first) and delete the copied files.

Run exactly this command:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/tm-install.js" uninstall
```

Then tell the user the status line is removed (effective on their next message),
that their previous settings were backed up, and that they can also fully remove
the plugin with `/plugin uninstall claudino` if they no longer want the
`/claudino:play` command.
