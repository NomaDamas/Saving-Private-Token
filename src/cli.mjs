import { runCommand } from './commands/run.mjs';
import { scheduleCommand } from './commands/schedule.mjs';
import { cancelCommand } from './commands/cancel.mjs';
import { pingCommand } from './commands/ping.mjs';
import { statusCommand } from './commands/status.mjs';
import { doctorCommand } from './commands/doctor.mjs';
import { installPluginCommand, uninstallPluginCommand } from './commands/install-plugin.mjs';

const VERSION = '0.1.0';

const HELP = `spt — SavingPrivateToken v${VERSION}

Usage:
  spt                          Launch tmux + claude with cache keepalive
  spt doctor                   Diagnose tmux/claude/plugin state
  spt install-plugin           (Re)install the Claude Code plugin symlink
  spt uninstall-plugin         Remove the plugin symlink
  spt version                  Print version
  spt help                     Show this help

Internal (invoked by hooks):
  spt schedule <sid> --pane <pane>
  spt cancel <sid>
  spt ping <sid>
  spt status <sid>
`;

export async function main(argv) {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case undefined:
    case 'run':
      return runCommand(rest);
    case 'schedule':
      return scheduleCommand(rest);
    case 'cancel':
      return cancelCommand(rest);
    case 'ping':
      return pingCommand(rest);
    case 'status':
      return statusCommand(rest);
    case 'doctor':
      return doctorCommand(rest);
    case 'install-plugin':
      return installPluginCommand(rest);
    case 'uninstall-plugin':
      return uninstallPluginCommand(rest);
    case 'version':
    case '--version':
    case '-v':
      process.stdout.write(`${VERSION}\n`);
      return;
    case 'help':
    case '--help':
    case '-h':
      process.stdout.write(HELP);
      return;
    default:
      process.stderr.write(`spt: unknown command: ${cmd}\n${HELP}`);
      process.exit(2);
  }
}

export { VERSION };
