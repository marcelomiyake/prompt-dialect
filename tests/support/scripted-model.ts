import type { CompletionRequest, CompletionResult, LanguageModel } from '../../src/core'

/** A language model that answers from a script and records what it was asked. */
export class ScriptedModel implements LanguageModel {
  readonly requests: CompletionRequest[] = []

  constructor(private readonly answer: (request: CompletionRequest) => CompletionResult) {}

  static replying(text: string): ScriptedModel {
    return new ScriptedModel(() => ({ isAnswered: true, text }))
  }

  static failing(reason: string): ScriptedModel {
    return new ScriptedModel(() => ({ isAnswered: false, reason }))
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    this.requests.push(request)
    return this.answer(request)
  }
}
