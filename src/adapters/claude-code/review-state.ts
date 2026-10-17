import { GrammarReview, Suggestion, TextSpan } from '../../core'
import type { ReviewState } from './plugin-state'

/** The review as the JSON the host keeps in `$.state`. */
export function reviewToState(review: GrammarReview, isFresh: boolean): ReviewState {
  return {
    text: review.text,
    isFresh,
    suggestions: review.suggestions.map(suggestion => ({
      start: suggestion.span.start,
      end: suggestion.span.end,
      original: suggestion.original,
      replacement: suggestion.replacement,
    })),
  }
}

/** The review back from `$.state`; entries that no longer fit the text are dropped. */
export function reviewFromState(state: ReviewState): GrammarReview {
  const suggestions = state.suggestions.flatMap(entry => {
    try {
      return [Suggestion.create(TextSpan.of(entry.start, entry.end), entry.original, entry.replacement)]
    } catch {
      return []
    }
  })
  return GrammarReview.of(state.text, suggestions)
}
