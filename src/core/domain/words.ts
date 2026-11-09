/** A piece of a text, where it lies in that text. */
export type Piece = { readonly text: string; readonly start: number; readonly end: number }

/** What the core needs of `Intl.Segmenter`: the pieces of a text, each with where it starts. */
export type WordSegmenter = {
  segment(text: string): Iterable<{ readonly segment: string; readonly index: number }>
}

/** Scripts written without spaces between words, which only a dictionary can split. */
const UNSPACED = /[\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}\p{scx=Thai}\p{scx=Lao}\p{scx=Khmer}\p{scx=Myanmar}]/u

/**
 * A word segmenter from `intl`, or `null` when the runtime has none.
 * The runtime's dictionaries know Japanese, Chinese, Thai and the like
 * whatever the locale, so no locale is asked for.
 */
export function wordSegmenter(intl: Partial<typeof Intl> | undefined): WordSegmenter | null {
  return intl?.Segmenter === undefined ? null : new intl.Segmenter(undefined, { granularity: 'word' })
}

const RUNTIME_SEGMENTER = wordSegmenter(globalThis.Intl)

/**
 * The matches of `pattern` (a global regular expression) in `text`, with
 * each match written in a script that has no spaces split into its words,
 * so a Japanese or Chinese sentence is read as words, not as one run.
 *
 * Without a segmenter, the matches are returned whole.
 */
export function piecesOf(text: string, pattern: RegExp, segmenter: WordSegmenter | null = RUNTIME_SEGMENTER): Piece[] {
  return Array.from(text.matchAll(pattern), (match): Piece[] => {
    const piece = { text: match[0], start: match.index, end: match.index + match[0].length }
    return segmenter !== null && UNSPACED.test(piece.text) ? split(piece, segmenter) : [piece]
  }).flat()
}

function split(piece: Piece, segmenter: WordSegmenter): Piece[] {
  return Array.from(segmenter.segment(piece.text), ({ segment, index }) => ({
    text: segment,
    start: piece.start + index,
    end: piece.start + index + segment.length,
  }))
}
