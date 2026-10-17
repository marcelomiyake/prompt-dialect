import { compareVersions, type ModelFamily, type TargetModel } from './target-model'

/**
 * What Anthropic's prompting guide for one model (or for all current models)
 * says a prompt written for it should do, as rules a rewrite can follow.
 */
export type PromptingGuide = {
  readonly id: string
  readonly title: string
  readonly source: string
  /** The model lines it covers; empty for the guidance that holds for all. */
  readonly families: readonly ModelFamily[]
  /** The release it was written for, such as `5.5`; absent for the general guide. */
  readonly version?: string
  readonly guidelines: readonly string[]
}

/** The guidance that applies to one target: the general guide and, when known, its model's. */
export type ApplicableGuidance = {
  readonly general: PromptingGuide
  readonly specific: PromptingGuide | undefined
}

/**
 * Every prompting guide the product knows. A new model is a new entry, not a
 * code change: the catalog picks the closest guide for whatever model a tool
 * reports.
 */
export class PromptingGuideCatalog {
  constructor(
    private readonly general: PromptingGuide,
    private readonly guides: readonly PromptingGuide[],
  ) {}

  guidanceFor(target: TargetModel): ApplicableGuidance {
    return { general: this.general, specific: this.specificFor(target) }
  }

  private specificFor(target: TargetModel): PromptingGuide | undefined {
    const family = target.family
    if (family === undefined) {
      return undefined
    }
    const candidates = this.guides
      .filter(guide => guide.families.includes(family) && guide.version !== undefined)
      .toSorted((left, right) => compareVersions(right.version ?? '0', left.version ?? '0'))
    const requested = target.version
    if (requested === undefined) {
      return candidates[0]
    }
    // The guide for that release, else the newest one written before it,
    // else the oldest one there is (a model older than every guide).
    return candidates.find(guide => compareVersions(guide.version ?? '0', requested) <= 0) ?? candidates.at(-1)
  }
}
