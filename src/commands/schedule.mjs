import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { updateState, readState } from '../state.mjs';
import { sendKeys, paneExists } from '../tmux.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_PING_SECONDS = 290;
const PING_STRING = '__ping__';

function parseArgs(argv) {
  const out = { sid: null, pane: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--pane') out.pane = argv[++i];
    else if (argv[i] === '--worker') out.worker = true;
    else if (!out.sid) out.sid = argv[i];
  }
  return out;
}

function pingInterval() {
  const env = process.env.SPT_PING_INTERVAL;
  if (env && /^\d+$/.test(env)) return parseInt(env, 10);
  return DEFAULT_PING_SECONDS;
}

// Called by Stop hook. Forks a detached worker (same binary, --worker) and returns.
export async function scheduleCommand(argv) {
  const { sid, pane, worker } = parseArgs(argv);
  if (!sid) throw new Error('spt schedule: session_id required');

  if (worker) return runWorker(sid, pane);

  // Bump generation so any in-flight worker becomes stale.
  const interval = pingInterval();
  const scheduledAt = Math.floor(Date.now() / 1000) + interval;
  const prev = (await updateState(sid, {})) || {};
  const generation = (prev.generation || 0) + 1;
  await updateState(sid, {
    session_id: sid,
    tmux_pane: pane || prev.tmux_pane || null,
    generation,
    status: 'armed',
    scheduled_at_epoch: scheduledAt,
    last_stop_epoch: Math.floor(Date.now() / 1000),
  });

  // Spawn detached worker
  const child = spawn(
    process.execPath,
    [join(__dirname, '..', '..', 'bin', 'spt.js'), 'schedule', sid, '--pane', pane || '', '--worker'],
    { detached: true, stdio: 'ignore', env: { ...process.env, SPT_WORKER_GEN: String(generation) } },
  );
  child.unref();
}

async function runWorker(sid, pane) {
  const interval = pingInterval();
  const myGen = parseInt(process.env.SPT_WORKER_GEN || '0', 10);
  await updateState(sid, { scheduler_pid: process.pid });

  await new Promise((r) => setTimeout(r, interval * 1000));

  const cur = readState(sid);
  if (!cur) return;
  if ((cur.generation || 0) !== myGen) return;
  if (cur.status === 'cancelled') return;
  if (!pane || !paneExists(pane)) {
    await updateState(sid, { status: 'idle', scheduler_pid: null });
    return;
  }

  await updateState(sid, { status: 'firing' });
  try {
    sendKeys(pane, PING_STRING);
  } catch (err) {
    await updateState(sid, {
      status: 'idle',
      scheduler_pid: null,
      last_error: String(err?.message || err),
    });
    return;
  }
  await updateState(sid, { status: 'idle', scheduler_pid: null });
}
