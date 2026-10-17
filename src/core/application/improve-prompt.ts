import { PromptImprovement } from '../domain/prompt-improvement'
import type { PromptingGuideCatalog } from '../domain/prompting-guide'
import type { TargetModel } from '../domain/target-model'
import { DEFAULT_DRAFT_POLICY, judgeDraft, type DraftPolicyOptions, type DraftVerdict } from './draft-policy'
import { draftPrompt, improvementSystem, tagsFor } from './instructions'
import { answerFrom } from './model-answer'
import type { LanguageModel } from './ports/language-model'
import { bulletsOf, textInTag, withoutTagPadding } from './tagged-output'

export type ImprovePromptRequest = {
  readonly draft: string
  readonly target: TargetModel
  /** The tool the prompt is for, as the model should picture it: `Claude Code`. */
  readonly tool: string
  readonly signal?: AbortSignal
}

export type ImprovePromptOutcome =
  | { readonly status: 'improved'; readonly improvement: PromptImprovement }
  | { readonly status: 'unchanged' }
  | { readonly status: 'skipped'; readonly reason: Exclude<DraftVerdict, 'reviewable'> }
  | { readonly status: 'failed'; readonly reason: string }

const MAX_NOTES = 3

/**
 * Use case: rewrite a draft so it follows Anthropic's prompting guidance for
 * the model it is going to, keeping the writer's intent.
 */
export class ImprovePrompt {
  constructor(
    private readonly model: LanguageModel,
    private readonly guides: PromptingGuideCatalog,
    private readonly policy: DraftPolicyOptions = DEFAULT_DRAFT_POLICY,
  ) {}

  async execute(request: ImprovePromptRequest): Promise<ImprovePromptOutcome> {
    const verdict = judgeDraft(request.draft, this.policy)
    if (verdict !== 'reviewable') {
      return { status: 'skipped', reason: verdict }
    }
    const guidance = this.guides.guidanceFor(request.target)
    const tags = tagsFor(request.draft)
    const reply = await answerFrom(this.model, {
      system: improvementSystem(request.target, request.tool, guidance, tags),
      prompt: draftPrompt(request.draft, tags),
      maxTokens: Math.min(32_000, 4_096 + request.draft.length),
      signal: request.signal,
    })
    if (!reply.isAnswered) {
      return { status: 'failed', reason: reply.reason }
    }
    const improved = textInTag(reply.text, tags.improved)
    if (!improved?.trim()) {
      return { status: 'failed', reason: 'the reply held no improved prompt' }
    }
    const notes = bulletsOf(textInTag(reply.text, tags.notes) ?? '').slice(0, MAX_NOTES)
    const improvement = PromptImprovement.of(
      request.draft,
      withoutTagPadding(improved, request.draft),
      notes,
      request.target,
    )
    return improvement.changesAnything ? { status: 'improved', improvement } : { status: 'unchanged' }
  }
}
