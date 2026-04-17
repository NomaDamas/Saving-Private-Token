import { readState } from '../state.mjs';
import { sendKeys, paneExists } from '../tmux.mjs';

const PING_STRING = '__ping__';

// Manual ping for diagnostics.
export async function pingCommand(argv) {
  const sid = argv[0];
  if (!sid) throw new Error('spt ping: session_id required');
  const s = readState(sid);
  if (!s) throw new Error(`spt ping: no state for session ${sid}`);
  if (!s.tmux_pane) throw new Error('spt ping: no tmux_pane in state');
  if (!paneExists(s.tmux_pane)) throw new Error(`spt ping: pane ${s.tmux_pane} does not exist`);
  sendKeys(s.tmux_pane, PING_STRING);
  process.stdout.write(`ping sent to ${s.tmux_pane}\n`);
}
