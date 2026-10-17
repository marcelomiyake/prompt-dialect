import type { CompletionRequest, CompletionResult, LanguageModel } from './ports/language-model'

/**
 * `model`'s answer to `request`. A call that rejects (a blocked model, a
 * request the tool refuses to send) is an answer that did not come, so the
 * use cases report it as a failure like any other.
 */
export async function answerFrom(model: LanguageModel, request: CompletionRequest): Promise<CompletionResult> {
  try {
    return await model.complete(request)
  } catch (error) {
    return { isAnswered: false, reason: error instanceof Error ? error.message : 'the model call failed' }
  }
}
