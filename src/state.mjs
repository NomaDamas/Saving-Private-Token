import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function configDir() {
  return process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
}

export function dataDir() {
  return join(configDir(), 'plugins', 'data', 'savingprivatetoken');
}

export function sessionsDir() {
  return join(dataDir(), 'sessions');
}

function ensureDirs() {
  mkdirSync(sessionsDir(), { recursive: true });
}

function statePath(sid) {
  return join(sessionsDir(), `${encodeURIComponent(sid)}.json`);
}

function lockPath(sid) {
  return join(sessionsDir(), `${encodeURIComponent(sid)}.lock`);
}

// mkdir-based atomic mutex. Returns true on acquire.
function tryAcquire(sid) {
  try {
    mkdirSync(lockPath(sid));
    return true;
  } catch {
    return false;
  }
}

function release(sid) {
  try {
    rmSync(lockPath(sid), { recursive: true, force: true });
  } catch {}
}

async function withLock(sid, fn, { tries = 50, delayMs = 20 } = {}) {
  ensureDirs();
  for (let i = 0; i < tries; i++) {
    if (tryAcquire(sid)) {
      try {
        return await fn();
      } finally {
        release(sid);
      }
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`state lock timeout for ${sid}`);
}

export function readState(sid) {
  try {
    return JSON.parse(readFileSync(statePath(sid), 'utf8'));
  } catch {
    return null;
  }
}

function writeStateSync(sid, state) {
  ensureDirs();
  const tmp = `${statePath(sid)}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, statePath(sid));
}

export async function updateState(sid, patch) {
  return withLock(sid, () => {
    const prev = readState(sid) || { session_id: sid, generation: 0, status: 'idle' };
    const next = { ...prev, ...patch };
    writeStateSync(sid, next);
    return next;
  });
}

// Bumps generation counter and returns the new value.
export async function bumpGeneration(sid) {
  return withLock(sid, () => {
    const prev = readState(sid) || { session_id: sid, generation: 0, status: 'idle' };
    const next = { ...prev, generation: (prev.generation || 0) + 1 };
    writeStateSync(sid, next);
    return next.generation;
  });
}

export function listSessions() {
  try {
    return readdirSync(sessionsDir())
      .filter((f) => f.endsWith('.json'))
      .map((f) => decodeURIComponent(f.slice(0, -5)));
  } catch {
    return [];
  }
}

export function removeState(sid) {
  try {
    rmSync(statePath(sid), { force: true });
  } catch {}
}
