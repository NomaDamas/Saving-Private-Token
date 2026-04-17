import { readState, listSessions } from '../state.mjs';

// Called from tmux status-right with the current pane_id: `spt status '#{pane_id}'`.
// Finds the state entry matching that pane and prints a compact countdown.
// Must be fast and never throw.
export async function statusCommand(argv) {
  try {
    const arg = argv[0];
    const state = arg ? findByPaneOrSid(arg) : null;
    if (!state || !state.scheduled_at_epoch) {
      process.stdout.write('');
      return;
    }
    if (state.status === 'firing') {
      process.stdout.write('SPT firing');
      return;
    }
    if (state.status === 'cancelled' || state.status === 'idle') {
      process.stdout.write('');
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    const remaining = Math.max(0, state.scheduled_at_epoch - now);
    const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
    const ss = String(remaining % 60).padStart(2, '0');
    process.stdout.write(`SPT ${mm}:${ss}`);
  } catch {
    process.stdout.write('');
  }
}

function findByPaneOrSid(key) {
  // If key looks like a tmux pane_id ("%NN"), search by pane; else treat as session_id.
  if (/^%\d+$/.test(key)) {
    for (const sid of listSessions()) {
      const s = readState(sid);
      if (s && s.tmux_pane === key) return s;
    }
    return null;
  }
  return readState(key);
}
