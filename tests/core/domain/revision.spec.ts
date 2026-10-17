import { describe, expect, it } from 'vitest'
import { similarity, suggestionsBetween, unitsOf } from '../../../src/core/domain/revision'

type Fix = { original: string; replacement: string; at: number }

function fixes(original: string, revised: string): Fix[] {
  return suggestionsBetween(original, revised).map(s => ({
    original: s.original,
    replacement: s.replacement,
    at: s.span.start,
  }))
}

function applyAll(original: string, revised: string): string {
  return suggestionsBetween(original, revised).reduceRight((text, s) => s.applyTo(text), original)
}

describe('unitsOf', () => {
  it('splits words and punctuation and skips whitespace', () => {
    expect(unitsOf("It's a well-known bug, isn't it?").map(unit => unit.text)).toEqual([
      "It's",
      'a',
      'well',
      '-',
      'known',
      'bug',
      ',',
      "isn't",
      'it',
      '?',
    ])
  })

  it('keeps letters outside ASCII together', () => {
    expect(unitsOf('não está aqui').map(unit => unit.text)).toEqual(['não', 'está', 'aqui'])
  })
})

describe('suggestionsBetween', () => {
  it('finds the fixes in the sample prompt', () => {
    const original = 'Is it possible to change the prompt window to underline grammar corrections for prompts?'
    const revised = 'Can you change the prompt window to underline grammar corrections in prompts?'

    expect(fixes(original, revised)).toEqual([
      { original: 'Is it possible to', replacement: 'Can you', at: 0 },
      { original: 'for', replacement: 'in', at: original.indexOf(' for ') + 1 },
    ])
    expect(applyAll(original, revised)).toBe(revised)
  })

  it('returns nothing for an unchanged text', () => {
    expect(suggestionsBetween('All good here.', 'All good here.')).toEqual([])
  })

  it('returns nothing for an empty original', () => {
    expect(suggestionsBetween('', 'Something')).toEqual([])
  })

  it('ignores a change of spacing alone', () => {
    expect(suggestionsBetween('one  two', 'one two')).toEqual([])
  })

  it('takes in the next word for an insertion', () => {
    expect(fixes('I want go home', 'I want to go home')).toEqual([{ original: 'go', replacement: 'to go', at: 7 }])
    expect(applyAll('I want go home', 'I want to go home')).toBe('I want to go home')
  })

  it('takes in the previous word for an insertion at the end', () => {
    expect(fixes('Is this ok', 'Is this ok?')).toEqual([{ original: 'ok', replacement: 'ok?', at: 8 }])
  })

  it('makes one fix of two insertions that take in the same word', () => {
    expect(fixes('please fix code', 'please fix the code.')).toEqual([
      { original: 'code', replacement: 'the code.', at: 11 },
    ])
    expect(applyAll('please fix code', 'please fix the code.')).toBe('please fix the code.')
    expect(applyAll('code', 'the code.')).toBe('the code.')
  })

  it('removes a repeated word with its space', () => {
    expect(fixes('the the cat', 'the cat')).toEqual([{ original: 'the ', replacement: '', at: 4 }])
    expect(applyAll('the the cat', 'the cat')).toBe('the cat')
  })

  it('removes a leading word', () => {
    expect(applyAll('So so we start', 'So we start')).toBe('So we start')
  })

  it('removes trailing words', () => {
    expect(applyAll('Fix the bug please please', 'Fix the bug please')).toBe('Fix the bug please')
  })

  it('fixes a misspelling inside a sentence', () => {
    expect(fixes('Please recieve the file', 'Please receive the file')).toEqual([
      { original: 'recieve', replacement: 'receive', at: 7 },
    ])
  })

  it('keeps line breaks the revision keeps', () => {
    const original = 'First line has a eror.\nSecond line is fine.'
    const revised = 'First line has an error.\nSecond line is fine.'

    expect(applyAll(original, revised)).toBe(revised)
  })

  it('falls back to one fix when the texts are too long to diff word by word', () => {
    const original = Array.from({ length: 2100 }, (_, i) => `a${i}`).join(' ')
    const revised = Array.from({ length: 2100 }, (_, i) => `b${i}`).join(' ')

    const found = suggestionsBetween(original, revised)

    expect(found).toHaveLength(1)
    expect(found[0]?.applyTo(original)).toBe(revised)
  })
})

describe('similarity', () => {
  it('is 1 for two texts without words', () => {
    expect(similarity('', '  ')).toBe(1)
  })

  it('is the share of words kept', () => {
    expect(similarity('a b c d', 'a b c e')).toBe(0.75)
    expect(similarity('one two', 'three four')).toBe(0)
  })
})
