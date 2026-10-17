import { Suggestion } from './suggestion'
import { TextSpan } from './text-span'

/** A word or a punctuation mark of a text, where it lies in that text. */
type Unit = { readonly text: string; readonly start: number; readonly end: number }

type Operation =
  | { readonly kind: 'equal'; readonly before: number; readonly after: number }
  | { readonly kind: 'delete'; readonly before: number }
  | { readonly kind: 'insert'; readonly after: number }

/** A maximal run of changed units, with the unchanged unit on either side. */
type Hunk = {
  readonly beforeAnchor: { readonly before: number; readonly after: number } | undefined
  readonly afterAnchor: { readonly before: number; readonly after: number } | undefined
}

/** Both texts, each with its units. */
type Texts = {
  readonly original: string
  readonly revised: string
  readonly before: readonly Unit[]
  readonly after: readonly Unit[]
}

const UNIT = /[\p{L}\p{N}_]+(?:['’][\p{L}\p{N}_]+)*|[^\s\p{L}\p{N}_]/gu
const WHITESPACE = /\s/
/** Past this many cells the diff falls back to one hunk around the change. */
const MAX_DIFF_CELLS = 4_000_000

export function unitsOf(text: string): Unit[] {
  return Array.from(text.matchAll(UNIT), match => ({
    text: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }))
}

/**
 * The share of units the two texts have in common, from 0 (nothing) to 1
 * (the same words in the same order).
 */
export function similarity(original: string, revised: string): number {
  const before = unitsOf(original)
  const after = unitsOf(revised)
  const longest = Math.max(before.length, after.length)
  if (longest === 0) {
    return 1
  }
  const equal = diffUnits(before, after).filter(op => op.kind === 'equal').length
  return equal / longest
}

/**
 * The suggestions that turn `original` into `revised`, one per run of
 * changed words, each spanning whole words of `original` so it can be shown.
 *
 * Whitespace between unchanged words is never a suggestion of its own: a
 * copy edit that only respaces is not worth interrupting the writer for.
 */
export function suggestionsBetween(original: string, revised: string): Suggestion[] {
  const before = unitsOf(original)
  const after = unitsOf(revised)
  if (before.length === 0) {
    return []
  }
  return editsOf(hunksOf(diffUnits(before, after)), { original, revised, before, after })
    .map(edit => suggestionOf(edit, original))
    .filter((suggestion): suggestion is Suggestion => suggestion !== undefined)
}

function diffUnits(before: readonly Unit[], after: readonly Unit[]): Operation[] {
  let prefix = 0
  while (prefix < before.length && prefix < after.length && before[prefix]?.text === after[prefix]?.text) {
    prefix += 1
  }
  let suffix = 0
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix]?.text === after[after.length - 1 - suffix]?.text
  ) {
    suffix += 1
  }
  const head: Operation[] = range(0, prefix).map(i => ({ kind: 'equal', before: i, after: i }))
  const tail: Operation[] = range(0, suffix).map(i => ({
    kind: 'equal',
    before: before.length - suffix + i,
    after: after.length - suffix + i,
  }))
  const middle = diffMiddle(before, after, prefix, before.length - suffix, after.length - suffix)
  return [...head, ...middle, ...tail]
}

/** A longest-common-subsequence diff of `before[from, beforeEnd)` against `after[from, afterEnd)`. */
function diffMiddle(
  before: readonly Unit[],
  after: readonly Unit[],
  from: number,
  beforeEnd: number,
  afterEnd: number,
): Operation[] {
  const rows = beforeEnd - from
  const columns = afterEnd - from
  if (rows * columns > MAX_DIFF_CELLS) {
    return [
      ...range(from, beforeEnd).map((i): Operation => ({ kind: 'delete', before: i })),
      ...range(from, afterEnd).map((j): Operation => ({ kind: 'insert', after: j })),
    ]
  }
  const isSame = (i: number, j: number): boolean => before[from + i]?.text === after[from + j]?.text
  const longest = lcsLengths(rows, columns, isSame)
  const operations: Operation[] = []
  let i = 0
  let j = 0
  while (i < rows || j < columns) {
    if (i < rows && j < columns && isSame(i, j)) {
      operations.push({ kind: 'equal', before: from + i, after: from + j })
      i += 1
      j += 1
    } else if (j === columns || (i < rows && longest(i + 1, j) >= longest(i, j + 1))) {
      operations.push({ kind: 'delete', before: from + i })
      i += 1
    } else {
      operations.push({ kind: 'insert', after: from + j })
      j += 1
    }
  }
  return operations
}

