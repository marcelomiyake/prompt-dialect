/** Why a draft is not sent to a model, or `reviewable` when it is. */
export type DraftVerdict = 'reviewable' | 'empty' | 'too-short' | 'too-long' | 'command' | 'shell'

export type DraftPolicyOptions = {
  /** Fewer words than this is not worth a model call. */
  readonly minWords: number
  /** More characters than this costs too much to check on every pause. */
  readonly maxLength: number
}

export const DEFAULT_DRAFT_POLICY: DraftPolicyOptions = { minWords: 3, maxLength: 6000 }

const WORD = /[\p{L}\p{N}]+/gu

/**
 * Which drafts are worth reviewing: prose a person is writing, not a slash
 * command or a shell line typed into the same box.
 */
export function judgeDraft(text: string, options: DraftPolicyOptions = DEFAULT_DRAFT_POLICY): DraftVerdict {
  const trimmed = text.trim()
  if (trimmed === '') {
    return 'empty'
  }
  if (trimmed.startsWith('/')) {
    return 'command'
  }
  if (trimmed.startsWith('!')) {
    return 'shell'
  }
  if (trimmed.length > options.maxLength) {
    return 'too-long'
  }
  const words = trimmed.match(WORD)?.length ?? 0
  return words < options.minWords ? 'too-short' : 'reviewable'
}
