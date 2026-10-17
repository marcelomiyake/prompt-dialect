// A stand-in for Claude Code's engine: just enough of `on` and `$` for the
// adapter's hooks to run in vitest, with every effect recorded for asserts.
import type { PromptFillArgs } from 'claude-code'
import type { DialectState } from '../../src/adapters/claude-code/plugin-state'

type Hook = (...args: unknown[]) => unknown
type Registration = {
  readonly event: string
  readonly matcher: Record<string, unknown> | undefined
  readonly hook: Hook
}
type ModelRequest = {
  readonly model: string
  readonly system?: string
  readonly prompt: string
  readonly effort?: string
}
type ModelReply =
  | { isAnswered: true; text: string }
  | { isAnswered: false; reason: 'api-error'; status: number | null; error: string }
  | { isAnswered: false; reason: 'aborted' | 'empty-reply' }
type Timer = { due: number; fn: () => void; isCancelled: boolean }

export type Element = { readonly type: string; readonly props: Record<string, unknown> & { children: unknown[] } }

export class FakeEngine {
  readonly registrations: Registration[] = []
  readonly state = new Map<string, unknown>()
  readonly store = new Map<string, unknown>()
  readonly commands: unknown[] = []
  readonly fills: PromptFillArgs[] = []
  readonly toasts: string[] = []
  readonly copies: string[] = []
  readonly modelRequests: ModelRequest[] = []
  box = { text: '', cursor: 0 }
  sessionModel = 'claude-opus-5-5'
  isCopyWorking = true
  answerModel: (request: ModelRequest) => ModelReply | Promise<ModelReply> = () => ({ isAnswered: true, text: '' })
  /** What the box makes of a fill: the text it takes, or undefined to refuse it. */
  takeFill: (text: string) => string | undefined = text => text
  private now = 0
  private readonly timers: Timer[] = []

  readonly on = (event: string, matcherOrHook: unknown, maybeHook?: unknown) => {
    const hook = (maybeHook ?? matcherOrHook) as Hook
    const matcher = maybeHook === undefined ? undefined : (matcherOrHook as Record<string, unknown>)
    this.registrations.push({ event, matcher, hook })
    return { catch: () => undefined }
  }

  readonly $ = {
    plugin: { name: 'prompt-dialect' },
    command: {
      register: async (spec: unknown) => {
        this.commands.push(spec)
      },
    },
    store: {
      get: async (key: string) => this.store.get(key),
      set: async (key: string, value: unknown) => {
        this.store.set(key, value)
      },
    },
    state: {
      get: async (ref: { key: string }) => ({ value: this.state.get(ref.key), version: 0 }),
      set: async (ref: { key: string }, value: unknown) => {
        this.state.set(ref.key, structuredClone(value))
        return { isSet: true, version: 1 }
      },
    },
    clock: {
      after: (ms: number, fn: () => void) => {
        const timer: Timer = { due: this.now + ms, fn, isCancelled: false }
        this.timers.push(timer)
        return {
          cancel: () => {
            timer.isCancelled = true
          },
        }
      },
    },
    prompt: {
      read: async () => ({ ...this.box }),
      fill: async (args: PromptFillArgs) => {
        this.fills.push(args)
        const text = this.takeFill(args.text)
        if (text === undefined) {
          return { isFilled: false, ...this.box }
        }
        this.box = { text, cursor: text.length }
        await this.dispatch('prompt.change', { ...this.box, origin: { kind: 'plugin', name: 'prompt-dialect' } })
        return { isFilled: true, text, cursor: text.length }
      },
    },
    session: {
      model: async () => this.sessionModel,
    },
    model: {
      complete: async (request: ModelRequest) => {
        this.modelRequests.push(request)
        return { ...(await this.answerModel(request)), usage: {} }
      },
    },
    ui: {
      resolve: () => ({
        Box: (props: Element['props']): Element => ({ type: 'Box', props }),
        Text: (props: Element['props']): Element => ({ type: 'Text', props }),
        Button: (props: Element['props']): Element => ({ type: 'Button', props }),
      }),
      copy: async ({ text }: { text: string }) => {
        this.copies.push(text)
        return { isCopied: this.isCopyWorking }
      },
      toast: (text: string) => {
        this.toasts.push(text)
      },
    },
  }

