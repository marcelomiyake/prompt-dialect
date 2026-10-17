import { describe, expect, it } from 'vitest'
import { judgeDraft } from '../../../src/core/application/draft-policy'

describe('judgeDraft', () => {
  it.each([
    ['', 'empty'],
    ['   \n', 'empty'],
    ['/compact keep the plan', 'command'],
    ['!npm test -- --watch', 'shell'],
    ['fix it', 'too-short'],
    ['Please fix the failing test', 'reviewable'],
    ['Corrija o teste que falha', 'reviewable'],
  ])('judges %j as %s', (text, verdict) => {
    expect(judgeDraft(text)).toBe(verdict)
  })

  it('refuses a draft longer than the policy allows', () => {
    expect(judgeDraft('word '.repeat(20), { minWords: 3, maxLength: 50 })).toBe('too-long')
  })
})
