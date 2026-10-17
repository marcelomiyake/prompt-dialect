import { describe, expect, it } from 'vitest'
import { answerFrom } from '../../../src/core/application/model-answer'
import type { LanguageModel } from '../../../src/core'

const REQUEST = { system: 'Be brief.', prompt: 'Hello', maxTokens: 64 }

/** What a tool might reject a call with that is not an Error. */
class Refusal {
  readonly status = 403
}

function rejecting(reason: unknown): LanguageModel {
  return {
    complete: async () => {
      throw reason
    },
  }
}

describe('answerFrom', () => {
  it("passes the model's answer on", async () => {
    const model: LanguageModel = { complete: async () => ({ isAnswered: true, text: 'Hi' }) }

    expect(await answerFrom(model, REQUEST)).toEqual({ isAnswered: true, text: 'Hi' })
  })

  it('reads a rejected call as one that did not answer', async () => {
    expect(await answerFrom(rejecting(new Error('model blocked')), REQUEST)).toEqual({
      isAnswered: false,
      reason: 'model blocked',
    })
    expect(await answerFrom(rejecting(new Refusal()), REQUEST)).toEqual({
      isAnswered: false,
      reason: 'the model call failed',
    })
  })
})
