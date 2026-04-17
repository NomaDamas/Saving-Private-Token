import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MARKETPLACE_NAME = 'savingprivatetoken';
const PLUGIN_REF = 'savingprivatetoken@savingprivatetoken';

export function packageRoot() {
  return resolve(__dirname, '..', '..');
}

export function pluginSourceDir() {
  return join(packageRoot(), 'plugin');
}

function claudeAvailable() {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['claude'], {
    encoding: 'utf8',
  });
  return r.status === 0;
}

function runClaude(args) {
  return spawnSync('claude', args, { encoding: 'utf8' });
}

function marketplaceAlreadyRegistered() {
  const r = runClaude(['plugin', 'marketplace', 'list']);
  if (r.status !== 0) return false;
  const out = `${r.stdout}\n${r.stderr}`;
  return new RegExp(`^\\s*❯?\\s*${MARKETPLACE_NAME}\\b`, 'm').test(out);
}

function pluginAlreadyInstalled() {
  const r = runClaude(['plugin', 'list']);
  if (r.status !== 0) return false;
  const out = `${r.stdout}\n${r.stderr}`;
  return new RegExp(`\\b${MARKETPLACE_NAME}@${MARKETPLACE_NAME}\\b`, 'm').test(out);
}

export async function installPluginCommand() {
  const src = pluginSourceDir();
  if (!existsSync(src)) throw new Error(`plugin source not found at ${src}`);
  if (!claudeAvailable()) {
    throw new Error(
      '`claude` CLI not found on PATH. Install Claude Code first, then rerun `spt install-plugin`.',
    );
  }

  const root = packageRoot();

  if (marketplaceAlreadyRegistered()) {
    process.stdout.write(`marketplace already registered: ${MARKETPLACE_NAME}\n`);
  } else {
    const add = spawnSync('claude', ['plugin', 'marketplace', 'add', root, '--scope', 'user'], {
      stdio: 'inherit',
    });
    if (add.status !== 0) {
      throw new Error(`claude plugin marketplace add failed (exit ${add.status})`);
    }
  }

  if (pluginAlreadyInstalled()) {
    process.stdout.write(`plugin already installed: ${PLUGIN_REF}\n`);
    return;
  }

  const inst = spawnSync('claude', ['plugin', 'install', PLUGIN_REF, '--scope', 'user'], {
    stdio: 'inherit',
  });
  if (inst.status !== 0) {
    throw new Error(`claude plugin install failed (exit ${inst.status})`);
  }
  process.stdout.write(
    '\nRestart any running Claude Code sessions for the plugin hooks to load.\n',
  );
}

export async function uninstallPluginCommand() {
  if (!claudeAvailable()) {
    throw new Error('`claude` CLI not found on PATH.');
  }
  if (pluginAlreadyInstalled()) {
    spawnSync('claude', ['plugin', 'uninstall', PLUGIN_REF], { stdio: 'inherit' });
  } else {
    process.stdout.write(`plugin not installed: ${PLUGIN_REF}\n`);
  }
  if (marketplaceAlreadyRegistered()) {
    spawnSync('claude', ['plugin', 'marketplace', 'remove', MARKETPLACE_NAME], {
      stdio: 'inherit',
    });
  } else {
    process.stdout.write(`marketplace not registered: ${MARKETPLACE_NAME}\n`);
  }
}

export { MARKETPLACE_NAME, PLUGIN_REF };
