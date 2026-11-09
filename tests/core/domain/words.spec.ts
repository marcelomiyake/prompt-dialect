import { describe, expect, it } from 'vitest'
import { piecesOf, wordSegmenter, type WordSegmenter } from '../../../src/core/domain/words'

const RUN = /[\p{L}\p{M}\p{N}]+/gu

function texts(text: string, segmenter?: WordSegmenter | null): string[] {
  return piecesOf(text, RUN, segmenter).map(piece => piece.text)
}

describe('piecesOf', () => {
  it('splits Japanese into words', () => {
    expect(texts('テストを追加してください')).toEqual(['テスト', 'を', '追加', 'し', 'て', 'くだ', 'さい'])
  })

  it('splits Chinese into words', () => {
    expect(texts('我想修改这个函数')).toEqual(['我想', '修改', '这个', '函数'])
  })

  it('splits Thai into words', () => {
    expect(texts('แก้ไขการทดสอบ')).toEqual(['แก้ไข', 'การ', 'ทดสอบ'])
  })

  it('separates a Latin name from the Japanese around it', () => {
    expect(texts('Reactのテスト')).toEqual(['React', 'の', 'テスト'])
  })

  it('leaves runs in spaced scripts as the pattern found them', () => {
    expect(texts('não está aqui')).toEqual(['não', 'está', 'aqui'])
  })

  it('places each word where it lies in the text', () => {
    const text = '修正: 关数を直す'
    for (const piece of piecesOf(text, RUN)) {
      expect(text.slice(piece.start, piece.end)).toBe(piece.text)
    }
  })

  it('keeps each run whole without a segmenter', () => {
    expect(texts('テストを追加して、確認', null)).toEqual(['テストを追加して', '確認'])
  })
})

describe('wordSegmenter', () => {
  it('is missing when the runtime has no Intl or no Segmenter', () => {
    expect(wordSegmenter(undefined)).toBeNull()
    expect(wordSegmenter({})).toBeNull()
  })

  it('splits by word when the runtime has one', () => {
    const segmenter = wordSegmenter(Intl)
    expect(Array.from(segmenter?.segment('我想修改') ?? [], s => s.segment)).toEqual(['我想', '修改'])
  })
})
