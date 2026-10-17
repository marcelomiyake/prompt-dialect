// The globals a Claude Code hooks module draws with: `h` calls a function tag
// with its props, so the element constructors a fake `$.ui.resolve` hands out
// turn JSX into plain trees a test can read.
type Props = Record<string, unknown> | null
type Tag = string | ((props: Record<string, unknown>) => unknown)

const globals = globalThis as Record<string, unknown>

globals.Fragment = 'Fragment'
globals.h = (tag: Tag, props: Props, ...children: unknown[]) => {
  const all = { ...props, children: children.flat() }
  return typeof tag === 'function' ? tag(all) : { type: tag, props: all }
}
