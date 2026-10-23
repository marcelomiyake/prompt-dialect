import { judgeDraft, type DraftVerdict } from '../../core'

/**
 * Claude Code folds a long paste into a placeholder such as
 * `[Pasted text #1 +10 lines]` and keeps the text out of the box, where no mod
 * can read it; the text goes in only as the prompt is sent.
 */
const FOLDED_PASTE = /\[Pasted text #(\d+)(?: \+\d+ lines)?\]/g

/** The numbers of the pastes folded into `draft`, in the order they appear. */
export function foldedPastes(draft: string): string[] {
  return [...draft.matchAll(FOLDED_PASTE)].map(match => `#${match[1]}`)
}

/** The core's verdict on what the person typed around the pastes folded into `draft`. */
export function judgeTypedText(draft: string): DraftVerdict {
  return judgeDraft(draft.replaceAll(FOLDED_PASTE, ' '))
}
