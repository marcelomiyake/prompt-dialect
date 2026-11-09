import { TextChange } from './text-change'
import { TextSpan } from './text-span'

/**
 * One proposed fix to a draft: replace the text under `span`, which reads
 * `original`, with `replacement`.
 */
export class Suggestion {
  /** Stable while the suggestion stays where it is; offsets make it unique per draft. */
  readonly id: string
  readonly isDeletion: boolean

  private constructor(
    readonly span: TextSpan,
    readonly original: string,
    readonly replacement: string,
  ) {
    this.id = `${span.start}-${span.end}`
    this.isDeletion = replacement.length === 0
  }

  static create(span: TextSpan, original: string, replacement: string): Suggestion {
    if (original.length !== span.length) {
      throw new RangeError(`"${original}" does not fill a span of ${span.length} code units`)
    }
    if (original === replacement) {
      throw new RangeError(`A suggestion must change "${original}"`)
    }
    return new Suggestion(span, original, replacement)
  }

  matches(text: string): boolean {
    return this.span.isWithin(text) && this.span.sliceOf(text) === this.original
  }

  applyTo(text: string): string {
    if (!this.matches(text)) {
      throw new RangeError(`Suggestion ${this.id} no longer matches the text`)
    }
    return text.slice(0, this.span.start) + this.replacement + text.slice(this.span.end)
  }

  /**
   * Where a caret at `caret` in the text before this fix stands after it:
   * in place before the fix, past the replacement when it stood inside the
   * replaced words, and moved with the text after them otherwise.
   */
  carryCaret(caret: number): number {
    if (caret <= this.span.start) {
      return caret
    }
    if (caret < this.span.end) {
      return this.span.start + this.replacement.length
    }
    return caret + this.replacement.length - this.span.length
  }

  /** The same suggestion after `change`, or undefined when the change touched it. */
  carriedThrough(change: TextChange): Suggestion | undefined {
    const span = change.carry(this.span)
    return span === undefined ? undefined : new Suggestion(span, this.original, this.replacement)
  }
}
