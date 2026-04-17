import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { inTmux, tmuxAvailable, setSessionOption, getSessionOption } from '../tmux.mjs';
import { installPluginCommand } from './install-plugin.mjs';

function which(cmd) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' });
  if (r.status === 0) return r.stdout.trim().split('\n')[0];
  return null;
}

function ensurePluginLinked() {
  installPluginCommand().catch((err) => {
    process.stderr.write(`[spt] plugin install warning: ${err?.message || err}\n`);
  });
}

const STATUS_SNIPPET = "#(spt status '#{pane_id}' 2>/dev/null)";

function setupStatusLine(sessionName) {
  try {
    const prev = getSessionOption(sessionName, 'status-right');
    setSessionOption(sessionName, '@spt-prev-status-right', prev);
    setSessionOption(sessionName, 'status-interval', '5');
    // Wrap before prev so SPT countdown is visible at left of status-right.
    const newVal = prev ? `${STATUS_SNIPPET} ${prev}` : STATUS_SNIPPET;
    setSessionOption(sessionName, 'status-right', newVal);
  } catch (err) {
    process.stderr.write(`[spt] status-line setup skipped: ${err?.message || err}\n`);
  }
}

export async function runCommand(_argv) {
  if (!tmuxAvailable()) {
    process.stderr.write('spt: tmux not found. Install via `brew install tmux` or your package manager.\n');
    process.exit(1);
  }
  const claudeBin = which('claude');
  if (!claudeBin) {
    process.stderr.write('spt: `claude` binary not found in PATH. Install Claude Code first.\n');
    process.exit(1);
  }

  await installPluginCommand().catch((err) => {
    process.stderr.write(`[spt] plugin install warning: ${err?.message || err}\n`);
  });

  const env = { ...process.env, SPT_ENABLED: '1' };

  if (inTmux()) {
    // Already inside tmux — exec claude directly in current pane.
    const sessionR = spawnSync('tmux', ['display-message', '-p', '#{session_name}'], {
      encoding: 'utf8',
    });
    if (sessionR.status === 0) {
      setupStatusLine(sessionR.stdout.trim());
    }
    const r = spawnSync(claudeBin, [], { stdio: 'inherit', env });
    process.exit(r.status ?? 0);
    return;
  }

  // Create a fresh tmux session and launch claude inside it.
  const shortId = randomBytes(3).toString('hex');
  const sessionName = `spt-${shortId}`;

  // Build an env-prefixed command so claude inside the new tmux session sees SPT_ENABLED=1.
  // `tmux new-session` inherits the invoking env, but we pass explicit -e for clarity.
  const args = ['new-session', '-s', sessionName, '-e', 'SPT_ENABLED=1', claudeBin];
  // Setup status-line once the session exists. We'll set it via a post-create option push after attach.
  // Simpler: use `new-session -d` then set options then attach.
  spawnSync('tmux', ['new-session', '-d', '-s', sessionName, '-e', 'SPT_ENABLED=1', claudeBin], {
    stdio: 'inherit',
    env,
  });
  setupStatusLine(sessionName);
  const attach = spawnSync('tmux', ['attach-session', '-t', sessionName], { stdio: 'inherit', env });
  process.exit(attach.status ?? 0);
}
