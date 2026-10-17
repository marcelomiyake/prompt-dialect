import { describe, expect, it } from 'vitest'
import { TextChange } from '../../../src/core/domain/text-change'
import { TextSpan } from '../../../src/core/domain/text-span'

describe('TextChange', () => {
  it('finds an insertion', () => {
    const change = TextChange.between('hello world', 'hello big world')

    expect(change.replaced.equals(TextSpan.of(6, 6))).toBe(true)
    expect(change.insertedLength).toBe(4)
    expect(change.delta).toBe(4)
    expect(change.isNone).toBe(false)
  })

  it('finds a deletion', () => {
    const change = TextChange.between('hello big world', 'hello world')

    expect(change.replaced.equals(TextSpan.of(6, 10))).toBe(true)
    expect(change.insertedLength).toBe(0)
    expect(change.delta).toBe(-4)
  })

  it('does not count a shared character twice when text repeats', () => {
    const change = TextChange.between('aaa', 'aaaa')

    expect(change.replaced).toHaveLength(0)
    expect(change.insertedLength).toBe(1)
  })

  it('reports no change for equal texts', () => {
    expect(TextChange.between('same', 'same').isNone).toBe(true)
  })

  it('carries spans the edit did not touch', () => {
    const change = TextChange.between('one two three four', 'one two 3 four')

    expect(change.carry(TextSpan.of(0, 3))?.equals(TextSpan.of(0, 3))).toBe(true)
    expect(change.carry(TextSpan.of(14, 18))?.equals(TextSpan.of(10, 14))).toBe(true)
    expect(change.carry(TextSpan.of(8, 13))).toBeUndefined()
  })

  it('drops a span the edit only borders', () => {
    const change = TextChange.between('for prompts', 'fork prompts')

    expect(change.carry(TextSpan.of(0, 3))).toBeUndefined()
  })
})
