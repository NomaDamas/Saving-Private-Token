# savingprivatetoken — cache keepalive plugin

이 파일은 문서용입니다. Claude Code 의 plugin 루트 `CLAUDE.md` 는 자동으로 시스템 컨텍스트에 주입되지 않습니다. 실제 동작 규칙은 `hooks/on-user-prompt.sh` 의 `additionalContext` 주입으로 강제됩니다.

## What this plugin does

Claude Code 인터랙티브 세션에서, Claude 의 마지막 응답이 끝나고 **290초 동안 유저 입력이 없으면** 백그라운드 워커가 tmux `send-keys` 로 현재 pane 에 `__ping__` 문자열을 주입합니다. Claude 는 UserPromptSubmit hook 이 주입한 `additionalContext` 에 따라 `pong` 한 단어만 응답하도록 유도됩니다.

## Reserved prompt string

- `__ping__` — 이 정확한 문자열이 유저 입력으로 들어오면 plugin 이 automated keepalive 로 인식하여 `pong` 응답으로 전환합니다. 평문 대화에서 이 정확한 문자열을 직접 입력할 일은 거의 없겠지만, 발생하면 동일하게 처리됩니다.

## Activation

이 plugin 은 `spt` CLI 가 띄운 세션에서만 동작합니다 (`SPT_ENABLED=1` 환경변수 + tmux 존재 확인). 그 외의 Claude Code 세션에서는 모든 hook 이 조용히 no-op 합니다.

## Files

- `hooks/hooks.json` — SessionStart / Stop / UserPromptSubmit 훅 선언
- `hooks/on-stop.sh` — Stop hook, `spt schedule` 호출
- `hooks/on-user-prompt.sh` — UserPromptSubmit hook, ping 감지 또는 cancel
- `hooks/on-session-start.sh` — SessionStart hook, 낡은 state 스윕

## Uninstall

`spt uninstall-plugin` 또는 `~/.claude/plugins/cache/savingprivatetoken-local/savingprivatetoken/` 심링크를 제거하면 됩니다.
