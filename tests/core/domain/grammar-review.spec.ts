import { describe, expect, it } from 'vitest'
import { GrammarReview } from '../../../src/core/domain/grammar-review'
import { Suggestion } from '../../../src/core/domain/suggestion'
import { TextSpan } from '../../../src/core/domain/text-span'

const DRAFT = 'Is it possible to fix bug for prompts?'
const REVISED = 'Can you fix the bug in prompts?'

function suggestion(start: number, end: number, original: string, replacement: string): Suggestion {
  return Suggestion.create(TextSpan.of(start, end), original, replacement)
}

describe('GrammarReview', () => {
  it('is built from a corrected copy of the draft', () => {
    const review = GrammarReview.fromRevision(DRAFT, REVISED)

    expect(review.isFor(DRAFT)).toBe(true)
    expect(review.hasSuggestions).toBe(true)
    expect(review.suggestions.map(s => [s.original, s.replacement])).toEqual([
      ['Is it possible to', 'Can you'],
      ['bug', 'the bug'],
      ['for', 'in'],
    ])
  })

  it('takes the whole revision when every fix is applied', () => {
    const review = GrammarReview.fromRevision('please fix code', 'please fix the code.')

    expect(review.acceptAll().text).toBe('please fix the code.')
  })

  it('keeps suggestions ordered, matching and apart', () => {
    const text = 'aa bb cc'
    const review = GrammarReview.of(text, [
      suggestion(6, 8, 'cc', 'CC'),
      suggestion(0, 2, 'aa', 'AA'),
      suggestion(1, 4, 'a b', 'A B'),
      suggestion(3, 5, 'xx', 'XX'),
    ])

    expect(review.suggestions.map(s => s.original)).toEqual(['aa', 'cc'])
  })

  it('is clean when there is nothing to fix', () => {
    const review = GrammarReview.clean('Fine.')

    expect(review.hasSuggestions).toBe(false)
    expect(review.acceptAll().text).toBe('Fine.')
  })

  it('accepts one suggestion and keeps the rest in place', () => {
    const review = GrammarReview.fromRevision(DRAFT, REVISED)
    const first = review.suggestions[0]
    if (first === undefined) throw new Error('expected a suggestion')

    const after = review.accept(first.id)

    expect(after.text).toBe('Can you fix bug for prompts?')
    expect(after.suggestions.map(s => s.original)).toEqual(['bug', 'for'])
    expect(after.acceptAll().text).toBe(REVISED)
  })

  it('ignores an unknown suggestion', () => {
    const review = GrammarReview.fromRevision(DRAFT, REVISED)

    expect(review.accept('nope')).toBe(review)
    expect(review.find('nope')).toBeUndefined()
  })

  it('accepts every suggestion at once', () => {
    expect(GrammarReview.fromRevision(DRAFT, REVISED).acceptAll().text).toBe(REVISED)
  })

  it('dismisses one suggestion', () => {
    const review = GrammarReview.fromRevision(DRAFT, REVISED)
    const last = review.suggestions.at(-1)
    if (last === undefined) throw new Error('expected a suggestion')

    expect(review.dismiss(last.id).suggestions).toHaveLength(2)
  })

  it('drops the suggestions an edit touched and moves the ones after it', () => {
    const review = GrammarReview.fromRevision(DRAFT, REVISED)
    const edited = DRAFT.replace('bug', 'bugs')

    const carried = review.rebase(edited)

    expect(carried.isFor(edited)).toBe(true)
    expect(carried.suggestions.map(s => s.original)).toEqual(['Is it possible to', 'for'])
    expect(carried.suggestions.every(s => s.matches(edited))).toBe(true)
  })

  it('keeps every suggestion an edit between them does not touch', () => {
    const review = GrammarReview.fromRevision(DRAFT, REVISED)
    const edited = DRAFT.replace('fix', 'repair')

    expect(review.rebase(edited).acceptAll().text).toBe('Can you repair the bug in prompts?')
  })

  it('is unchanged by a rebase onto the same text', () => {
    const review = GrammarReview.fromRevision(DRAFT, REVISED)

    expect(review.rebase(DRAFT)).toBe(review)
  })
})
