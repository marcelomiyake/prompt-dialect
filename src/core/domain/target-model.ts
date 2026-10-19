/** The Claude model lines that have their own prompting guidance. */
export type ModelFamily = 'opus' | 'sonnet' | 'haiku' | 'fable' | 'mythos'

const FAMILY_NAMES: Readonly<Record<ModelFamily, string>> = {
  opus: 'Opus',
  sonnet: 'Sonnet',
  haiku: 'Haiku',
  fable: 'Fable',
  mythos: 'Mythos',
}

// `claude-opus-5-5`, `opus[1m]`, `Claude Sonnet 5.5`, `claude-haiku-4-5-20251001`
const FAMILY = /opus|sonnet|haiku|fable|mythos/i
// What follows the family: `-5-5`, ` 5.5`, `-4-5-20251001`; a date is no version.
const VERSION = /^[\s_-]*(\d{1,2})(?!\d)(?:[._-](\d{1,2})(?!\d))?/

/**
 * The model a prompt is written for, read from whatever spelling the tool
 * reports: an id, an alias, or a display name.
 */
export class TargetModel {
  readonly isKnown: boolean
  /** How a person names it: `Opus 5.5`, `Sonnet`, or the raw id when unknown. */
  readonly label: string

  private constructor(
    readonly raw: string,
    readonly family: ModelFamily | undefined,
    readonly version: string | undefined,
  ) {
    this.isKnown = family !== undefined
    this.label = labelOf(raw, family, version)
  }

  static parse(raw: string): TargetModel {
    const found = FAMILY.exec(raw)
    if (found === null) {
      return new TargetModel(raw, undefined, undefined)
    }
    const family = found[0].toLowerCase() as ModelFamily
    const parts = VERSION.exec(raw.slice(found.index + found[0].length))
    const version = parts === null ? undefined : [parts[1], parts[2]].filter(Boolean).join('.')
    return new TargetModel(raw, family, version)
  }
}

function labelOf(raw: string, family: ModelFamily | undefined, version: string | undefined): string {
  if (family === undefined) {
    return raw.trim() === '' ? 'Claude' : raw.trim()
  }
  const name = FAMILY_NAMES[family]
  return version === undefined ? name : `${name} ${version}`
}

/** Orders `5.10` after `5.9`; a missing part counts as zero. */
export function compareVersions(left: string, right: string): number {
  const a = left.split('.').map(Number)
  const b = right.split('.').map(Number)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)
    if (difference !== 0) {
      return difference
    }
  }
  return 0
}
