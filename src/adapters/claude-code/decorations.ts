import type { PromptDecoration } from 'claude-code'
import type { GrammarReview } from '../../core'

/** The underlines the prompt box paints under each word a suggestion would change. */
export function decorationsFor(review: GrammarReview): PromptDecoration[] {
  return review.suggestions.map(suggestion => ({
    start: suggestion.span.start,
    end: suggestion.span.end,
    underline: true,
    color: 'error',
    ...(suggestion.isDeletion ? { strikethrough: true } : {}),
  }))
}
