import { TextChange } from './text-change'
import { TextSpan } from './text-span'

/**
 * One proposed fix to a draft: replace the text under `span`, which reads
 * `original`, with `replacement`.
 */
export class Suggestion {
  private constructor(
    readonly span: TextSpan,
    readonly original: string,
    readonly replacement: string,
  ) {}

  static create(span: TextSpan, original: string, replacement: string): Suggestion {
    if (original.length !== span.length) {
      throw new RangeError(`"${original}" does not fill a span of ${span.length} code units`)
    }
    if (original === replacement) {
      throw new RangeError(`A suggestion must change "${original}"`)
    }
    return new Suggestion(span, original, replacement)
  }

  /** Stable while the suggestion stays where it is; offsets make it unique per draft. */
  get id(): string {
    return `${this.span.start}-${this.span.end}`
  }

  get isDeletion(): boolean {
    return this.replacement.length === 0
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

  /** The same suggestion after `change`, or undefined when the change touched it. */
  carriedThrough(change: TextChange): Suggestion | undefined {
    const span = change.carry(this.span)
    return span === undefined ? undefined : new Suggestion(span, this.original, this.replacement)
  }
}
