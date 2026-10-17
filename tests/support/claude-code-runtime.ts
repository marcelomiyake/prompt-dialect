// The state helpers a hooks module imports from 'claude-code', for vitest:
// the engine supplies the real ones at run time (and `npm run test:plugin`
// runs the bundle against them). vitest.config.ts aliases the import here.
type Ref = { readonly plugin: string; readonly key: string }
type Atom<T> = Ref & { readonly initial: T }
type StateDollar = {
  readonly state: {
    get: (ref: Ref) => Promise<{ value?: unknown }>
    set: (ref: Ref, value: unknown) => Promise<unknown>
  }
}

export function atom<T>(ref: Ref, initial: T): Atom<T> {
  return { ...ref, initial }
}

export async function read<T>($: StateDollar, source: Atom<T>): Promise<T> {
  const { value } = await $.state.get(source)
  return (value ?? source.initial) as T
}

export async function update<T>($: StateDollar, source: Atom<T>, change: (value: T) => T): Promise<T> {
  const next = change(await read($, source))
  await $.state.set(source, next)
  return next
}