  /** The mod's session state as the host holds it. */
  get session(): DialectState | undefined {
    return this.state.get('session') as DialectState | undefined
  }

  get pendingTimers(): number {
    return this.timers.filter(timer => !timer.isCancelled).length
  }

  /** Raises `event` through the module's matching hook, the engine's answer beneath it. */
  async dispatch<R>(event: string, e: Record<string, unknown>, bottom: (e: unknown) => unknown = () => e): Promise<R> {
    const found = this.registrations.find(
      entry => entry.event === event && Object.entries(entry.matcher ?? {}).every(([key, value]) => e[key] === value),
    )
    if (found === undefined) {
      return bottom(e) as R
    }
    return (await found.hook(this.$, e, async (next: unknown) => bottom(next))) as R
  }

  /** The person types: the box changes and `prompt.edit` runs. */
  async type(text: string, cursor = text.length): Promise<{ text: string; cursor: number; decorations?: unknown[] }> {
    const before = { ...this.box }
    this.box = { text, cursor }
    return this.dispatch(
      'prompt.edit',
      { origin: { kind: 'composer' }, ...before, start: 0, end: 0, inputText: '' },
      () => ({
        text,
        cursor,
      }),
    )
  }

  /**
   * The person types, but the box shows it only once the returned `land` is
   * called: an edit the hooks have seen that is still on its way to the box.
   */
  startTyping(text: string): () => Promise<void> {
    let land: () => void = () => undefined
    const landed = new Promise<void>(resolve => {
      land = resolve
    })
    const done = this.dispatch(
      'prompt.edit',
      { origin: { kind: 'composer' }, ...this.box, start: 0, end: 0, inputText: '' },
      async () => {
        await landed
        this.box = { text, cursor: text.length }
        return { ...this.box }
      },
    )
    return async () => {
      land()
      await done
    }
  }

  /** Moves the clock, firing every timer due on the way, and lets their work settle. */
  async advance(ms: number): Promise<void> {
    this.now += ms
    for (const timer of this.timers.filter(t => !t.isCancelled && t.due <= this.now)) {
      timer.isCancelled = true
      timer.fn()
    }
    await settle()
  }

  async renderBand(props: Record<string, unknown> = {}, viewport: Record<string, unknown> = { isFullscreen: true }) {
    return this.dispatch<Element | 'engine'>(
      'ui.render',
      {
        component: 'AbovePrompt',
        surface: 'terminal',
        requestId: 'band',
        viewport,
        props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 60, ...props },
      },
      () => 'engine',
    )
  }
}

/** Lets promise chains started without an await run to their end. */
export async function settle(): Promise<void> {
  for (let round = 0; round < 20; round += 1) {
    await new Promise(resolve => setTimeout(resolve, 0))
  }
}

/** Every element of a drawn tree, depth first. */
export function elementsOf(node: unknown): Element[] {
  if (Array.isArray(node)) {
    return node.flatMap(elementsOf)
  }
  if (node === null || typeof node !== 'object' || !('type' in node)) {
    return []
  }
  const element = node as Element
  return [element, ...elementsOf(element.props.children)]
}

/** The text a drawn tree shows, its pieces joined. */
export function textOf(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join('')
  }
  if (node === null || typeof node !== 'object' || !('props' in node)) {
    return ''
  }
  const element = node as Element
  const label = typeof element.props.label === 'string' ? `[${element.props.label}]` : ''
  return label + textOf(element.props.children)
}

export function buttonOf(tree: unknown, key: string): Element {
  const button = elementsOf(tree).find(element => element.type === 'Button' && element.props.key === key)
  if (button === undefined) {
    throw new Error(`No button "${key}" in the band`)
  }
  return button
}

export async function press(tree: unknown, key: string): Promise<void> {
  const onPress = buttonOf(tree, key).props.onPress as (e: unknown) => void
  onPress({ surface: 'terminal', element: key })
  await settle()
}
