# How the Docker Container Actually Works — Chapter 4

A complete technical walkthrough: what's inside the container, where files come from, how a message gets in, how the agent runs, and how the reply gets back to the terminal.

---

## The two processes

When you run `npm run chat`, two separate processes handle a single conversation turn:

```
Your terminal
    │
    ▼
chat.ts  ← runs on your machine (the host)
    │  spawns per turn
    ▼
docker run tutorial-agent  ← runs inside a container (isolated)
```

`chat.ts` never imports `llm.ts` or `tools.ts`. It has no LLM code at all. It's a shell: it reads your input, spawns a container, pipes data in, reads data back out, and prints the reply. Everything involving the LLM — the agent loop, the tool calls, the API request — happens inside the container.

---

## What's in the container image

The `Dockerfile` defines what gets baked into the image at build time (`npm run build-container`):

```dockerfile
FROM node:22-alpine
WORKDIR /agent          # everything lives at /agent inside the container

COPY package*.json ./
RUN npm install         # installs openai, tsx, dotenv, etc.

COPY llm.ts tools.ts container-entry.ts ./   # the agent source

CMD ["node", "--no-deprecation", "--import", "tsx/esm", "container-entry.ts"]
```

After `docker build`, the image contains:

```
/agent/
  node_modules/        ← installed at build time
  package.json
  llm.ts               ← the LLM client (baked in)
  tools.ts             ← tool definitions + executors (baked in)
  container-entry.ts   ← the entrypoint (baked in)
```

**`identity.md` is NOT here.** Neither is `memory/` or `sandbox/`. Those are mounted at runtime — a different mechanism explained below. The image is just the logic. The data arrives separately each run.

---

## How `llm.ts` is used inside the container

`llm.ts` on your host and `llm.ts` inside the container are the same file — it was COPYed into the image. Inside the container it runs as:

```typescript
// llm.ts (running at /agent/llm.ts inside the container)
import OpenAI from 'openai'

export const llm = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,   // reads from environment
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
})
export const MODEL = 'gemini-2.5-flash'
```

The API key is not in the image. `chat.ts` passes it at runtime via `--env`:

```typescript
// chat.ts:37-38
const knownKeys = ['GEMINI_API_KEY', 'MINIMAX_API_KEY', ...]
const envFlags = knownKeys.flatMap(k => process.env[k] ? ['--env', `${k}=${process.env[k]}`] : [])
```

So the key lives on the host (in `.env.local`), gets loaded by `chat.ts`, and gets forwarded into the container as an environment variable. The container never touches `.env.local` directly.

---

## How `tools.ts` is used inside the container

`tools.ts` defines the tools the LLM can call. Its two key facts:

```typescript
// tools.ts:14 — sandbox path is RELATIVE, resolved at runtime
const SANDBOX = resolve('sandbox')   // → /agent/sandbox inside the container

// tools.ts:34-35 — memory path is also relative
const MEMORY_DIR = resolve('memory')
const NOTES_FILE = resolve(MEMORY_DIR, 'notes.md')
```

When `tools.ts` runs inside the container, `resolve('sandbox')` resolves to `/agent/sandbox` because the working directory is `/agent` (set by `WORKDIR` in the Dockerfile). That directory is a volume mount — it points to `./sandbox/` on your host. Same for `memory/`.

So when the agent calls `write_file`:
1. `tools.ts` receives the call, resolves the path to `/agent/sandbox/poem.txt`
2. It writes the file at `/agent/sandbox/poem.txt` inside the container
3. Because `/agent/sandbox` is a volume mount, that write immediately appears as `./sandbox/poem.txt` on your host

The container's filesystem write and the host's filesystem write are the same operation — the mount is a shared view, not a copy.

---

## The filesystem inside a running container

When `docker run` spawns a container with the mounts from `chat.ts`:

```typescript
// chat.ts:44-46
'--volume', `${SANDBOX}:/agent/sandbox`,
'--volume', `${MEMORY}:/agent/memory`,
'--volume', `${IDENTITY}:/agent/identity.md:ro`,
```

The container sees this filesystem at `/agent/`:

