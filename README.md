# Chapter 1: The Cortex — Three Layers

*From a raw LLM to an agent, in three steps.*

An AI agent is not just a brain — it's an entire organism. At its core is a **cortex** (the LLM plus its orchestration code). The LLM specifically acts as the **association cortex** — reasoning, language, planning, action formatting. But a raw LLM is not an agent. It generates text — tokens in, tokens out. This chapter adds the two things that make it one: **tools** and **the loop**.

Tools split into two categories: **read actions** (looking, searching, listing — the agent perceives) and **write actions** (sending, saving, executing — the agent changes the world). Read actions are safe and idempotent. Write actions are irreversible. In this chapter we use only read actions. Chapter 2 adds write actions — and with them, the need for guardrails.

```
THE CORTEX
  ┌────────────────────────────────────────────────────────────────┐
  │ TASK-LOCAL EXECUTIVE        ← the loop (agent-loop)            │
  │   "Should I call another tool? Keep going or stop?"           │
  │     manages →                                                 │
  │ REASONING                   ← the LLM itself (raw-cortex)     │
  │   "What tool? What arguments? What does this result mean?"    │
  └────────────────────────────────────────────────────────────────┘
  ACTION INTERFACE (motor ctx)  ← function-calling + tools (action-interface)
```

---

## Setup

```bash
npm install
```

You need an API key. The default is **Google Gemini** (free tier, no credit card):

1. Go to https://aistudio.google.com/apikey
2. Create an API key
3. Export it:

```bash
export GEMINI_API_KEY=your-key-here
```

To use a different provider, edit `llm.ts` — uncomment the two lines for your provider.

---

## The Raw Cortex

*Reasoning — the LLM as a pure text generator.*

```bash
npm run raw-cortex
npm run raw-cortex "What files are in the current directory?"
```

The cortex is smart. It can reason about anything. But it can't *do* anything — it can only describe what it would do. "I would run `ls` to check the directory" — but it can't run `ls`.

**What you're seeing:** A single LLM call. Prompt in, text out. No tools, no loop. This is the association cortex in isolation — powerful reasoning with no way to act on it.

**Code:** `raw-cortex.ts` (~10 lines)

---

## The Action Interface

*Motor cortex — translating intent into structured tool calls.*

```bash
npm run action-interface
npm run action-interface "What files are in the current directory?"
```

Now the cortex can act. You defined a `list_files` tool as a JSON schema. The LLM returns a `tool_calls` array — a structured request to use the tool. Your code executes it.

We use a read-only tool here for safety — but the action interface works the same whether the tool reads or writes. The LLM generates a structured call either way. Looking is an action. Listening is an action. What differs is the *consequence*: read actions observe the world, write actions change it.

But it's **one-shot**: one tool call, then it stops. The LLM never sees the result of its own action. If it needs to chain — "list the files, then look inside a subdirectory" — it can't. There's no loop.

**What you're seeing:** The LLM generates a structured tool call instead of text. You execute it. But you never feed the result back. The cortex acted, but it's blind to the consequences.

**Key concept:** The action interface is the LLM's function-calling capability. It translates fuzzy intent ("what's in this directory?") into precise structured calls (`list_files({ path: "." })`). The quality of this translation varies between models — this is why model choice matters for agents.

**Code:** `action-interface.ts` (~30 lines beyond raw-cortex)

---

## The Task-Local Executive (The Agent Loop)

*The loop that makes an LLM an agent.*

```bash
npm run agent-loop
npm run agent-loop "What directories exist here? List the contents of each one."
```

The cortex can reason (raw-cortex) and act (action-interface), but it does each once and stops. The task-local executive is the **loop**: keep calling the LLM until it stops requesting tools. The LLM decides "I need another action" or "I'm done." Your code respects that decision.

```
reason → act → observe → reason → act → observe → ... → "I'm done"
```

**What you're seeing:** The agent chains tool calls. It lists the current directory, sees subdirectories, lists each one, and summarizes the structure. Multiple iterations, each informed by the last. The LLM decides when to stop.

**Key concept:** The task-local executive and reasoning are the **same model**. The LLM doesn't have a separate module for "should I keep going?" — it's the same forward pass that also decides "what tool should I call?" Agent SDKs (Claude Agent SDK, OpenAI Agents SDK) give you this loop for free. By building it here, you see what "agent" actually means: an LLM plus a loop.

**Code:** `agent-loop.ts` (~50 lines beyond action-interface)

---

## What you built

| Step | What it is | Brain analog | What changed |
|------|-----------|-------------|--------------|
| raw-cortex | Raw LLM call | Association cortex | Can think, can't act |
| action-interface | + Tools | + Motor cortex | Can act once, can't chain |
| agent-loop | + The loop | + Task-local executive | Can chain actions — it's an agent |

The progression from raw-cortex → agent-loop is the core thesis: a raw LLM is not an agent. Add tools and it can act once. Add the loop and it's an agent. Everything after this chapter makes the agent *better* — but the loop is what makes it an agent at all.

**Note:** All tools in this chapter are read-only — the agent can look but not touch. This is deliberate: it lets you learn the action interface safely. Chapter 2 adds write tools (file writes, messages, commands) and with them, the real consequences that require guardrails.

**Next:** Checkout the `chapter-2` branch *(write tools, channels, and the consequences of acting on the world)*

---

## Where this lives in NanoClaw

This is what the **Claude Agent SDK** does inside the container. NanoClaw delegates the entire task-local executive to the SDK — it provides the loop, the tool execution, the message history management. But now you know what's inside that black box.
