import { describe, expect, it } from 'vitest'
import { TextSpan } from '../../../src/core/domain/text-span'

describe('TextSpan', () => {
  it('measures a half-open range', () => {
    const span = TextSpan.of(2, 5)

    expect(span.length).toBe(3)
    expect(span.isEmpty).toBe(false)
    expect(TextSpan.of(4, 4).isEmpty).toBe(true)
  })

  it.each([
    [-1, 2],
    [3, 2],
    [0.5, 2],
    [0, Number.NaN],
  ])('refuses [%s, %s)', (start, end) => {
    expect(() => TextSpan.of(start, end)).toThrow(RangeError)
  })

  it('shifts both ends', () => {
    expect(TextSpan.of(2, 5).shift(3).equals(TextSpan.of(5, 8))).toBe(true)
  })

  it('touches a span that overlaps it or shares a boundary', () => {
    const span = TextSpan.of(4, 8)

    expect(span.touches(TextSpan.of(8, 10))).toBe(true)
    expect(span.touches(TextSpan.of(0, 4))).toBe(true)
    expect(span.touches(TextSpan.of(5, 6))).toBe(true)
    expect(span.touches(TextSpan.of(9, 10))).toBe(false)
  })

  it('overlaps only a span that shares a code unit', () => {
    const span = TextSpan.of(4, 8)

    expect(span.overlaps(TextSpan.of(7, 9))).toBe(true)
    expect(span.overlaps(TextSpan.of(8, 9))).toBe(false)
  })

  it('reads its text and knows whether it fits', () => {
    const span = TextSpan.of(6, 11)

    expect(span.sliceOf('hello world')).toBe('world')
    expect(span.isWithin('hello world')).toBe(true)
    expect(span.isWithin('hello')).toBe(false)
  })

  it('compares by value', () => {
    expect(TextSpan.of(1, 2).equals(TextSpan.of(1, 2))).toBe(true)
    expect(TextSpan.of(1, 2).equals(TextSpan.of(1, 3))).toBe(false)
  })
})
