#!/usr/bin/env node
// Best-effort plugin registration after `npm install -g`. Never fail the install.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgRoot = resolve(__dirname, '..');

function warn(msg) {
  process.stderr.write(`[savingprivatetoken postinstall] ${msg}\n`);
}

const isGlobal = process.env.npm_config_global === 'true';
if (!isGlobal) {
  warn('local install detected — skipping plugin registration (run `spt install-plugin` manually if desired)');
  process.exit(0);
}

if (!existsSync(pkgRoot)) {
  warn(`package root missing at ${pkgRoot}; skipping`);
  process.exit(0);
}

const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['claude'], {
  encoding: 'utf8',
});
if (which.status !== 0) {
  warn('`claude` CLI not on PATH — skipping plugin registration.');
  warn('Install Claude Code and run `spt install-plugin` to activate the cache keepalive hooks.');
  process.exit(0);
}

function runClaude(args) {
  return spawnSync('claude', args, { encoding: 'utf8' });
}

const MARKETPLACE = 'savingprivatetoken';
const PLUGIN_REF = 'savingprivatetoken@savingprivatetoken';

try {
  const mList = runClaude(['plugin', 'marketplace', 'list']);
  const marketplaceRegistered =
    mList.status === 0 &&
    new RegExp(`^\\s*❯?\\s*${MARKETPLACE}\\b`, 'm').test(`${mList.stdout}\n${mList.stderr}`);

  if (!marketplaceRegistered) {
    const add = runClaude(['plugin', 'marketplace', 'add', pkgRoot, '--scope', 'user']);
    if (add.status !== 0) {
      warn(`claude plugin marketplace add failed: ${add.stderr || add.stdout}`);
      warn('Run `spt install-plugin` manually once Claude Code is healthy.');
      process.exit(0);
    }
  }

  const pList = runClaude(['plugin', 'list']);
  const pluginInstalled =
    pList.status === 0 &&
    new RegExp(`\\b${PLUGIN_REF}\\b`).test(`${pList.stdout}\n${pList.stderr}`);

  if (!pluginInstalled) {
    const inst = runClaude(['plugin', 'install', PLUGIN_REF, '--scope', 'user']);
    if (inst.status !== 0) {
      warn(`claude plugin install failed: ${inst.stderr || inst.stdout}`);
      warn('Run `spt install-plugin` manually.');
      process.exit(0);
    }
  }

  process.stdout.write('[savingprivatetoken] plugin registered. Restart Claude Code to load hooks.\n');
} catch (err) {
  warn(`registration failed (non-fatal): ${err?.message || err}`);
  warn('Run `spt install-plugin` after installation if you want the plugin active.');
  process.exit(0);
}
