/**
 * The one thing the core needs from a tool: a text completion. Each adapter
 * answers it with whatever the tool offers (Claude Code's `$.model.complete`,
 * an API client, an IDE's language-model API).
 */
export interface LanguageModel {
  complete(request: CompletionRequest): Promise<CompletionResult>
}

export type CompletionRequest = {
  readonly system: string
  readonly prompt: string
  /** The reply's token cap, room for the model's thinking included. */
  readonly maxTokens: number
  readonly signal?: AbortSignal
}

export type CompletionResult =
  { readonly isAnswered: true; readonly text: string } | { readonly isAnswered: false; readonly reason: string }
