import { execFileSync, spawnSync } from 'node:child_process';

export function tmuxAvailable() {
  const r = spawnSync('tmux', ['-V'], { stdio: 'ignore' });
  return r.status === 0;
}

export function tmuxVersion() {
  try {
    return execFileSync('tmux', ['-V'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

export function inTmux() {
  return Boolean(process.env.TMUX);
}

export function currentPane() {
  return process.env.TMUX_PANE || null;
}

export function paneExists(pane) {
  if (!pane) return false;
  const r = spawnSync('tmux', ['display-message', '-p', '-t', pane, '#{pane_id}'], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return r.status === 0;
}

export function sessionOfPane(pane) {
  try {
    return execFileSync('tmux', ['display-message', '-p', '-t', pane, '#{session_name}'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return null;
  }
}

export function sendKeys(pane, text) {
  // Use literal `-l` then explicit Enter so control chars aren't interpreted
  execFileSync('tmux', ['send-keys', '-t', pane, '-l', text]);
  execFileSync('tmux', ['send-keys', '-t', pane, 'Enter']);
}

export function setSessionOption(session, name, value) {
  execFileSync('tmux', ['set-option', '-t', session, name, value]);
}

export function getSessionOption(session, name) {
  try {
    return execFileSync('tmux', ['show-option', '-v', '-t', session, name], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return '';
  }
}
