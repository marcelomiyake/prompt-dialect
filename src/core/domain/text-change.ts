import { TextSpan } from './text-span'

/**
 * The single contiguous edit that turns one text into another, found by
 * trimming their common prefix and suffix. Editors report edits in their own
 * shapes; comparing the texts before and after works for all of them.
 */
export class TextChange {
  private constructor(
    /** The span of the text before the edit that the edit replaced. */
    readonly replaced: TextSpan,
    /** How many code units the edit put in its place. */
    readonly insertedLength: number,
  ) {}

  static between(before: string, after: string): TextChange {
    const limit = Math.min(before.length, after.length)
    let prefix = 0
    while (prefix < limit && before.charCodeAt(prefix) === after.charCodeAt(prefix)) {
      prefix += 1
    }
    let suffix = 0
    while (
      suffix < limit - prefix &&
      before.charCodeAt(before.length - 1 - suffix) === after.charCodeAt(after.length - 1 - suffix)
    ) {
      suffix += 1
    }
    const replaced = TextSpan.of(prefix, before.length - suffix)
    return new TextChange(replaced, after.length - suffix - prefix)
  }

  get isNone(): boolean {
    return this.replaced.isEmpty && this.insertedLength === 0
  }

  get delta(): number {
    return this.insertedLength - this.replaced.length
  }

  /**
   * Where `span` of the text before the edit lies in the text after it, or
   * undefined when the edit touched it.
   */
  carry(span: TextSpan): TextSpan | undefined {
    if (span.touches(this.replaced)) {
      return undefined
    }
    return span.end <= this.replaced.start ? span : span.shift(this.delta)
  }
}
