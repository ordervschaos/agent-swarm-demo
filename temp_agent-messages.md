# Agent Messages — Inter-agent Communication

## Design

Replaced shared workspace with message-based communication. Two separate directories:

- **`inbox/`** — daemon-watched, external triggers only (WhatsApp, cron)
- **`agent-messages/`** — inter-agent only, read during deliberation, daemon ignores

## Files Changed

- `actions/messaging.ts` — `send_message` writes to `agent-messages/`, added `read_messages` (reads + consumes)
- `agent-config.ts` — `workspaceDir` → `agentMessagesDir`
- `actions/index.ts` — removed workspace, passes `agentMessagesDir` to messaging
- `agent.ts` — updated awareness instructions
- `actions/workspace.ts` — deleted
- `actions/messaging.test.ts` — new, 9 tests covering send, read, consumption, ordering, inbox isolation
- `package.json` — added `npm test` script

## Tests (9/9 passing)

- Rejects self-send and missing fields
- Empty inbox returns "(no messages)"
- Messages are consumed after reading
- Send → read flow between two agents
- Messages don't end up in inbox/ (daemon isolation)
- Multiple messages returned in timestamp order
