import { existsSync, lstatSync, readlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { listSessions, readState, removeState } from '../state.mjs';
import { tmuxAvailable, tmuxVersion, paneExists } from '../tmux.mjs';
import { pluginSourceDir, pluginTargetRoot } from './install-plugin.mjs';

function which(cmd) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' });
  if (r.status === 0) return r.stdout.trim().split('\n')[0];
  return null;
}

function check(label, ok, detail) {
  const mark = ok ? 'OK  ' : 'FAIL';
  process.stdout.write(`[${mark}] ${label}${detail ? ` — ${detail}` : ''}\n`);
  return ok;
}

function info(label, detail) {
  process.stdout.write(`[INFO] ${label}${detail ? ` — ${detail}` : ''}\n`);
}

function sweepStaleSessions() {
  let removed = 0;
  for (const sid of listSessions()) {
    const s = readState(sid);
    if (!s) continue;
    const pidAlive = s.scheduler_pid ? pidIsAlive(s.scheduler_pid) : true;
    const paneOk = s.tmux_pane ? paneExists(s.tmux_pane) : true;
    if (!pidAlive && !paneOk) {
      removeState(sid);
      removed++;
    }
  }
  return removed;
}

function pidIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function doctorCommand(argv) {
  if (argv.includes('--sweep')) {
    const n = sweepStaleSessions();
    if (process.env.SPT_DEBUG) process.stdout.write(`swept ${n} stale sessions\n`);
    return;
  }

  let pass = true;

  pass = check('tmux installed', tmuxAvailable(), tmuxVersion() || 'not found') && pass;

  const claudeBin = which('claude');
  pass = check('claude binary', !!claudeBin, claudeBin || 'not found in PATH') && pass;

  const src = pluginSourceDir();
  pass = check('plugin source exists', existsSync(src), src) && pass;

  const root = pluginTargetRoot();
  const linked = existsSync(root);
  let detail = root;
  if (linked) {
    try {
      const entries = spawnSync('ls', [root], { encoding: 'utf8' });
      if (entries.status === 0) detail += ` (versions: ${entries.stdout.trim().replace(/\n/g, ', ')})`;
    } catch {}
  }
  pass = check('plugin installed', linked, detail) && pass;

  // Check at least one version dir is a symlink pointing to our plugin source
  if (linked) {
    try {
      const entries = spawnSync('ls', [root], { encoding: 'utf8' }).stdout.trim().split('\n').filter(Boolean);
      let anyLinked = false;
      for (const v of entries) {
        const path = `${root}/${v}`;
        const st = lstatSync(path);
        if (st.isSymbolicLink()) {
          anyLinked = true;
          if (process.env.SPT_DEBUG) process.stdout.write(`       ${v} -> ${readlinkSync(path)}\n`);
        }
      }
      check('plugin symlink sane', anyLinked, anyLinked ? 'yes' : 'no symlinks found');
    } catch {}
  }

  info('inside tmux', process.env.TMUX ? 'yes' : 'no (expected outside an spt session)');
  info('SPT_ENABLED', process.env.SPT_ENABLED === '1' ? 'yes' : 'unset (expected outside an spt session)');

  const sessions = listSessions();
  process.stdout.write(`\n${sessions.length} tracked session(s)\n`);
  for (const sid of sessions) {
    const s = readState(sid) || {};
    process.stdout.write(`  ${sid.slice(0, 8)}…  status=${s.status || '?'}  pane=${s.tmux_pane || '-'}  gen=${s.generation || 0}\n`);
  }

  if (!pass) process.exit(1);
}
