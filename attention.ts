/**
 * Attention — the agent's unified vigilance system.
 *
 * A Cue bundles a sensor (how to detect) with a response (what to do).
 * The Attention class monitors all cues and invokes the agent when one fires.
 *
 *   const attention = new Attention(agent, cues)
 *   attention.awaken()   // start monitoring
 *   attention.sleep()    // stop monitoring
 */

import { watch, readFileSync, writeFileSync, renameSync, rmSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { resolve, basename } from 'path'
import { Agent } from './agent.js'

// ── Types ────────────────────────────────────────────────────────────

export interface ClockSensor { type: 'clock'; every: number }
export interface InboxSensor { type: 'inbox'; dir: string; pattern?: string }
export type Sensor = ClockSensor | InboxSensor

export interface Stimulus {
  cueId: string
  detectedAt: Date
  data: Record<string, string>
}

export interface Cue {
  id: string
  sensor: Sensor
  agent?: string            // agent name (uses default if omitted)
  skill?: string            // path to a .md skill file (prompt template)
  respond?: (stimulus: Stimulus) => string  // custom response builder
}

// ── Attention ────────────────────────────────────────────────────────

const TICK_INTERVAL = 5_000

export class Attention {
  private defaultAgent: Agent
  private agents: Record<string, Agent> = {}
  private cues: Cue[]
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private watchers: ReturnType<typeof watch>[] = []
  private nextRun: Record<string, number> = {}
  private processing = new Set<string>()

  constructor(agent: Agent, cues: Cue[]) {
    this.defaultAgent = agent
    this.agents[agent.config.name] = agent
    this.cues = cues
  }

  private agentFor(cue: Cue): Agent {
    if (!cue.agent) return this.defaultAgent
    if (!this.agents[cue.agent]) {
      this.agents[cue.agent] = new Agent(cue.agent)
    }
    return this.agents[cue.agent]
  }

  /** Start vigilance — begin monitoring all cues. */
  awaken(): void {
    console.log(`[attention] awakening with ${this.cues.length} cue(s)`)

    for (const cue of this.cues) {
      console.log(`  ${cue.id}: ${cue.sensor.type}${cue.sensor.type === 'clock' ? ` every ${cue.sensor.every / 1000}s` : ` watching ${cue.sensor.dir}/`}`)

      if (cue.sensor.type === 'clock') {
        this.nextRun[cue.id] = 0  // fire immediately on first tick
      }

      if (cue.sensor.type === 'inbox') {
        this.setupInbox(cue)
      }
    }

    // Shared tick drives all clock sensors
    const clockCues = this.cues.filter(c => c.sensor.type === 'clock')
    if (clockCues.length > 0) {
      this.tick(clockCues)
      this.tickTimer = setInterval(() => this.tick(clockCues), TICK_INTERVAL)
    }
  }

  /** Stop monitoring. */
  sleep(): void {
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null }
    for (const w of this.watchers) w.close()
    this.watchers = []
    console.log('[attention] sleeping')
  }

  // ── Clock sensor ──────────────────────────────────────────────────

  private async tick(clockCues: Cue[]) {
    const now = Date.now()
    for (const cue of clockCues) {
      if (now < this.nextRun[cue.id]) continue

      const stimulus: Stimulus = {
        cueId: cue.id,
        detectedAt: new Date(),
        data: { tickCount: String(now) },
      }

      const prompt = this.buildPrompt(cue, stimulus)
      console.log(`[${cue.id}] firing`)

      try {
        const reply = await this.agentFor(cue).deliberate(prompt)
        console.log(`[${cue.id}] ${reply.slice(0, 100)}${reply.length > 100 ? '...' : ''}`)
      } catch (e: any) {
        console.error(`[${cue.id}] error: ${e.message}`)
      }

      this.nextRun[cue.id] = Date.now() + (cue.sensor as ClockSensor).every
    }
  }

  // ── Inbox sensor ──────────────────────────────────────────────────

  private setupInbox(cue: Cue) {
    const sensor = cue.sensor as InboxSensor
    const dir = resolve(sensor.dir)
    const outbox = resolve('outbox')

    for (const d of [dir, outbox]) {
      if (!existsSync(d)) mkdirSync(d, { recursive: true })
    }

    const handleFile = async (filename: string) => {
      if (!this.matchesPattern(filename, sensor.pattern)) return
      if (filename.startsWith('._')) return
      if (this.processing.has(filename)) return

      const src = resolve(dir, filename)
      const tmp = resolve(dir, `._${filename}`)

      try { renameSync(src, tmp) } catch { return }

      this.processing.add(filename)
      const content = readFileSync(tmp, 'utf-8').trim()
      console.log(`[${cue.id}] ${filename}: ${content.slice(0, 80)}${content.length > 80 ? '...' : ''}`)

      const stimulus: Stimulus = {
        cueId: cue.id,
        detectedAt: new Date(),
        data: { filename, content },
      }

      const prompt = this.buildPrompt(cue, stimulus)

      try {
        const reply = await this.agentFor(cue).deliberate(prompt)
        writeFileSync(resolve(outbox, filename), reply)
        console.log(`[outbox] ${filename}: ${reply.slice(0, 80)}${reply.length > 80 ? '...' : ''}`)
      } catch (e: any) {
        writeFileSync(resolve(outbox, filename), `[error] ${e.message}`)
        console.error(`[${cue.id}] error: ${filename}: ${e.message}`)
      } finally {
        this.processing.delete(filename)
        try { rmSync(tmp) } catch {}
      }
    }

    // Process existing files
    for (const f of readdirSync(dir)) handleFile(f)

    // Watch for new files
    const watcher = watch(dir, (_, filename) => { if (filename) handleFile(filename) })
    this.watchers.push(watcher)
  }

  // ── Prompt building ───────────────────────────────────────────────

  private buildPrompt(cue: Cue, stimulus: Stimulus): string {
    // Custom respond function takes priority
    if (cue.respond) return cue.respond(stimulus)

    // Skill file — load and interpolate
    if (cue.skill) {
      const skillPath = resolve('skills', cue.skill)
      if (existsSync(skillPath)) {
        let template = readFileSync(skillPath, 'utf-8')
        for (const [key, value] of Object.entries(stimulus.data)) {
          template = template.replaceAll(`{{${key}}}`, value)
        }
        return template
      }
      console.warn(`[${cue.id}] skill file not found: ${skillPath}`)
    }

    // Inbox fallback — the file content IS the prompt
    if (stimulus.data.content) return stimulus.data.content

    return `Cue "${cue.id}" fired at ${stimulus.detectedAt.toISOString()}`
  }

  private matchesPattern(filename: string, pattern?: string): boolean {
    if (!pattern) return true
    // Simple glob: *.txt → ends with .txt
    if (pattern.startsWith('*')) {
      return filename.endsWith(pattern.slice(1))
    }
    return filename === pattern
  }
}
