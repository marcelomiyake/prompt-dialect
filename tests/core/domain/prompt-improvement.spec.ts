import { describe, expect, it } from 'vitest'
import { PromptImprovement } from '../../../src/core/domain/prompt-improvement'
import { TargetModel } from '../../../src/core/domain/target-model'

const OPUS = TargetModel.parse('claude-opus-5-5')

describe('PromptImprovement', () => {
  it('knows whether it changes the draft', () => {
    expect(PromptImprovement.of('fix it', 'Fix the failing test.', [], OPUS).changesAnything).toBe(true)
    expect(PromptImprovement.of('fix it', ' fix it\n', [], OPUS).changesAnything).toBe(false)
  })

  it('refuses an empty rewrite', () => {
    expect(() => PromptImprovement.of('fix it', '  ', [], OPUS)).toThrow(RangeError)
  })
})