```
/agent/
  node_modules/          ← from the image (baked in)
  package.json           ← from the image (baked in)
  llm.ts                 ← from the image (baked in)
  tools.ts               ← from the image (baked in)
  container-entry.ts     ← from the image (baked in)
  sandbox/               ← MOUNTED from host: ./sandbox/  (read-write)
  memory/                ← MOUNTED from host: ./memory/   (read-write)
  identity.md            ← MOUNTED from host: ./identity.md  (read-only)
```

Everything on your host that wasn't mounted — `chat.ts`, `llm.ts` on the host, your home directory, your OS — simply does not appear anywhere in this filesystem. It isn't hidden or locked. It doesn't exist from the container's perspective.

---

## How a message gets into the container

`chat.ts` does not call `container-entry.ts` directly. It spawns `docker run` as a child process and pipes data over **stdin**:

```typescript
// chat.ts:50-51
docker.stdin.write(JSON.stringify(messages))
docker.stdin.end()
```

The `messages` variable is the conversation history — an array of `{role, content}` objects:

```json
[
  { "role": "user", "content": "write a haiku to sandbox/poem.txt" },
  { "role": "assistant", "content": "Done. I wrote a haiku." },
  { "role": "user", "content": "read it back to me" }
]
```

The full history is serialized as a single JSON string and written to the container's stdin. The container reads it all, then processes it.

**Why pass the full history every turn?** Because the container is stateless. It boots, processes one turn, and exits. There's no persistent process keeping state between turns. `chat.ts` holds the history on the host and injects the entire context window on each invocation.

---

## What `container-entry.ts` does with it

`container-entry.ts` is the container's `CMD` — the first thing that runs when the container starts:

```typescript
// container-entry.ts:23-28
const lines: string[] = []
const rl = createInterface({ input: process.stdin })
rl.on('line', (line) => lines.push(line))

rl.on('close', async () => {
  const history = JSON.parse(lines.join('\n'))
```

It collects all stdin lines (the JSON), then on stdin close (when `chat.ts` calls `docker.stdin.end()`) it parses the history.

Then it builds the system prompt from the mounted files:

```typescript
// container-entry.ts:31-41
const identity = existsSync(resolve('identity.md'))
  ? readFileSync(resolve('identity.md'), 'utf-8')
  : ''
const notes = loadNotes()    // reads /agent/memory/notes.md if it exists

let systemPrompt = `${identity}

---

You are a helpful agent. Use your tools to accomplish the task...`
if (notes) systemPrompt += `\n\n---\n\nYour notes from previous sessions:\n${notes}`
```

`identity.md` is read from the mount at `/agent/identity.md`. Notes are read from `/agent/memory/notes.md`. Neither exists in the image — both come from the host via mounts. This is how the agent's identity and memory survive across container runs: the container is ephemeral, the mounts persist.

Then it runs the agent loop:

```typescript
// container-entry.ts:43-73
const messages: ChatCompletionMessageParam[] = [
  { role: 'system', content: systemPrompt },
  ...history,    // the history from stdin is injected here
]

while (true) {
  const response = await llm.chat.completions.create({ model: MODEL, tools, messages })
  const message = response.choices[0].message

  if (!message.tool_calls || message.tool_calls.length === 0) {
    process.stdout.write((message.content ?? '') + '\n')
    break        // LLM is done — write reply to stdout and exit
  }

  // LLM wants to call tools — execute them, push results, loop
  messages.push(message)
  for (const call of message.tool_calls) {
    const args = JSON.parse(call.function.arguments)
    const result = executeTool(call.function.name, args)
    messages.push({ role: 'tool', tool_call_id: call.id, content: result })
  }
}
```

The loop keeps calling the LLM until it produces a message with no tool calls. At that point the reply is written to stdout and the process exits.

---

## How the reply gets back to the terminal

`chat.ts` is listening to the container's stdout:

```typescript
// chat.ts:53-54
const chunks: string[] = []
docker.stdout.on('data', chunk => chunks.push(chunk.toString()))
```

When the container writes the final reply to stdout and exits:

```typescript
// chat.ts:57-60
docker.on('close', code => {
  if (code !== 0) reject(new Error(`Container exited ${code}`))
  else done(chunks.join('').trim())
})
```

`done()` resolves the promise with the collected output. Back in the `rl.on('line')` handler:

```typescript
// chat.ts:93-96
const reply = await runInContainer(history)
history.push({ role: 'assistant', content: reply })
stop()
console.log(`${GREEN}Agent:${RESET} ${reply}\n`)
```

