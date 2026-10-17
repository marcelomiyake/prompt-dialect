import { describe, expect, it } from 'vitest'
import { bulletsOf, tagAbsentFrom, textInTag, withoutTagPadding } from '../../../src/core/application/tagged-output'

describe('tagAbsentFrom', () => {
  it('keeps the name the text does not hold as a tag', () => {
    expect(tagAbsentFrom('I corrected the notes.', 'corrected')).toBe('corrected')
  })

  it('numbers the name the text holds as an opening or a closing tag', () => {
    expect(tagAbsentFrom('Wrap it in <corrected>', 'corrected')).toBe('corrected_2')
    expect(tagAbsentFrom('end with </corrected> and <corrected_2>', 'corrected')).toBe('corrected_3')
  })
})

describe('textInTag', () => {
  it('reads the text between a pair of tags', () => {
    expect(textInTag('before <a>inside</a> after', 'a')).toBe('inside')
  })

  it('takes the last pair when there are several', () => {
    expect(textInTag('<a>draft</a> then <a>final</a>', 'a')).toBe('final')
  })

  it('answers undefined without a closing or an opening tag', () => {
    expect(textInTag('<a>never closed', 'a')).toBeUndefined()
    expect(textInTag('never opened</a>', 'a')).toBeUndefined()
  })
})

describe('withoutTagPadding', () => {
  it('drops the line breaks just inside the tags', () => {
    expect(withoutTagPadding('\nfixed text\n', 'text')).toBe('fixed text')
    expect(withoutTagPadding('\r\nfixed\r\n', 'text')).toBe('fixed')
  })

  it('keeps them when the original has them too', () => {
    expect(withoutTagPadding('\nfixed text\n', '\ntext\n')).toBe('\nfixed text\n')
  })
})

describe('bulletsOf', () => {
  it('reads the items of a bulleted list', () => {
    expect(bulletsOf('- one\n  * two\n• three\nnot an item\n-\n')).toEqual(['one', 'two', 'three'])
  })
})
