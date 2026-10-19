// The prompt-dialect mod's $.state contract: plain JSON the host keeps for the
// session, so the band and the prompt decorations survive a hot reload.
// Copied to types/index.d.ts by the build.

export type SuggestionState = {
  start: number
  end: number
  original: string
  replacement: string
}

export type ReviewState = {
  /** The draft the suggestions are offsets into. */
  text: string
  suggestions: SuggestionState[]
  /** True when a check produced it for `text`; false once carried over an edit. */
  isFresh: boolean
}

export type ImprovementState =
  | { status: 'working'; draft: string; target: string }
  | { status: 'ready'; draft: string; target: string; improved: string; notes: string[] }
  | { status: 'unchanged'; draft: string; target: string }
  | { status: 'failed'; draft: string; target: string; message: string }

export type DialectState = {
  /** The prompt box's text as the mod last saw it. */
  draft: string
  review: ReviewState | null
  improvement: ImprovementState | null
  /** The draft the person dismissed the band for. */
  dismissed: string | null
  /** Why the last check failed, for the draft it failed on. */
  failure: { draft: string; message: string } | null
  isEnabled: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'prompt-dialect': {
      session: DialectState
    }
  }
}
