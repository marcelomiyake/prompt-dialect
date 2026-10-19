import { suggestionsBetween } from './revision'
import { Suggestion } from './suggestion'
import { TextChange } from './text-change'

/**
 * The fixes proposed for one draft. It stays consistent with the draft it is
 * for: suggestions are kept in order, never overlap, and each still reads
 * what it proposes to replace.
 */
export class GrammarReview {
  readonly hasSuggestions: boolean

  private constructor(
    readonly text: string,
    readonly suggestions: readonly Suggestion[],
  ) {
    this.hasSuggestions = suggestions.length > 0
  }

  static of(text: string, suggestions: readonly Suggestion[]): GrammarReview {
    const ordered = suggestions
      .filter(suggestion => suggestion.matches(text))
      .toSorted((left, right) => left.span.start - right.span.start)
    const kept: Suggestion[] = []
    for (const suggestion of ordered) {
      if (!kept.at(-1)?.span.overlaps(suggestion.span)) {
        kept.push(suggestion)
      }
    }
    return new GrammarReview(text, kept)
  }

  /** The review that turns `text` into `revised`, a corrected copy of it. */
  static fromRevision(text: string, revised: string): GrammarReview {
    return GrammarReview.of(text, suggestionsBetween(text, revised))
  }

  static clean(text: string): GrammarReview {
    return new GrammarReview(text, [])
  }

  isFor(text: string): boolean {
    return this.text === text
  }

  find(id: string): Suggestion | undefined {
    return this.suggestions.find(suggestion => suggestion.id === id)
  }

  /** The draft with suggestion `id` applied, and the review of what remains. */
  accept(id: string): GrammarReview {
    const suggestion = this.find(id)
    if (suggestion === undefined) {
      return this
    }
    return this.rebase(suggestion.applyTo(this.text))
  }

  /** The draft with every suggestion applied: a review with nothing left. */
  acceptAll(): GrammarReview {
    const text = this.suggestions.reduceRight((draft, suggestion) => suggestion.applyTo(draft), this.text)
    return GrammarReview.clean(text)
  }

  dismiss(id: string): GrammarReview {
    return new GrammarReview(
      this.text,
      this.suggestions.filter(suggestion => suggestion.id !== id),
    )
  }

  /**
   * This review carried over to `text`, the draft after the writer edited it:
   * suggestions the edit did not touch move with their words, the rest drop.
   */
  rebase(text: string): GrammarReview {
    if (text === this.text) {
      return this
    }
    const change = TextChange.between(this.text, text)
    const carried = this.suggestions
      .map(suggestion => suggestion.carriedThrough(change))
      .filter((suggestion): suggestion is Suggestion => suggestion !== undefined)
    return GrammarReview.of(text, carried)
  }
}
