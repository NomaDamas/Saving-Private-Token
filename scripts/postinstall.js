#!/usr/bin/env node
// Best-effort plugin symlink after `npm install -g`. Never fail the install.
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgRoot = resolve(__dirname, '..');

function warn(msg) {
  process.stderr.write(`[savingprivatetoken postinstall] ${msg}\n`);
}

// Skip for local (non-global) installs. npm sets npm_config_global=true for -g.
const isGlobal = process.env.npm_config_global === 'true';
if (!isGlobal) {
  warn('local install detected — skipping plugin symlink (run `spt install-plugin` manually if desired)');
  process.exit(0);
}

try {
  const pkgJson = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'));
  const version = pkgJson.version || '0.0.0';
  const base = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
  const targetDir = join(base, 'plugins', 'cache', 'savingprivatetoken-local', 'savingprivatetoken');
  const target = join(targetDir, version);
  const src = join(pkgRoot, 'plugin');

  if (!existsSync(src)) {
    warn(`plugin source missing at ${src}; skipping`);
    process.exit(0);
  }
  mkdirSync(dirname(target), { recursive: true });

  let st = null;
  try {
    st = lstatSync(target);
  } catch {}
  if (st && st.isSymbolicLink()) {
    try {
      const cur = readlinkSync(target);
      const resolved = resolve(dirname(target), cur);
      if (resolved === src) {
        process.stdout.write(`[savingprivatetoken] already linked: ${target}\n`);
        process.exit(0);
      }
    } catch {}
  }
  if (st) rmSync(target, { recursive: true, force: true });
  symlinkSync(src, target, 'dir');
  process.stdout.write(`[savingprivatetoken] plugin linked at ${target}\n`);
} catch (err) {
  warn(`symlink failed (non-fatal): ${err?.message || err}`);
  warn('run `spt install-plugin` after installation if you want the plugin active.');
  process.exit(0);
}
