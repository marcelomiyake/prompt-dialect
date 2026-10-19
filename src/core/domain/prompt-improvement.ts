import type { TargetModel } from './target-model'

/** A draft rewritten to suit the model it is written for, with what changed and why. */
export class PromptImprovement {
  readonly changesAnything: boolean

  private constructor(
    readonly original: string,
    readonly improved: string,
    readonly notes: readonly string[],
    readonly target: TargetModel,
  ) {
    this.changesAnything = improved.trim() !== original.trim()
  }

  static of(original: string, improved: string, notes: readonly string[], target: TargetModel): PromptImprovement {
    if (improved.trim() === '') {
      throw new RangeError('An improved prompt cannot be empty')
    }
    return new PromptImprovement(original, improved, notes, target)
  }
}
