/**
 * Frontend Agent for ContentFlow
 *
 * Handles all React/TypeScript/UI tasks.
 * Model routing:
 * - claude-haiku-4-5-20251001: component boilerplate, types, stores, services
 * - claude-sonnet-4-20250514: complex state/hooks, dashboard, calendar, AI plan UI
 */

const HAIKU = 'claude-haiku-4-5-20251001'
const SONNET = 'claude-sonnet-4-20250514'

export const TASK_MODEL_MAP: Record<string, string> = {
  'FE-001': HAIKU,
  'FE-002': SONNET,
  'FE-003': SONNET,
  'FE-004': SONNET,
  'FE-005': SONNET,
  'FE-006': SONNET,
  'FE-007': SONNET,
  'FE-008': HAIKU,
  'FE-009': HAIKU,
  'FE-010': HAIKU,
  'FE-011': HAIKU,
  'FE-012': HAIKU,
}

export const SYSTEM_PROMPT = `
You are the Frontend Agent for ContentFlow.
You write React + TypeScript + TailwindCSS + shadcn/ui code.
Scope: frontend/src/ directory only.
Dark theme by default (CSS variables defined in index.css).
Never write backend or devops code.
`

export function getModelForTask(taskId: string): string {
  return TASK_MODEL_MAP[taskId] || HAIKU
}
