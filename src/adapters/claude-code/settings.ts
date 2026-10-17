/** The mod's options, read from the manifest's `userConfig` fields. */
export type Settings = {
  /** Whether checking as you type starts on; `/dialect on|off` overrides it. */
  readonly checkAsYouType: boolean
  readonly grammarModel: string
  readonly improvementModel: string
  /** How long the writer pauses before the draft is checked. */
  readonly debounceMs: number
}

export const DEFAULT_SETTINGS: Settings = {
  checkAsYouType: true,
  grammarModel: 'claude-haiku-5-5',
  improvementModel: 'claude-haiku-5-5',
  debounceMs: 900,
}

const MIN_DEBOUNCE_MS = 250
const MAX_DEBOUNCE_MS = 10_000

export function settingsFrom(options: Readonly<Record<string, unknown>>): Settings {
  return {
    checkAsYouType: booleanOr(options.checkAsYouType, DEFAULT_SETTINGS.checkAsYouType),
    grammarModel: nonEmptyOr(options.grammarModel, DEFAULT_SETTINGS.grammarModel),
    improvementModel: nonEmptyOr(options.improvementModel, DEFAULT_SETTINGS.improvementModel),
    debounceMs: clampedOr(options.debounceMs, DEFAULT_SETTINGS.debounceMs),
  }
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function nonEmptyOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback
}

function clampedOr(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }
  return Math.min(MAX_DEBOUNCE_MS, Math.max(MIN_DEBOUNCE_MS, Math.round(value)))
}
