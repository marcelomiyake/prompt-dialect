import { describe, expect, it } from 'vitest'
import { decorationsFor } from '../../../src/adapters/claude-code/decorations'
import { reviewFromState, reviewToState } from '../../../src/adapters/claude-code/review-state'
import { DEFAULT_SETTINGS, settingsFrom } from '../../../src/adapters/claude-code/settings'
import { GrammarReview } from '../../../src/core'

describe('settingsFrom', () => {
  it('fills in the defaults', () => {
    expect(settingsFrom({})).toEqual(DEFAULT_SETTINGS)
  })

  it('reads the options the person set', () => {
    expect(
      settingsFrom({ checkAsYouType: false, grammarModel: ' haiku ', improvementModel: 'sonnet', debounceMs: 1500.4 }),
    ).toEqual({ checkAsYouType: false, grammarModel: 'haiku', improvementModel: 'sonnet', debounceMs: 1500 })
  })

  it('ignores values of the wrong kind and clamps the pause', () => {
    expect(settingsFrom({ checkAsYouType: 'yes', grammarModel: '  ', debounceMs: Number.NaN })).toEqual(
      DEFAULT_SETTINGS,
    )
    expect(settingsFrom({ debounceMs: 1 }).debounceMs).toBe(250)
    expect(settingsFrom({ debounceMs: 99_999 }).debounceMs).toBe(10_000)
  })
})

describe('review state', () => {
  it('round-trips a review through JSON', () => {
    const review = GrammarReview.fromRevision('I has a cat', 'I have a cat')

    const state = JSON.parse(JSON.stringify(reviewToState(review, true)))
    const back = reviewFromState(state)

    expect(state).toEqual({
      text: 'I has a cat',
      isFresh: true,
      suggestions: [{ start: 2, end: 5, original: 'has', replacement: 'have' }],
    })
    expect(back.acceptAll().text).toBe('I have a cat')
  })

  it('drops entries that no longer make a suggestion', () => {
    const back = reviewFromState({
      text: 'I has a cat',
      isFresh: false,
      suggestions: [
        { start: 2, end: 5, original: 'has', replacement: 'has' },
        { start: 5, end: 2, original: 'x', replacement: 'y' },
        { start: 2, end: 5, original: 'has', replacement: 'have' },
      ],
    })

    expect(back.suggestions).toHaveLength(1)
  })
})

describe('decorationsFor', () => {
  it('underlines a replacement and strikes through a deletion', () => {
    const review = GrammarReview.fromRevision('the the cat has a hat', 'the cat had a hat')

    expect(decorationsFor(review)).toEqual([
      { start: 4, end: 8, underline: true, color: 'error', strikethrough: true },
      { start: 12, end: 15, underline: true, color: 'error' },
    ])
  })
})