The reply is added to the in-memory history (for the next turn), the spinner stops, and the reply is printed.

---

## The full lifecycle of one turn

```
User types "write a haiku to sandbox/poem.txt"
    │
    ▼
chat.ts:88   history.push({ role: 'user', content: text })
    │
    ▼
chat.ts:41   docker run --rm --interactive \
               --env GEMINI_API_KEY=... \
               --volume ./sandbox:/agent/sandbox \
               --volume ./memory:/agent/memory \
               --volume ./identity.md:/agent/identity.md:ro \
               tutorial-agent
    │
    ├── chat.ts:50  docker.stdin.write(JSON.stringify(history))
    │               docker.stdin.end()
    │
    │   [container boots, runs container-entry.ts]
    │
    ├── entry:24    reads stdin → parses history JSON
    ├── entry:31    reads /agent/identity.md from mount
    ├── entry:34    reads /agent/memory/notes.md from mount (if any)
    ├── entry:43    builds messages = [system, ...history]
    │
    ├── entry:53    llm.chat.completions.create(...)
    │               → LLM returns tool_call: write_file("poem.txt", "...")
    │
    ├── entry:70    executeTool("write_file", { path: "poem.txt", content: "..." })
    │               tools.ts writes to /agent/sandbox/poem.txt
    │               ↕  (volume mount — same as ./sandbox/poem.txt on host)
    │
    ├── entry:53    llm.chat.completions.create(...)  [second iteration]
    │               → LLM returns text reply, no tool calls
    │
    ├── entry:57    process.stdout.write("Done. I wrote a haiku to sandbox/poem.txt.")
    │               [container exits]
    │
    ▼
chat.ts:54   chunks collected from docker.stdout
chat.ts:59   promise resolves with reply string
chat.ts:94   history.push({ role: 'assistant', content: reply })
chat.ts:96   console.log("Agent: Done. I wrote a haiku to sandbox/poem.txt.")
    │
    ▼
User sees the reply. sandbox/poem.txt exists on the host.
```

---

## What `--rm` and `--interactive` do

```typescript
'run', '--rm', '--interactive',
```

- `--rm`: Delete the container after it exits. The filesystem inside the container (everything not mounted) is thrown away. Nothing accumulates between runs. Each turn is a fresh container.
- `--interactive`: Keep stdin open so `chat.ts` can pipe JSON into it. Without this, Docker would close stdin immediately.

There's no `-t` (no pseudo-TTY) because `chat.ts` talks to the container programmatically — it doesn't need a terminal emulator, just raw stdin/stdout pipes.

---

## Why `chat.ts` holds the history, not the container

The container is ephemeral — born per turn, killed after. So it can't hold state. The solution: the host holds state, the container holds logic.

`chat.ts` keeps the `history` array in memory across the session. On every turn it sends the entire history to the container. The container rebuilds context from scratch each time: reads identity from the mount, reads notes from the mount, appends the full history from stdin. From the LLM's perspective, it sees a complete, coherent conversation — it doesn't know it's being reconstructed from scratch each turn.

This is also why `identity.md` and `memory/notes.md` are mounts instead of baked into the image. The image is fixed at build time. Mounts are runtime-resolved, so different groups (in NanoClaw) can have different identities and different memory files, all using the same image.

---

## Summary: what lives where

| Thing | Where it lives | Why |
|-------|---------------|-----|
| `llm.ts` | Baked into image | Logic — doesn't change per session |
| `tools.ts` | Baked into image | Logic — doesn't change per session |
| `container-entry.ts` | Baked into image | Logic — doesn't change per session |
| `node_modules/` | Baked into image | Dependencies — installed at build time |
| `identity.md` | Mounted (read-only) | Identity — different per group, survives rebuilds |
| `memory/notes.md` | Mounted (read-write) | Persistence — agent writes here, survives container exit |
| `sandbox/` | Mounted (read-write) | Workspace — agent writes here, visible on host |
| API keys | Environment variable | Secrets — never in the image, forwarded from host env |
| Conversation history | Stdin (per turn) | State — held by `chat.ts`, injected each turn |
| Agent reply | Stdout (per turn) | Output — written by container, read by `chat.ts` |
