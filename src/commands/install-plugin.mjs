import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MARKETPLACE_ID = 'savingprivatetoken-local';
const PLUGIN_ID = 'savingprivatetoken';

export function packageRoot() {
  // src/commands/install-plugin.mjs -> ../../
  return resolve(__dirname, '..', '..');
}

export function pluginSourceDir() {
  return join(packageRoot(), 'plugin');
}

export function pluginTargetRoot() {
  const base = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
  return join(base, 'plugins', 'cache', MARKETPLACE_ID, PLUGIN_ID);
}

function pluginTargetVersionedDir(version) {
  return join(pluginTargetRoot(), version);
}

function readPkgVersion() {
  try {
    return JSON.parse(readFileSync(join(packageRoot(), 'package.json'), 'utf8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function safeLstat(p) {
  try {
    return lstatSync(p);
  } catch {
    return null;
  }
}

export async function installPluginCommand() {
  const src = pluginSourceDir();
  if (!existsSync(src)) throw new Error(`plugin source not found at ${src}`);

  const version = readPkgVersion();
  const target = pluginTargetVersionedDir(version);
  mkdirSync(dirname(target), { recursive: true });

  const st = safeLstat(target);
  if (st && st.isSymbolicLink()) {
    const cur = readlinkSync(target);
    const resolved = resolve(dirname(target), cur);
    if (resolved === src) {
      process.stdout.write(`already linked: ${target} -> ${src}\n`);
      return;
    }
  }
  if (st) rmSync(target, { recursive: true, force: true });
  symlinkSync(src, target, 'dir');
  process.stdout.write(`linked: ${target} -> ${src}\n`);
}

export async function uninstallPluginCommand() {
  const root = pluginTargetRoot();
  if (!existsSync(root)) {
    process.stdout.write('no plugin symlink found\n');
    return;
  }
  rmSync(root, { recursive: true, force: true });
  process.stdout.write(`removed ${root}\n`);
}
