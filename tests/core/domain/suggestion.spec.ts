import { describe, expect, it } from 'vitest'
import { Suggestion } from '../../../src/core/domain/suggestion'
import { TextChange } from '../../../src/core/domain/text-change'
import { TextSpan } from '../../../src/core/domain/text-span'

const TEXT = 'I has a cat'

describe('Suggestion', () => {
  it('replaces the words under its span', () => {
    const suggestion = Suggestion.create(TextSpan.of(2, 5), 'has', 'have')

    expect(suggestion.id).toBe('2-5')
    expect(suggestion.matches(TEXT)).toBe(true)
    expect(suggestion.applyTo(TEXT)).toBe('I have a cat')
    expect(suggestion.isDeletion).toBe(false)
  })

  it('knows a deletion', () => {
    expect(Suggestion.create(TextSpan.of(6, 8), 'a ', '').isDeletion).toBe(true)
  })

  it('refuses an original that does not fill its span', () => {
    expect(() => Suggestion.create(TextSpan.of(2, 4), 'has', 'have')).toThrow(RangeError)
  })

  it('refuses a replacement equal to the original', () => {
    expect(() => Suggestion.create(TextSpan.of(2, 5), 'has', 'has')).toThrow(RangeError)
  })

  it('refuses to apply to a text it no longer matches', () => {
    const suggestion = Suggestion.create(TextSpan.of(2, 5), 'has', 'have')

    expect(suggestion.matches('I had a cat')).toBe(false)
    expect(suggestion.matches('I')).toBe(false)
    expect(() => suggestion.applyTo('I had a cat')).toThrow(RangeError)
  })

  it('moves with its words through an edit elsewhere', () => {
    const suggestion = Suggestion.create(TextSpan.of(2, 5), 'has', 'have')
    const carried = suggestion.carriedThrough(TextChange.between(TEXT, 'Yes, I has a cat'))

    expect(carried?.span.equals(TextSpan.of(7, 10))).toBe(true)
    expect(carried?.original).toBe('has')
    expect(carried?.replacement).toBe('have')
  })

  it('is dropped by an edit that touches it', () => {
    const suggestion = Suggestion.create(TextSpan.of(2, 5), 'has', 'have')

    expect(suggestion.carriedThrough(TextChange.between(TEXT, 'I hass a cat'))).toBeUndefined()
  })
})
