/**
 * Skill actions — let the LLM discover and invoke skills as tools.
 *
 *   list_skills  → returns the catalog (name + description for each)
 *   run_skill    → loads a skill template and returns it as instructions
 */

import { discoverSkills, loadSkill } from '../skills.js'
import type { ChatCompletionTool } from 'openai/resources/index'

export const tools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_skills',
      description: 'List all available skills with their names and descriptions',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_skill',
      description: 'Run a skill by name. Returns the skill instructions for you to follow.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the skill to run' },
          inputs: { type: 'string', description: 'Optional JSON string of key-value pairs to interpolate into the skill template' },
        },
        required: ['name'],
      },
    },
  },
]

export function createHandler(skillsDir: string) {
  return (name: string, args: Record<string, string>): string | null => {
    if (name === 'list_skills') {
      const skills = discoverSkills(skillsDir)
      if (skills.length === 0) return 'No skills available.'
      return skills.map(s => `- ${s.name}: ${s.description || '(no description)'}`).join('\n')
    }

    if (name === 'run_skill') {
      const data = args.inputs ? JSON.parse(args.inputs) : undefined
      const content = loadSkill(skillsDir, args.name, data)
      if (!content) return `Skill not found: ${args.name}`
      return content
    }

    return null
  }
}
