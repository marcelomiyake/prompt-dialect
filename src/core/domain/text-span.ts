/**
 * A half-open range `[start, end)` of UTF-16 code units in a text: the unit
 * every tool's editor uses for offsets, so it crosses adapters unchanged.
 */
export class TextSpan {
  private constructor(
    readonly start: number,
    readonly end: number,
  ) {}

  static of(start: number, end: number): TextSpan {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
      throw new RangeError(`Invalid text span [${start}, ${end})`)
    }
    return new TextSpan(start, end)
  }

  get length(): number {
    return this.end - this.start
  }

  get isEmpty(): boolean {
    return this.start === this.end
  }

  shift(delta: number): TextSpan {
    return TextSpan.of(this.start + delta, this.end + delta)
  }

  /** True when the spans overlap or share a boundary. */
  touches(other: TextSpan): boolean {
    return this.start <= other.end && other.start <= this.end
  }

  overlaps(other: TextSpan): boolean {
    return this.start < other.end && other.start < this.end
  }

  isWithin(text: string): boolean {
    return this.end <= text.length
  }

  sliceOf(text: string): string {
    return text.slice(this.start, this.end)
  }

  equals(other: TextSpan): boolean {
    return this.start === other.start && this.end === other.end
  }
}
