import { judgeDraft, type GrammarReview, type Suggestion } from '../../core'
import type { ImprovementState } from './plugin-state'

/** A run of preview text: unchanged context, words a fix removes, or words it adds. */
export type Segment = { readonly text: string; readonly tone: 'context' | 'removed' | 'added' }

export type ChipView = {
  readonly id: string
  /** The hover group that ties the chip to its preview card. */
  readonly scope: string
  readonly hotkey: string | undefined
  readonly label: string
  readonly preview: readonly Segment[]
}

export type ImprovementView =
  | { readonly kind: 'offer'; readonly label: string }
  | { readonly kind: 'working'; readonly label: string }
  | {
      readonly kind: 'ready'
      readonly title: string
      readonly lines: readonly string[]
      readonly hiddenLines: number
      readonly notes: readonly string[]
    }
  | { readonly kind: 'message'; readonly text: string }

export type BandView = {
  readonly isVisible: boolean
  /** One dim line about the check: a count, all clear, or why it failed. */
  readonly status: string
  readonly chips: readonly ChipView[]
  readonly hint: string
  readonly improvement: ImprovementView
}

export type BandInput = {
  readonly draft: string
  readonly review: GrammarReview | undefined
  readonly isReviewFresh: boolean
  readonly improvement: ImprovementState | null
  readonly failure: string | undefined
  readonly isDismissed: boolean
  readonly isEnabled: boolean
  readonly targetLabel: string
  /** The cells the band lays its tree out in. */
  readonly columns: number
  readonly maxRows: number
  readonly isPointerAvailable: boolean
}

const HIDDEN: BandView = {
  isVisible: false,
  status: '',
  chips: [],
  hint: '',
  improvement: { kind: 'message', text: '' },
}
const MAX_HOTKEYS = 9
const ELLIPSIS = '…'

/** What the band above the prompt shows for the draft as it stands. */
export function bandView(input: BandInput): BandView {
  if (!input.isEnabled || input.isDismissed || judgeDraft(input.draft) !== 'reviewable') {
    return HIDDEN
  }
  const review = input.review?.isFor(input.draft) ? input.review : undefined
  const chips = (review?.suggestions ?? []).map((suggestion, index) =>
    chipFor(input.draft, suggestion, index, input.columns),
  )
  return {
    isVisible: true,
    status: statusOf(review, input.isReviewFresh, input.failure),
    chips,
    hint: chips.length === 0 ? '' : hintFor(input.isPointerAvailable, chips.length),
    improvement: improvementViewOf(input),
  }
}

function statusOf(review: GrammarReview | undefined, isFresh: boolean, failure: string | undefined): string {
  if (review?.hasSuggestions) {
    const count = review.suggestions.length
    return `${count} ${count === 1 ? 'fix' : 'fixes'}:`
  }
  if (failure !== undefined) {
    return `Check failed: ${failure}`
  }
  return review !== undefined && isFresh ? 'No issues found' : ''
}

function hintFor(isPointerAvailable: boolean, count: number): string {
  if (count === 1) {
    return isPointerAvailable
      ? 'Hover the word to preview its fix, click to apply (or ctrl+x tab, then 1).'
      : 'ctrl+x tab, then 1 to apply the fix.'
  }
  const keys = `1-${Math.min(count, MAX_HOTKEYS)}`
  return isPointerAvailable
    ? `Hover a word to preview its fix, click to apply (or ctrl+x tab, then ${keys}).`
    : `ctrl+x tab, then ${keys} to apply a fix; a to apply all.`
}

function chipFor(draft: string, suggestion: Suggestion, index: number, columns: number): ChipView {
  return {
    id: suggestion.id,
    scope: `pd-${suggestion.id}`,
    hotkey: index < MAX_HOTKEYS ? String(index + 1) : undefined,
    label: oneLine(suggestion.original),
    preview: previewOf(draft, suggestion, columns),
  }
}

/**
 * The fix in its sentence, as a card shows it: the context on either side
 * cut to fit `columns`, the removed words, then the words that replace them.
 * Padded with spaces to the full width, so the card covers what is under it.
 */
export function previewOf(draft: string, suggestion: Suggestion, columns: number): Segment[] {
  const removed = oneLine(suggestion.original)
  const added = oneLine(suggestion.replacement)
  const change: Segment[] =
    added === ''
      ? [{ text: removed, tone: 'removed' }]
      : [
          { text: removed, tone: 'removed' },
          { text: ' ', tone: 'context' },
          { text: added, tone: 'added' },
        ]
  const changeWidth = change.reduce((width, segment) => width + segment.text.length, 0)
  const room = Math.max(0, columns - changeWidth)
  const before = tail(oneLine(draft.slice(0, suggestion.span.start)), Math.floor(room * 0.4))
  const after = head(oneLine(draft.slice(suggestion.span.end)), room - before.length)
  const segments: Segment[] = [{ text: before, tone: 'context' }, ...change, { text: after, tone: 'context' }]
  const used = segments.reduce((width, segment) => width + segment.text.length, 0)
  segments.push({ text: ' '.repeat(Math.max(0, columns - used)), tone: 'context' })
  return segments.filter(segment => segment.text !== '')
}

function improvementViewOf(input: BandInput): ImprovementView {
  const state = input.improvement?.draft === input.draft ? input.improvement : null
  const offer: ImprovementView = { kind: 'offer', label: `Improve for ${input.targetLabel}` }
  switch (state?.status) {
    case 'working':
      return { kind: 'working', label: `Rewriting for ${state.target}${ELLIPSIS}` }
    case 'ready': {
      const room = Math.max(3, input.maxRows - 4)
      const lines = state.improved.split('\n')
      return {
        kind: 'ready',
        title: `Suggested prompt for ${state.target}:`,
        lines: lines.slice(0, room),
        hiddenLines: Math.max(0, lines.length - room),
        notes: state.notes,
      }
    }
    case 'unchanged':
      return { kind: 'message', text: `The prompt already reads well for ${state.target}.` }
    case 'failed':
      return { kind: 'message', text: `Could not rewrite it: ${state.message}` }
    default:
      return offer
  }
}

function oneLine(text: string): string {
  return text.replaceAll(/\r?\n/g, ' ⏎ ')
}

function head(text: string, width: number): string {
  if (text.length <= width) {
    return text
  }
  return width <= 0 ? '' : text.slice(0, width - 1) + ELLIPSIS
}

function tail(text: string, width: number): string {
  if (text.length <= width) {
    return text
  }
  return width <= 0 ? '' : ELLIPSIS + text.slice(text.length - width + 1)
}
