import { describe, expect, it } from 'vitest'
import { bandView, previewOf, type BandInput } from '../../../src/adapters/claude-code/presenter'
import { GrammarReview } from '../../../src/core'

const DRAFT = 'Please fix teh login bug before the release'
const REVIEW = GrammarReview.fromRevision(DRAFT, 'Please fix the login bug before the release')

function input(overrides: Partial<BandInput> = {}): BandInput {
  return {
    draft: DRAFT,
    review: REVIEW,
    isReviewFresh: true,
    improvement: null,
    failure: undefined,
    isDismissed: false,
    isEnabled: true,
    targetLabel: 'Opus 5.5',
    columns: 60,
    maxRows: 10,
    isPointerAvailable: true,
    ...overrides,
  }
}

function render(segments: readonly { text: string; tone: string }[]): string {
  return segments
    .map(segment => (segment.tone === 'context' ? segment.text : `[${segment.tone}:${segment.text}]`))
    .join('')
}

describe('bandView', () => {
  it('is hidden while checking is off or the band was dismissed', () => {
    expect(bandView(input({ isEnabled: false })).isVisible).toBe(false)
    expect(bandView(input({ isDismissed: true })).isVisible).toBe(false)
  })

  it('counts a single fix in the singular', () => {
    expect(bandView(input()).status).toBe('1 fix:')
    expect(bandView(input()).hint).toBe('Hover the word to preview its fix, click to apply (or ctrl+x tab, then 1).')
    expect(bandView(input({ isPointerAvailable: false })).hint).toBe('ctrl+x tab, then 1 to apply the fix.')
  })

  it('ignores a review made for another draft', () => {
    const view = bandView(input({ review: GrammarReview.clean('older draft text here') }))

    expect(view.chips).toHaveLength(0)
    expect(view.status).toBe('')
  })

  it('does not claim the draft is clean before a check has run on it', () => {
    expect(bandView(input({ review: GrammarReview.clean(DRAFT), isReviewFresh: false })).status).toBe('')
  })

  it('ignores a rewrite made for another draft', () => {
    const view = bandView(
      input({ improvement: { status: 'ready', draft: 'older', target: 'Opus 5.5', improved: 'x', notes: [] } }),
    )

    expect(view.improvement).toEqual({ kind: 'offer', label: 'Improve for Opus 5.5' })
  })

  it('keeps blank lines of a rewrite', () => {
    const view = bandView(
      input({ improvement: { status: 'ready', draft: DRAFT, target: 'Opus 5.5', improved: 'a\n\nb', notes: [] } }),
    )

    expect(view.improvement).toMatchObject({ kind: 'ready', lines: ['a', '', 'b'], hiddenLines: 0 })
  })
})

describe('previewOf', () => {
  const suggestion = REVIEW.suggestions[0]
  if (suggestion === undefined) throw new Error('expected a suggestion')

  it('shows the fix in its sentence, padded to the width', () => {
    const segments = previewOf(DRAFT, suggestion, 60)

    expect(render(segments).trimEnd()).toBe('Please fix [removed:teh] [added:the] login bug before the release')
    expect(render(segments).length).toBeGreaterThanOrEqual(60)
  })

  it('cuts the context to fit a narrow band', () => {
    expect(render(previewOf(DRAFT, suggestion, 24))).toBe('… fix [removed:teh] [added:the] login bug…')
  })

  it('drops the context when there is no room for it', () => {
    expect(render(previewOf(DRAFT, suggestion, 4))).toBe('[removed:teh] [added:the]')
  })

  it('shows a deletion and keeps line breaks visible', () => {
    const draft = 'Fix the the bug\nnow'
    const deletion = GrammarReview.fromRevision(draft, 'Fix the bug\nnow').suggestions[0]
    if (deletion === undefined) throw new Error('expected a deletion')

    expect(render(previewOf(draft, deletion, 30)).trimEnd()).toBe('Fix the [removed:the ]bug ⏎ now')
  })
})
