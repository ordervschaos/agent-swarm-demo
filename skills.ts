/**
 * Skills — discovery and loading of .md skill files.
 *
 * Each skill file can have optional YAML frontmatter:
 *
 *   ---
 *   name: heartbeat
 *   description: Write timestamp and status to heartbeat file
 *   ---
 *   Write the current timestamp...
 *
 * discoverSkills() scans a directory and returns metadata for all skills.
 * loadSkill() finds a skill by name, loads its template, and interpolates {{placeholders}}.
 */

import { readdirSync, readFileSync, existsSync } from 'fs'
import { resolve, basename } from 'path'

export interface SkillMeta {
  name: string
  description: string
  file: string
}

interface ParsedSkill {
  meta: Record<string, string>
  body: string
}

/** Parse frontmatter from a skill file. */
function parseFrontmatter(content: string): ParsedSkill {
  const trimmed = content.trimStart()
  if (!trimmed.startsWith('---')) {
    return { meta: {}, body: content }
  }

  const end = trimmed.indexOf('---', 3)
  if (end === -1) return { meta: {}, body: content }

  const frontmatter = trimmed.slice(3, end)
  const body = trimmed.slice(end + 3).trimStart()

  const meta: Record<string, string> = {}
  for (const line of frontmatter.split('\n')) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    const value = line.slice(colon + 1).trim()
    if (key && value) meta[key] = value
  }

  return { meta, body }
}

/** Scan a directory for .md skill files and return metadata for each. */
export function discoverSkills(dir: string): SkillMeta[] {
  const absDir = resolve(dir)
  if (!existsSync(absDir)) return []

  const skills: SkillMeta[] = []
  for (const file of readdirSync(absDir)) {
    if (!file.endsWith('.md')) continue

    const content = readFileSync(resolve(absDir, file), 'utf-8')
    const { meta } = parseFrontmatter(content)

    skills.push({
      name: meta.name || basename(file, '.md'),
      description: meta.description || '',
      file,
    })
  }

  return skills
}

/** Load a skill by name, interpolate {{placeholders}} with data, return the prompt body. */
export function loadSkill(dir: string, name: string, data?: Record<string, string>): string | null {
  const absDir = resolve(dir)
  if (!existsSync(absDir)) return null

  // Find skill by frontmatter name or filename
  for (const file of readdirSync(absDir)) {
    if (!file.endsWith('.md')) continue

    const content = readFileSync(resolve(absDir, file), 'utf-8')
    const { meta, body } = parseFrontmatter(content)
    const skillName = meta.name || basename(file, '.md')

    if (skillName !== name) continue

    let template = body
    if (data) {
      for (const [key, value] of Object.entries(data)) {
        template = template.replaceAll(`{{${key}}}`, value)
      }
    }
    return template
  }

  return null
}
