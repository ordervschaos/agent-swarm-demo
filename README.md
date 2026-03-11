# Agent Swarm Demo

An autonomous multi-agent orchestration system where specialized AI agents collaborate through delegation, messaging, and persistent memory. Built on any OpenAI-compatible LLM API (defaults to Google Gemini free tier).

## Features

- **Multi-agent coordination** — A Leader agent delegates tasks to specialized workers
- **Inter-agent messaging** — Agents communicate asynchronously via message queues
- **Persistent memory** — Agents maintain notes across sessions
- **Autonomous operation** — An Attention system awakens agents on schedules or file-based triggers
- **Job search pipeline** — Scout discovers remote jobs, Tracker manages a CRM pipeline
- **Skill templates** — Reusable Markdown prompt templates with variable interpolation

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env.local` file in the project root:

```env
# LLM Provider (Google Gemini — free tier, no credit card required)
GEMINI_API_KEY="your-key-here"

# Gmail OAuth2 (optional — for inbox reading)
GMAIL_CLIENT_ID="..."
GMAIL_CLIENT_SECRET="..."
GMAIL_REFRESH_TOKEN="..."

# Job search APIs (optional — all have free tiers)
JSEARCH_API_KEY="..."     # RapidAPI JSearch (200 req/mo free)
ADZUNA_APP_ID="..."       # Adzuna
ADZUNA_APP_KEY="..."
JOOBLE_API_KEY="..."      # Jooble
```

Get a Gemini API key at [aistudio.google.com](https://aistudio.google.com). The job search APIs (Remotive, RemoteOK, Jobicy, HN Hiring) work without keys.

### 3. (Optional) Configure LLM provider

Edit `llm.ts` to switch providers. The file includes commented examples for OpenRouter, Groq, MiniMax, and others — any OpenAI-compatible API works.

## Usage

### Interactive REPL

```bash
npm start                        # Start with the 'leader' agent
npm start -- scout               # Start with a specific agent
npm start -- nova "Find remote React jobs"  # Single-shot (runs once and exits)
```

Type a message and press Enter. The agent will reason, call tools, and respond. Use `/quit` or `/exit` to leave.

### Autonomous Mode

```bash
npm awaken
```

Starts the Attention system. Agents wake up automatically based on cues defined in `cues.ts` — either on a time interval (e.g., Scout searches every 6 hours) or when files appear in an agent's inbox.

## Agents

| Agent | Role |
|-------|------|
| `leader` | Coordinator — delegates tasks to other agents |
| `scout` | Job discovery — searches job boards and reports to Tracker |
| `tracker` | Job CRM — maintains a pipeline with statuses (discovered → applied → offered) |
| `atlas` | General-purpose, calm and precise assistant |
| `nova` | Generic worker agent |

Each agent has its own identity (`agents/{name}/identity.md`), sandbox, memory, and message inbox.

## Project Structure

```
agent-swarm-demo/
├── index.ts          # CLI entry point and REPL
├── agent.ts          # Core agent loop (perceive → think → act → observe)
├── attention.ts      # Autonomous trigger system
├── llm.ts            # LLM provider configuration
├── cues.ts           # Attention cue definitions
├── skills.ts         # Skill template loader
├── actions/          # Tool implementations (files, memory, web, jobs, messaging)
├── agents/           # Agent definitions (identity, config, memory, inbox)
└── skills/           # Reusable prompt templates (Markdown + YAML frontmatter)
```

## Adding a New Agent

1. Create a directory: `agents/my-agent/`
2. Add `identity.md` — the agent's persona (injected as system prompt)
3. Add `config.json` — set `{"canDelegate": true}` for coordinator agents
4. Run with: `npm start -- my-agent`

## Adding a New Skill

Create `skills/my-skill.md` with YAML frontmatter:

```markdown
---
name: my-skill
description: What this skill does
---

Your prompt template here. Use {{variable}} for interpolation.
```

Agents invoke skills via the `run_skill` tool.