/** The length of the longest common subsequence of every pair of suffixes, as a lookup. */
function lcsLengths(
  rows: number,
  columns: number,
  isSame: (i: number, j: number) => boolean,
): (i: number, j: number) => number {
  const width = columns + 1
  const lengths = new Uint32Array((rows + 1) * width)
  const at = (i: number, j: number): number => lengths[i * width + j] ?? 0
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = columns - 1; j >= 0; j -= 1) {
      lengths[i * width + j] = isSame(i, j) ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1))
    }
  }
  return at
}

function hunksOf(operations: readonly Operation[]): Hunk[] {
  const hunks: Hunk[] = []
  let anchor: Hunk['beforeAnchor']
  let isOpen = false
  for (const op of operations) {
    if (op.kind === 'equal') {
      const here = { before: op.before, after: op.after }
      if (isOpen) {
        hunks.push({ beforeAnchor: anchor, afterAnchor: here })
        isOpen = false
      }
      anchor = here
    } else {
      isOpen = true
    }
  }
  if (isOpen) {
    hunks.push({ beforeAnchor: anchor, afterAnchor: undefined })
  }
  return hunks
}

/** A replacement of `[start, end)` of the original text. */
type Edit = { readonly start: number; readonly end: number; readonly replacement: string }

/**
 * One edit per hunk, in order. Hunks whose edits would overlap, as two
 * insertions widened into the same word do, become one edit that makes both
 * changes, so taking every suggestion still gives the whole revision.
 */
function editsOf(hunks: readonly Hunk[], texts: Texts): Edit[] {
  const kept: { readonly hunk: Hunk; readonly edit: Edit }[] = []
  for (const hunk of hunks) {
    const edit = editOf(hunk, texts)
    const last = kept.at(-1)
    if (last !== undefined && overlap(last.edit, edit)) {
      const joined: Hunk = { beforeAnchor: last.hunk.beforeAnchor, afterAnchor: hunk.afterAnchor }
      kept[kept.length - 1] = { hunk: joined, edit: editOf(joined, texts) }
    } else {
      kept.push({ hunk, edit })
    }
  }
  return kept.map(entry => entry.edit)
}

function editOf(hunk: Hunk, texts: Texts): Edit {
  return widenInsertion(withoutSharedSpace(editFor(hunk, texts), texts.original), hunk, texts)
}

function overlap(left: Edit, right: Edit): boolean {
  return left.start < right.end && right.start < left.end
}

function suggestionOf(edit: Edit, original: string): Suggestion | undefined {
  const span = TextSpan.of(edit.start, edit.end)
  const text = span.sliceOf(original)
  return text === edit.replacement || span.isEmpty ? undefined : Suggestion.create(span, text, edit.replacement)
}

/** Everything between the unchanged units on either side of the hunk, in both texts. */
function editFor(hunk: Hunk, { original, revised, before, after }: Texts): Edit {
  const leading = hunk.beforeAnchor
  const trailing = hunk.afterAnchor
  const replacementStart = leading ? (after[leading.after]?.end ?? 0) : 0
  const replacementEnd = trailing ? (after[trailing.after]?.start ?? revised.length) : revised.length
  return {
    start: leading ? (before[leading.before]?.end ?? 0) : 0,
    end: trailing ? (before[trailing.before]?.start ?? original.length) : original.length,
    replacement: revised.slice(replacementStart, replacementEnd),
  }
}

/** The edit without the whitespace both texts share at its ends, which stays where it is. */
function withoutSharedSpace(edit: Edit, original: string): Edit {
  let { start, end, replacement } = edit
  while (start < end && isSameSpace(original[start], replacement[0])) {
    start += 1
    replacement = replacement.slice(1)
  }
  while (start < end && isSameSpace(original[end - 1], replacement.at(-1))) {
    end -= 1
    replacement = replacement.slice(0, -1)
  }
  return { start, end, replacement }
}

/** An insertion has nothing to show under, so it takes in the neighbouring word. */
function widenInsertion(edit: Edit, hunk: Hunk, { original, before }: Texts): Edit {
  if (edit.start !== edit.end) {
    return edit
  }
  const next = hunk.afterAnchor ? before[hunk.afterAnchor.before] : undefined
  if (next !== undefined) {
    const replacement = edit.replacement + original.slice(edit.end, next.end)
    return { start: edit.start, end: next.end, replacement }
  }
  const previous = hunk.beforeAnchor ? before[hunk.beforeAnchor.before] : undefined
  if (previous !== undefined) {
    const replacement = original.slice(previous.start, edit.start) + edit.replacement
    return { start: previous.start, end: edit.end, replacement }
  }
  return edit
}

function isSameSpace(left: string | undefined, right: string | undefined): boolean {
  return left !== undefined && left === right && WHITESPACE.test(left)
}

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from) }, (_, index) => from + index)
}
