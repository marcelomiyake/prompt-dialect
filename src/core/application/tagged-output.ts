/**
 * `name`, or else `name_2`, `name_3` and on: the first that `text` holds
 * neither as `<tag>` nor as `</tag>`. Wrapped in it, `text` can be told
 * apart from the wrapper, whatever tags it quotes.
 */
export function tagAbsentFrom(text: string, name: string): string {
  let tag = name
  let n = 2
  while (text.includes(`<${tag}>`) || text.includes(`</${tag}>`)) {
    tag = `${name}_${n}`
    n += 1
  }
  return tag
}

/**
 * The text between `<tag>` and `</tag>` in a model's reply, or undefined when
 * the reply has no such pair. The last pair wins: a model that drafts before
 * answering puts its final answer last.
 */
export function textInTag(reply: string, tag: string): string | undefined {
  const open = `<${tag}>`
  const close = `</${tag}>`
  const end = reply.lastIndexOf(close)
  if (end === -1) {
    return undefined
  }
  const start = reply.lastIndexOf(open, end)
  if (start === -1) {
    return undefined
  }
  return reply.slice(start + open.length, end)
}

/**
 * `inner` with the line breaks a model puts just inside its tags removed,
 * unless `original` has them too.
 */
export function withoutTagPadding(inner: string, original: string): string {
  let text = inner
  if (!/^\r?\n/.test(original)) {
    text = text.replace(/^\r?\n/, '')
  }
  if (!/\r?\n$/.test(original)) {
    text = text.replace(/\r?\n$/, '')
  }
  return text
}

/** The items of a bulleted list, one per line that starts with `-`, `*` or `•`. */
export function bulletsOf(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^[-*•]\s/.test(line))
    .map(line => line.slice(1).trim())
    .filter(item => item !== '')
}
