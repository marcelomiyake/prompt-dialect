// The core's public surface: what an adapter for any tool builds on.
export { CheckGrammar, type CheckGrammarOptions, type CheckGrammarOutcome } from './application/check-grammar'
export {
  DEFAULT_DRAFT_POLICY,
  judgeDraft,
  type DraftPolicyOptions,
  type DraftVerdict,
} from './application/draft-policy'
export { LruCache } from './application/lru-cache'
export { ImprovePrompt, type ImprovePromptOutcome, type ImprovePromptRequest } from './application/improve-prompt'
export type { CompletionRequest, CompletionResult, LanguageModel } from './application/ports/language-model'
export { GrammarReview } from './domain/grammar-review'
export { PromptImprovement } from './domain/prompt-improvement'
export { PromptingGuideCatalog, type ApplicableGuidance, type PromptingGuide } from './domain/prompting-guide'
export { GENERAL_GUIDE, MODEL_GUIDES, defaultPromptingGuides } from './domain/prompting-guides'
export { Suggestion } from './domain/suggestion'
export { TargetModel, compareVersions, type ModelFamily } from './domain/target-model'
export { TextChange } from './domain/text-change'
export { TextSpan } from './domain/text-span'
