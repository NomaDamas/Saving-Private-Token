<p align="center">
  <img src="https://raw.githubusercontent.com/NomaDamas/Saving-Private-Token/main/assets/hero.png" alt="Saving Private Token" width="360" />
</p>

# SavingPrivateToken

> Keep Claude Code's prompt cache warm while you think.

Anthropic's prompt cache has a 5-minute TTL. If you step away from an interactive Claude Code session for more than 5 minutes — to grab coffee, read a spec, or just think — the cache expires and the next turn re-processes the entire prefix. `SavingPrivateToken` (`spt`) injects a tiny keepalive ping every 4:50 of idle via `tmux send-keys`, refreshing the TTL with a 1-token `pong` round-trip.

## Prerequisites

**All of these must be installed and on `PATH` _before_ you run the `spt` installer.** The installer shells out to `claude` to register its plugin and to `tmux` at runtime to inject pings — neither is optional.

| Requirement | Why | Install |
|---|---|---|
| **Claude Code** (`claude` on `PATH`) | `spt` registers a plugin via `claude plugin marketplace add` + `claude plugin install`. Without `claude` at install time, hooks never fire. | [docs.claude.com/en/docs/claude-code](https://docs.claude.com/en/docs/claude-code) |
| **tmux ≥ 3.0** | The ping is injected via `tmux send-keys` into the claude pane. | `brew install tmux` (macOS) · `apt install tmux` (Debian/Ubuntu) |
| **Node.js ≥ 18** | `spt` and its install script are Node ESM. | [nodejs.org](https://nodejs.org) or `brew install node` |
| **Bash** (POSIX shell) | Plugin hooks are `bash` scripts. macOS and Linux are supported. **Windows/PowerShell is not.** WSL works. | system default |

If `claude` or `tmux` is missing when you install, `spt` will warn and continue — but the keepalive won't work until both are present. You can re-register anytime with `spt install-plugin`.

## Install

> Not on npm yet. Install from git until the first release:

```bash
npm install -g git+https://github.com/NomaDamas/Saving-Private-Token.git
```

The postinstall step runs `claude plugin marketplace add` + `claude plugin install` against your user-scope Claude Code config. **Restart any running Claude Code sessions** so the hooks load.

Verify with:

```bash
spt doctor
```

All checks should be `[OK]`. If `marketplace registered` or `plugin installed` fail, run `spt install-plugin` and re-check.

## Use

```bash
spt
```

That's it. `spt` creates a tmux session named `spt-<id>`, launches `claude` inside it with `SPT_ENABLED=1`, and wires a small countdown into the tmux status bar. Already inside tmux? `spt` attaches to your current pane instead of nesting.

### How it works

```
┌──────────────────────────────────────────────────────────┐
│ tmux pane                                                 │
│ └─ claude (interactive, SPT_ENABLED=1)                    │
│     ├─ Stop hook              → schedule ping in 290 s    │
│     ├─ (4:50 later, idle)     → tmux send-keys __ping__   │
│     ├─ UserPromptSubmit hook  → "__ping__" → pong only    │
│     └─ (real prompt)          → cancel pending ping       │
└──────────────────────────────────────────────────────────┘
```

The keepalive fires only in sessions started via `spt`. Any other `claude` session is untouched (all hooks are no-op unless `SPT_ENABLED=1` and `$TMUX` are both set).

## Commands

| Command | Purpose |
|---|---|
| `spt` | Launch or attach tmux + start claude |
| `spt doctor` | Diagnose tmux / claude / plugin install state |
| `spt install-plugin` | Re-create the Claude Code plugin symlink |
| `spt uninstall-plugin` | Remove the plugin symlink |
| `spt version` | Print version |

Internal subcommands (invoked by hooks, not meant for direct use): `spt schedule`, `spt cancel`, `spt ping`, `spt status`.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `SPT_ENABLED` | unset | Set to `1` by `spt` CLI; hooks gate on this |
| `SPT_PING_INTERVAL` | `290` | Seconds between last response and ping (testing override) |
| `CLAUDE_CONFIG_DIR` | `~/.claude` | Honored for state and plugin paths |

## Cost

Each ping turn is a round trip with a tiny suffix (`__ping__` + short system context + `pong`) on top of your existing conversation prefix. In practice this is a cache _read_ (not creation) for the bulk of the prefix, so the incremental cost is on the order of cents per idle day — effectively the cost of 2–10 tokens of output per 4:50 of idle. Concrete numbers depend on your model and conversation length; see Anthropic's pricing page.

## Reserved prompt strings

- `__ping__` (exact match) — rewritten to a "respond only with 'pong'" instruction. If you paste or type this exact string yourself, you'll get the same behavior. Pick another phrasing if you actually need to send it literally.

## Troubleshooting

Run `spt doctor` first. It checks:

- `tmux` availability and version
- `claude` binary on PATH
- Plugin marketplace registered and plugin enabled (via `claude plugin list`)
- `SPT_ENABLED` passthrough (from inside an `spt` session)

Common issues:

- **Ping never fires.** Confirm you started via `spt` (check `echo $SPT_ENABLED` shows `1`) and you're in tmux (`echo $TMUX` non-empty). Look at `~/.claude/plugins/data/savingprivatetoken/sessions/*.json`. If the sessions directory stays empty, the plugin hooks aren't firing — run `spt install-plugin` and restart Claude Code.
- **`pong` response uses tools or is verbose.** The enforcement relies on an `additionalContext` hint — it's a strong suggestion, not a hard constraint. If a project's `CLAUDE.md` aggressively encourages tool use, the model may still deviate. Open an issue if you see this consistently.
- **Plugin not loaded.** Run `spt install-plugin` (registers the marketplace and enables the plugin via the `claude` CLI). Restart Claude Code afterward.
- **Multiple concurrent `spt` sessions.** Supported. State is keyed by Claude session_id, so sessions don't interfere.

## Uninstall

```bash
spt uninstall-plugin
npm uninstall -g savingprivatetoken
```

State files under `~/.claude/plugins/data/savingprivatetoken/` are left in place — remove that directory manually if you want a clean slate.

## Why this exists

While Anthropic's prompt cache TTL is 5 minutes on the default surface, real work often pauses for longer — reading docs, debugging in another window, taking a call. Every miss means re-paying the input-token cost of your full conversation prefix. `spt` is a pragmatic workaround that trades a tiny synthetic turn for a guaranteed cache hit on the next real turn.

See the [design notes](./plugin/CLAUDE.md) for the internal mechanics. The approach is tmux-specific because Claude Code's interactive process holds conversation state in memory and does not re-read the session file — the only cross-process injection path that actually updates the live model state is stdin via `tmux send-keys`.

## License

MIT. See [LICENSE](./LICENSE).
