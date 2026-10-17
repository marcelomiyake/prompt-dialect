/** A small least-recently-used map, so a draft typed back to an earlier state costs no call. */
export class LruCache<K, V> {
  private readonly entries = new Map<K, V>()

  constructor(private readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError(`A cache needs room for at least one entry, not ${capacity}`)
    }
  }

  get(key: K): V | undefined {
    if (!this.entries.has(key)) {
      return undefined
    }
    const value = this.entries.get(key) as V
    this.entries.delete(key)
    this.entries.set(key, value)
    return value
  }

  set(key: K, value: V): void {
    this.entries.delete(key)
    this.entries.set(key, value)
    if (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value as K
      this.entries.delete(oldest)
    }
  }

  get size(): number {
    return this.entries.size
  }
}
