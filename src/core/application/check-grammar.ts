import { GrammarReview } from '../domain/grammar-review'
import { similarity } from '../domain/revision'
import { DEFAULT_DRAFT_POLICY, judgeDraft, type DraftPolicyOptions, type DraftVerdict } from './draft-policy'
import { draftPrompt, grammarSystem, tagsFor } from './instructions'
import { LruCache } from './lru-cache'
import { answerFrom } from './model-answer'
import type { LanguageModel } from './ports/language-model'
import { textInTag, withoutTagPadding } from './tagged-output'

export type CheckGrammarOutcome =
  | { readonly status: 'reviewed'; readonly review: GrammarReview }
  | { readonly status: 'skipped'; readonly reason: Exclude<DraftVerdict, 'reviewable'> }
  | { readonly status: 'failed'; readonly reason: string }

export type CheckGrammarOptions = {
  readonly policy?: DraftPolicyOptions
  /** Below this share of words kept, the reply is a rewrite, not a copy edit. */
  readonly minSimilarity?: number
  /** Reviews already made, shared across instances; a fresh cache of 32 when absent. */
  readonly cache?: LruCache<string, GrammarReview>
}

/**
 * Use case: review a draft for mistakes, as suggestions the writer can take
 * one by one. The model returns a corrected copy; the diff between the two is
 * the review, so suggestions always point at text that is really there.
 */
export class CheckGrammar {
  private readonly policy: DraftPolicyOptions
  private readonly minSimilarity: number
  private readonly cache: LruCache<string, GrammarReview>

  constructor(
    private readonly model: LanguageModel,
    options: CheckGrammarOptions = {},
  ) {
    this.policy = options.policy ?? DEFAULT_DRAFT_POLICY
    this.minSimilarity = options.minSimilarity ?? 0.5
    this.cache = options.cache ?? new LruCache(32)
  }

  async execute(draft: string, signal?: AbortSignal): Promise<CheckGrammarOutcome> {
    const verdict = judgeDraft(draft, this.policy)
    if (verdict !== 'reviewable') {
      return { status: 'skipped', reason: verdict }
    }
    const cached = this.cache.get(draft)
    if (cached !== undefined) {
      return { status: 'reviewed', review: cached }
    }
    const tags = tagsFor(draft)
    const reply = await answerFrom(this.model, {
      system: grammarSystem(tags),
      prompt: draftPrompt(draft, tags),
      maxTokens: maxTokensFor(draft),
      signal,
    })
    if (!reply.isAnswered) {
      return { status: 'failed', reason: reply.reason }
    }
    const corrected = textInTag(reply.text, tags.corrected)
    if (corrected === undefined) {
      return { status: 'failed', reason: 'the reply held no corrected draft' }
    }
    const revised = withoutTagPadding(corrected, draft)
    const review =
      similarity(draft, revised) < this.minSimilarity
        ? GrammarReview.clean(draft)
        : GrammarReview.fromRevision(draft, revised)
    this.cache.set(draft, review)
    return { status: 'reviewed', review }
  }
}

/** Room for a corrected copy of the draft plus the model's thinking. */
function maxTokensFor(draft: string): number {
  return Math.min(16_000, 2_048 + Math.ceil(draft.length / 2))
}
