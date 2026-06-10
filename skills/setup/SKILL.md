---
description: Set up claudino — configure the status-line token muncher so the orange Claude creature animates while Claude thinks. Use when the user asks to enable, set up, install, or configure claudino.
disable-model-invocation: true
---

# Set up claudino

Configure the claudino status line for this user. A plugin cannot set the main
`statusLine` itself, so run the bundled installer, which writes that one block
into `~/.claude/settings.json` (backing up the existing file first).

Run exactly this command:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/tm-install.js" link "${CLAUDE_PLUGIN_ROOT}"
```

If `$CLAUDE_PLUGIN_ROOT` is not set in the environment, determine this plugin's
root directory (the folder containing `bin/` and `lib/`) and pass that absolute
path instead.

After it succeeds, tell the user:
- The status line updates after their next message; the creature munches their
  real tokens (shown as coins) while Claude is thinking.
- Hooks that detect thinking/idle are provided by the plugin automatically.
- They can launch the full keyboard game any time with `/claudino:play`.
- To remove it later: `node "${CLAUDE_PLUGIN_ROOT}/bin/tm-install.js" uninstall`.
