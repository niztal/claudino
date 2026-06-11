#!/usr/bin/env node
'use strict';
// claudino installer / configurator.
//
//   npx github:niztal/claudino install
//                             Copy scripts to ~/.claude/claudino and wire up
//                             the statusLine + hooks in ~/.claude/settings.json.
//   npx github:niztal/claudino uninstall
//                             Remove claudino's settings entries and files.
//   node tm-install.js link <pluginRoot>
//                             Point the statusLine at an already-installed
//                             plugin dir (hooks come from the plugin itself).
//                             Used by the /claudino:setup skill.

const fs = require('fs');
const os = require('os');
const path = require('path');

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, '.claude');
const SETTINGS = path.join(CLAUDE_DIR, 'settings.json');
const DEST = path.join(CLAUDE_DIR, 'claudino');
const PLAY_CMD = path.join(CLAUDE_DIR, 'commands', 'play.md');
const PKG_ROOT = path.join(__dirname, '..');

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  } catch {
    return {};
  }
}

function backupSettings() {
  if (!fs.existsSync(SETTINGS)) return null;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const bak = SETTINGS + '.claudino-bak-' + ts;
  fs.copyFileSync(SETTINGS, bak);
  return bak;
}

function writeSettings(obj) {
  fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS, JSON.stringify(obj, null, 2) + '\n');
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function statusLineBlock(root) {
  return {
    type: 'command',
    command: 'node "' + path.join(root, 'bin', 'statusline.js') + '"',
    refreshInterval: 1,
  };
}

function hookCmd(root, action) {
  return {
    hooks: [
      {
        type: 'command',
        command: 'node "' + path.join(root, 'bin', 'hook-state.js') + '" ' + action,
        async: true,
      },
    ],
  };
}

function addClaudinoHooks(settings, root) {
  const h = settings.hooks || (settings.hooks = {});
  const ensure = (event, action) => {
    h[event] = (h[event] || []).filter(
      (g) => !JSON.stringify(g).includes('hook-state.js')
    );
    h[event].push(hookCmd(root, action));
  };
  ensure('UserPromptSubmit', 'start');
  ensure('Stop', 'stop');
  ensure('SessionEnd', 'end');
}

// Write a standalone /play command so the user can type `/play` (not just the
// namespaced /claudino:play). It's a prompt that tells Claude to run the
// launcher, which opens the game in a separate pane/window.
function writePlayCommand(root) {
  const launcher = path.join(root, 'bin', 'tm-play.sh');
  const body =
    '---\n' +
    'description: Launch the claudino game in a separate terminal pane.\n' +
    '---\n\n' +
    'Open the claudino game in a separate pane/window by running:\n\n' +
    '```bash\n' +
    'bash "' + launcher + '"\n' +
    '```\n\n' +
    'Then tell the user the controls: arrows/WASD move, Space jump, Tab swap game, ' +
    'P pause, R restart, Q quit. If the launcher prints a manual command (no tmux / ' +
    'non-macOS), relay it.\n';
  fs.mkdirSync(path.dirname(PLAY_CMD), { recursive: true });
  fs.writeFileSync(PLAY_CMD, body);
}

function removePlayCommand() {
  try {
    if (fs.existsSync(PLAY_CMD) && fs.readFileSync(PLAY_CMD, 'utf8').includes('claudino')) {
      fs.unlinkSync(PLAY_CMD);
    }
  } catch {}
}

function stripClaudino(settings) {
  if (settings.statusLine && JSON.stringify(settings.statusLine).includes('claudino')) {
    delete settings.statusLine;
  }
  if (settings.hooks) {
    for (const event of Object.keys(settings.hooks)) {
      settings.hooks[event] = settings.hooks[event].filter(
        (g) => !JSON.stringify(g).includes('hook-state.js')
      );
      if (settings.hooks[event].length === 0) delete settings.hooks[event];
    }
    if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
  }
}

function done(bak) {
  console.log('');
  if (bak) console.log('  Backed up your previous settings to:\n    ' + bak);
  console.log('  Restart Claude Code (or run any prompt) to see claudino come alive.');
  console.log('  Tip: run  /claudino:play  for the full keyboard game.\n');
}

function cmdInstall() {
  console.log('Installing claudino…');
  copyDir(path.join(PKG_ROOT, 'bin'), path.join(DEST, 'bin'));
  copyDir(path.join(PKG_ROOT, 'lib'), path.join(DEST, 'lib'));
  const bak = backupSettings();
  const settings = readSettings();
  settings.statusLine = statusLineBlock(DEST);
  addClaudinoHooks(settings, DEST);
  writeSettings(settings);
  writePlayCommand(DEST);
  console.log('  Installed to ' + DEST);
  console.log('  Configured statusLine + hooks in ' + SETTINGS);
  console.log('  Added /play command at ' + PLAY_CMD);
  done(bak);
}

function cmdLink(root) {
  if (!root) {
    console.error('link requires a plugin root path');
    process.exit(1);
  }
  console.log('Linking claudino statusLine to plugin at ' + root + '…');
  const bak = backupSettings();
  const settings = readSettings();
  settings.statusLine = statusLineBlock(root);
  // Hooks are provided by the plugin's hooks/hooks.json — don't add them here.
  writeSettings(settings);
  writePlayCommand(root);
  console.log('  Configured statusLine in ' + SETTINGS);
  console.log('  Added /play command at ' + PLAY_CMD);
  done(bak);
}

function cmdUninstall() {
  console.log('Uninstalling claudino…');
  const bak = backupSettings();
  const settings = readSettings();
  stripClaudino(settings);
  writeSettings(settings);
  removePlayCommand();
  try {
    fs.rmSync(DEST, { recursive: true, force: true });
  } catch {}
  console.log('  Removed claudino settings entries and /play command.');
  if (bak) console.log('  Previous settings backed up to:\n    ' + bak);
  console.log('');
}

const cmd = process.argv[2] || 'install';
if (cmd === 'install') cmdInstall();
else if (cmd === 'link') cmdLink(process.argv[3]);
else if (cmd === 'uninstall' || cmd === 'remove') cmdUninstall();
else {
  console.log('Usage: claudino [install|uninstall]');
  process.exit(1);
}
