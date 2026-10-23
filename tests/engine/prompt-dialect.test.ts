// Runs the built plugin inside Claude Code's own engine: `npm run test:plugin`.
// The behaviour itself is covered by the vitest *.spec suites; these check
// that the bundle loads, registers its command, and draws trees the real
// terminal and desktop element tables accept.
import type { On } from 'claude-code'
import { describe, expect, mock, test, type Engine } from 'claude-code/testing'
import type { DialectState } from '../../types'

const SURFACES = ['terminal', 'desktop'] as const
const DRAFT = 'Is it possible to change the window for prompts?'
/** What the engine draws in the band when the plugin passes. */
const ENGINE_BAND = 'the engine band'
const BAND = {
  plugin: 'prompt-dialect',
  component: 'AbovePrompt',
  requestId: 'band',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 12,
    bodyColumns: 72,
    scroll: { offset: 0, bodyRows: 12 },
    view: {},
  },
} as const

const PRESENTATION = { isFullscreen: true, columns: 80 }

function dialect($: Engine, args: string) {
  return $.command.run({ command: 'dialect', args, origin: { kind: 'composer' }, presentation: PRESENTATION })
}

/** Answers what the engine would beneath the plugin, then starts the session. */
async function boot($: Engine, on: On): Promise<void> {
  mock.store(on)
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return Text({ children: ENGINE_BAND })
  })
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
}

describe('/dialect', () => {
  test('reports that checking is on by default', async ($, on) => {
    await boot($, on)

    const answer = await dialect($, '')

    expect(answer.text).toContain('Prompt checking is on.')
  })

  test('turns checking off and back on', async ($, on) => {
    await boot($, on)

    const off = await dialect($, 'off')
    const back = await dialect($, 'on')

    expect(off.text).toBe('Prompt checking is off.')
    expect(back.text).toBe('Checking prompts as you type.')
  })
})

describe('the band above the prompt', () => {
  test('stays out of the way while there is no draft', async ($, on) => {
    await boot($, on)

    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await ui.find({ text: ENGINE_BAND })).toBeDefined()
      expect(await ui.find({ key: 'improve' })).toBeUndefined()
      await ui.unmount()
    }
  })

  test('draws chips and a rewrite that each surface accepts', async ($, on) => {
    on('state.get', { plugin: 'prompt-dialect', key: 'session' }, () => ({
      value: {
        value: {
          draft: DRAFT,
          review: {
            text: DRAFT,
            isFresh: true,
            suggestions: [{ start: 0, end: 17, original: 'Is it possible to', replacement: 'Can you' }],
          },
          improvement: {
            status: 'ready',
            draft: DRAFT,
            target: 'Opus 5.5',
            improved: 'Change the prompt window.\nKeep the colors.',
            notes: ['States the goal'],
          },
          dismissed: null,
          failure: null,
          isEnabled: true,
        },
        version: 1,
      },
    }))
    await boot($, on)

    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await ui.find({ key: 'fix-0-17' })).toBeDefined()
      expect(await ui.find({ key: 'use-improvement' })).toBeDefined()
      await ui.unmount()
    }
  })

  test('says on each surface that a folded paste is not checked', async ($, on) => {
    const draft = '[Pasted text #1 +10 lines]'
    on('state.get', { plugin: 'prompt-dialect', key: 'session' }, () => ({
      value: {
        value: { draft, review: null, improvement: null, dismissed: null, failure: null, isEnabled: true },
        version: 1,
      },
    }))
    await boot($, on)

    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await ui.find({ text: /Pasted text #1 is folded/ })).toBeDefined()
      expect(await ui.find({ key: 'improve' })).toBeUndefined()
      await ui.unmount()
    }
  })

  test('rewrites the draft for the session model when Improve is pressed', async ($, on) => {
    let state: DialectState = {
      draft: DRAFT,
      review: null,
      improvement: null,
      dismissed: null,
      failure: null,
      isEnabled: true,
    }
    let version = 1
    const asked: string[] = []
    on('state.get', { plugin: 'prompt-dialect', key: 'session' }, () => ({ value: { value: state, version } }))
    on('state.set', { plugin: 'prompt-dialect', key: 'session' }, (_, e) => {
      state = e.value
      version += 1
      return { value: { isSet: true, version } }
    })
    on('prompt.read', () => ({ value: { text: DRAFT, cursor: DRAFT.length } }))
    on('model.complete', (_, e) => {
      asked.push(e.model)
      return {
        value: {
          isAnswered: true,
          text: '<improved_prompt>Change the prompt window.</improved_prompt>',
          usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        },
      } as const
    })
    await boot($, on)
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

    await $.ui.press({ plugin: 'prompt-dialect', key: 'improve' })

    expect(asked).toEqual(['claude-haiku-5-5'])
    expect(state.improvement).toEqual({
      status: 'ready',
      draft: DRAFT,
      target: 'Opus 5.5',
      improved: 'Change the prompt window.',
      notes: [],
    })
    await ui.unmount()
  })
})
