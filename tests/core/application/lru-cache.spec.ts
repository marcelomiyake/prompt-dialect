import { describe, expect, it } from 'vitest'
import { LruCache } from '../../../src/core/application/lru-cache'

describe('LruCache', () => {
  it('evicts the least recently used entry', () => {
    const cache = new LruCache<string, number>(2)
    cache.set('a', 1)
    cache.set('b', 2)
    expect(cache.get('a')).toBe(1)

    cache.set('c', 3)

    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('a')).toBe(1)
    expect(cache.get('c')).toBe(3)
    expect(cache.size()).toBe(2)
  })

  it('replaces a value set again', () => {
    const cache = new LruCache<string, number>(2)
    cache.set('a', 1)
    cache.set('a', 2)

    expect(cache.get('a')).toBe(2)
    expect(cache.size()).toBe(1)
  })

  it('keeps a falsy value', () => {
    const cache = new LruCache<string, number>(1)
    cache.set('zero', 0)

    expect(cache.get('zero')).toBe(0)
  })

  it.each([0, -1, 1.5])('refuses a capacity of %s', capacity => {
    expect(() => new LruCache(capacity)).toThrow(RangeError)
  })
})
