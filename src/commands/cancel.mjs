import { readState, updateState } from '../state.mjs';

export async function cancelCommand(argv) {
  const sid = argv[0];
  if (!sid) throw new Error('spt cancel: session_id required');

  const cur = readState(sid);
  if (!cur) return;

  // Kill the scheduler worker (sleep+ping) if alive
  if (cur.scheduler_pid) {
    try {
      process.kill(cur.scheduler_pid, 'SIGTERM');
    } catch {}
  }

  // Bump generation so any surviving worker becomes stale on re-check
  await updateState(sid, {
    generation: (cur.generation || 0) + 1,
    status: 'cancelled',
    scheduler_pid: null,
    last_user_input_epoch: Math.floor(Date.now() / 1000),
  });
}
