import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DialectState } from '../../../src/adapters/claude-code/plugin-state'
import { FakeEngine, buttonOf, elementsOf, press, settle, textOf } from '../../support/fake-engine'

const DRAFT = 'Is it possible to change the window for prompts?'
const REVISED = 'Can you change the window in prompts?'
const IMPROVED = 'Change the prompt window so it underlines mistakes.\nKeep the current colors.'
const OTHER = 'Please make the login page load faster.'
const BLOCKED = 'model blocked'
/** DRAFT with its first fix taken. */
const FIRST_FIXED = 'Can you change the window for prompts?'

let engine: FakeEngine

async function load(options: Readonly<Record<string, string | number | boolean>> = {}): Promise<void> {
  vi.resetModules()
  const { register } = await import('../../../src/adapters/claude-code/register')
  engine = new FakeEngine()
  engine.answerModel = request =>
    request.system?.includes('copy editor')
      ? { isAnswered: true, text: `<corrected>${request.prompt.includes(DRAFT) ? REVISED : DRAFT}</corrected>` }
      : {
          isAnswered: true,
          text: `<improved_prompt>\n${IMPROVED}\n</improved_prompt>\n<notes>\n- States the goal\n</notes>`,
        }
  register(engine.on as never, options)
  await engine.dispatch('session.start', { source: 'startup' })
}

/** A model reply that arrives only when the test releases it. */
function deferredReply(text: string) {
  let release: () => void = () => undefined
  const promise = new Promise<{ isAnswered: true; text: string }>(resolve => {
    release = () => resolve({ isAnswered: true, text })
  })
  return { promise, release: () => release() }
}

async function typeAndPause(text: string, cursor = text.length): Promise<void> {
  await engine.type(text, cursor)
  await engine.advance(1000)
}

/** Runs `act` once, just after the mod saves the review a check made. */
function afterReviewSaved(act: () => unknown): void {
  const set = engine.$.state.set
  let isDone = false
  engine.$.state.set = async (ref, value) => {
    const result = await set(ref, value)
    if (!isDone && (value as DialectState).review?.isFresh === true) {
      isDone = true
      await act()
    }
    return result
  }
}

/** Presses a button without letting the work it starts settle. */
function pressNow(tree: unknown, key: string): void {
  const onPress = buttonOf(tree, key).props.onPress as (e: unknown) => void
  onPress({ surface: 'terminal', element: key })
}

beforeEach(async () => {
  await load()
})

describe('the /dialect command', () => {
  it('is registered when the session starts', () => {
    expect(engine.commands).toEqual([expect.objectContaining({ name: 'dialect', argumentHint: '[on|off]' })])
    expect(engine.session?.isEnabled).toBe(true)
  })

  it('reports its status', async () => {
    const answer = await engine.dispatch<{ text: string }>('command.run', { command: 'dialect', args: '' })

    expect(answer.text).toContain('Prompt checking is on.')
    expect(answer.text).toContain('claude-haiku-5-5')
  })

  it('turns checking off and on, and remembers it', async () => {
    const off = await engine.dispatch<{ text: string }>('command.run', { command: 'dialect', args: ' OFF ' })
    expect(off.text).toBe('Prompt checking is off.')
    expect(engine.store.get('isEnabled')).toBe(false)

    const on = await engine.dispatch<{ text: string }>('command.run', { command: 'dialect', args: 'on' })
    expect(on.text).toBe('Checking prompts as you type.')
    expect(engine.session?.isEnabled).toBe(true)
  })

  it('explains its usage', async () => {
    const answer = await engine.dispatch<{ text: string }>('command.run', { command: 'dialect', args: 'loud' })

    expect(answer.text).toBe('Usage: /dialect [on|off]')
  })

  it('starts from what the person chose before', async () => {
    vi.resetModules()
    const { register } = await import('../../../src/adapters/claude-code/register')
    const next = new FakeEngine()
    next.store.set('isEnabled', false)
    register(next.on as never, {})
    await next.dispatch('session.start', {})

    expect(next.session?.isEnabled).toBe(false)
  })
})

describe('checking as the person types', () => {
  it('checks the draft once the person pauses', async () => {
    await engine.type(DRAFT)
    expect(engine.modelRequests).toHaveLength(0)
    expect(engine.session?.draft).toBe(DRAFT)

    await engine.advance(1000)

    expect(engine.modelRequests).toEqual([
      expect.objectContaining({ model: 'claude-haiku-5-5', effort: 'low', prompt: expect.stringContaining(DRAFT) }),
    ])
    expect(engine.session?.review).toMatchObject({ text: DRAFT, isFresh: true })
  })

  it('underlines the mistakes at once when the cursor is at the end', async () => {
    await typeAndPause(DRAFT)

    expect(engine.fills).toEqual([
      {
        text: DRAFT,
        mode: 'replace',
        decorations: [
          { start: 0, end: 17, underline: true, color: 'error' },
          expect.objectContaining({ underline: true, color: 'error' }),
        ],
      },
    ])
  })

  it('waits for the next edit to underline when the cursor is inside the draft', async () => {
    await typeAndPause(DRAFT, 3)

    expect(engine.fills).toHaveLength(0)
    const box = await engine.type(DRAFT, 4)
    expect(box.decorations).toHaveLength(2)
    expect(engine.pendingTimers).toBe(0)
  })

  it('does not repaint over typing that lands while the review is saved', async () => {
    const typed = `${DRAFT} And`
    afterReviewSaved(() => engine.type(typed))

    await typeAndPause(DRAFT)

    expect(engine.fills).toHaveLength(0)
    expect(engine.box.text).toBe(typed)
    expect(engine.session?.draft).toBe(typed)
  })

  it('does not repaint a box that changed under the saved review', async () => {
    afterReviewSaved(() => {
      engine.box = { text: OTHER, cursor: OTHER.length }
    })

    await typeAndPause(DRAFT)

    expect(engine.fills).toHaveLength(0)
    expect(engine.box.text).toBe(OTHER)
  })

  it('carries the underlines over an edit elsewhere and checks again', async () => {
    await typeAndPause(DRAFT)

    const box = await engine.type(`${DRAFT} Thanks`)

    expect(box.decorations).toHaveLength(2)
    expect(engine.session?.review).toMatchObject({ isFresh: false })
    expect(engine.pendingTimers).toBe(1)
  })

  it('keeps one pending check while the person keeps typing', async () => {
    await engine.type('Please fix the')
    await engine.type('Please fix the bug')

    expect(engine.pendingTimers).toBe(1)
  })

  it('does not check a slash command', async () => {
    await typeAndPause('/compact keep the plan')

    expect(engine.modelRequests).toHaveLength(0)
  })

  it.each([
    [{ isAnswered: false, reason: 'api-error', status: 429, error: 'rate_limit' }, 'rate_limit (429)'],
    [{ isAnswered: false, reason: 'api-error', status: null, error: 'unknown' }, 'unknown (no response)'],
    [{ isAnswered: false, reason: 'empty-reply' }, 'empty-reply'],
  ] as const)('records why a check failed: %j', async (reply, message) => {
    engine.answerModel = () => reply

    await typeAndPause(DRAFT)

    expect(engine.session?.failure).toEqual({ draft: DRAFT, message })
    expect(textOf(await engine.renderBand())).toContain(`Check failed: ${message}`)
  })

  it('records a check the engine refused to send', async () => {
    engine.answerModel = () => {
      throw new Error(BLOCKED)
    }

    await typeAndPause(DRAFT)

    expect(engine.session?.failure).toEqual({ draft: DRAFT, message: BLOCKED })
  })

  it('drops a result for a draft the person has changed since', async () => {
    engine.answerModel = request => {
      engine.box = { text: `${DRAFT} more`, cursor: 0 }
      return { isAnswered: true, text: `<corrected>${request.prompt}</corrected>` }
    }

    await typeAndPause(DRAFT)

    expect(engine.session?.review).toBeNull()
  })

  it('does nothing while checking is off', async () => {
    await engine.dispatch('command.run', { command: 'dialect', args: 'off' })

    const box = await engine.type(DRAFT)
    await engine.advance(1000)

    expect(box).toEqual({ text: DRAFT, cursor: DRAFT.length })
    expect(engine.modelRequests).toHaveLength(0)
  })

  it('follows a draft recalled from history but not its own fills', async () => {
    await engine.dispatch('prompt.change', { text: DRAFT, cursor: 0, origin: { kind: 'history' } })
    expect(engine.session?.draft).toBe(DRAFT)

    await engine.dispatch('prompt.change', {
      text: 'other text here',
      cursor: 0,
      origin: { kind: 'plugin', name: 'prompt-dialect' },
    })
    expect(engine.session?.draft).toBe(DRAFT)
  })

  it('honours the configured models and pause', async () => {
    await load({ grammarModel: 'haiku', debounceMs: 2000 })

    await engine.type(DRAFT)
    await engine.advance(1000)
    expect(engine.modelRequests).toHaveLength(0)
    await engine.advance(1000)

    expect(engine.modelRequests[0]?.model).toBe('haiku')
  })
})

describe('the band above the prompt', () => {
  it('leaves the band to the engine for a short draft or a survey', async () => {
    await engine.type('hi')
    expect(await engine.renderBand()).toBe('engine')

    await typeAndPause(DRAFT)
    expect(await engine.renderBand({ hasSurvey: true })).toBe('engine')
  })

  it('offers a rewrite for the session model before the check is back', async () => {
    await engine.type(DRAFT)

    const band = await engine.renderBand()

    expect(textOf(band)).toContain('[✨ Improve for Opus 5.5]')
  })

  it('shows each mistake as a chip with its fix in a hover card', async () => {
    await typeAndPause(DRAFT)

    const band = await engine.renderBand()
    const text = textOf(band)

    expect(text).toContain('2 fixes:')
    expect(text).toContain('Is it possible to')
    expect(text).toContain('Hover a word to preview its fix')
    const cards = elementsOf(band).filter(element => element.props.position === 'absolute')
    expect(cards).toHaveLength(2)
    expect(textOf(cards[0])).toContain('Is it possible to Can you')
  })

  it('tells keyboard users how to reach the fixes without a pointer', async () => {
    await typeAndPause(DRAFT)

    expect(textOf(await engine.renderBand({}, {}))).toContain('ctrl+x tab, then 1-2')
  })

  it('applies one fix when its chip is pressed', async () => {
    await typeAndPause(DRAFT)
    const band = await engine.renderBand()

    await press(band, 'fix-0-17')

    expect(engine.box.text).toBe('Can you change the window for prompts?')
    expect(engine.fills.at(-1)?.decorations).toHaveLength(1)
    expect(engine.session?.draft).toBe('Can you change the window for prompts?')
  })

  it('keeps the review as it was when the box refuses a fix', async () => {
    await typeAndPause(DRAFT)
    const band = await engine.renderBand()
    engine.takeFill = () => undefined

    await press(band, 'fix-0-17')

    expect(engine.box.text).toBe(DRAFT)
    expect(engine.session?.draft).toBe(DRAFT)
    expect(engine.session?.review?.suggestions).toHaveLength(2)
  })

  it('follows the text a hook put in the box in place of a fix', async () => {
    await typeAndPause(DRAFT)
    const band = await engine.renderBand()
    engine.takeFill = text => `${text} Thanks!`

    await press(band, 'fix-0-17')

    const landed = `${FIRST_FIXED} Thanks!`
    expect(engine.box.text).toBe(landed)
    expect(engine.session).toMatchObject({ draft: landed, review: { text: landed, isFresh: false } })
    expect(engine.session?.review?.suggestions).toEqual([
      expect.objectContaining({ original: 'for', replacement: 'in' }),
    ])
    expect(engine.pendingTimers).toBe(1)
  })

  it('keeps typing that lands right after a fix', async () => {
    await typeAndPause(DRAFT)
    const band = await engine.renderBand()
    const fill = engine.$.prompt.fill
    engine.$.prompt.fill = async args => {
      const filled = await fill(args)
      await engine.type(`${filled.text} Thanks`)
      return filled
    }

    await press(band, 'fix-0-17')

    expect(engine.session?.draft).toBe(`${FIRST_FIXED} Thanks`)
  })

  it('does not apply a fix over an edit still on its way to the box', async () => {
    await typeAndPause(DRAFT)
    const band = await engine.renderBand()
    const fills = engine.fills.length

    pressNow(band, 'fix-all')
    const land = engine.startTyping(`${DRAFT} Thanks`)
    await settle()
    await land()

    expect(engine.fills).toHaveLength(fills)
    expect(engine.box.text).toBe(`${DRAFT} Thanks`)
  })

  it('applies every fix at once', async () => {
    await typeAndPause(DRAFT)

    await press(await engine.renderBand(), 'fix-all')

    expect(engine.box.text).toBe(REVISED)
    expect(textOf(await engine.renderBand())).toContain('No issues found')
  })

  it('ignores a press on a chip for a draft that has changed', async () => {
    await typeAndPause(DRAFT)
    const band = await engine.renderBand()
    engine.box = { text: 'Something else entirely now', cursor: 0 }
    const fills = engine.fills.length

    await press(band, 'fix-0-17')
    await press(band, 'fix-all')

    expect(engine.fills).toHaveLength(fills)
  })

  it('ignores a press on a chip that is gone', async () => {
    await typeAndPause(DRAFT)
    const band = await engine.renderBand()
    await press(band, 'fix-all')
    const fills = engine.fills.length

    await press(band, 'fix-0-17')

    expect(engine.fills).toHaveLength(fills)
  })

  it('hides for the draft the person dismissed it on', async () => {
    await typeAndPause(DRAFT)

    await press(await engine.renderBand(), 'dismiss')

    expect(await engine.renderBand()).toBe('engine')
  })

  it('rewrites the draft for the session model and uses it on request', async () => {
    engine.sessionModel = 'claude-sonnet-5-5'
    await typeAndPause(DRAFT)

    await press(await engine.renderBand(), 'improve')

    const request = engine.modelRequests.at(-1)
    expect(request).toMatchObject({ model: 'claude-haiku-5-5', effort: 'medium' })
    expect(request?.system).toContain('Prompting Claude Sonnet 5.5')
    const band = await engine.renderBand()
    expect(textOf(band)).toContain('Suggested prompt for Sonnet 5.5:')
    expect(textOf(band)).toContain('States the goal')

    await press(band, 'use-improvement')

    expect(engine.box.text).toBe(IMPROVED)
    expect(engine.session?.improvement).toBeNull()
  })

  it('shows that it is rewriting while the model works', async () => {
    await engine.type(DRAFT)
    const reply = deferredReply(`<improved_prompt>${IMPROVED}</improved_prompt>`)
    engine.answerModel = () => reply.promise

    await press(await engine.renderBand(), 'improve')
    const band = await engine.renderBand()
    reply.release()

    expect(textOf(band)).toContain('Rewriting for Opus 5.5')
    expect(() => buttonOf(band, 'improve')).toThrow()
  })

  it('folds a long rewrite', async () => {
    const long = Array.from({ length: 20 }, (_, i) => `Line ${i}`).join('\n')
    engine.answerModel = () => ({ isAnswered: true, text: `<improved_prompt>${long}</improved_prompt>` })
    await engine.type(DRAFT)
    await press(await engine.renderBand(), 'improve')

    expect(textOf(await engine.renderBand({ maxRows: 8 }))).toContain('… 16 more lines')
  })

  it('copies the rewrite', async () => {
    await engine.type(DRAFT)
    await press(await engine.renderBand(), 'improve')

    await press(await engine.renderBand(), 'copy-improvement')

    expect(engine.copies).toEqual([IMPROVED])
    expect(engine.toasts).toEqual(['Suggested prompt copied.'])
  })

  it('says when the copy failed', async () => {
    engine.isCopyWorking = false
    await engine.type(DRAFT)
    await press(await engine.renderBand(), 'improve')

    await press(await engine.renderBand(), 'copy-improvement')

    expect(engine.toasts).toEqual(['Could not copy the suggested prompt.'])
  })

  it('does nothing for use or copy once the rewrite is gone', async () => {
    await engine.type(DRAFT)
    await press(await engine.renderBand(), 'improve')
    const band = await engine.renderBand()
    await press(band, 'use-improvement')
    const fills = engine.fills.length

    await press(band, 'use-improvement')
    await press(band, 'copy-improvement')

    expect(engine.fills).toHaveLength(fills)
    expect(engine.copies).toHaveLength(0)
  })

  it('does not use a rewrite of an earlier draft', async () => {
    await engine.type(DRAFT)
    await press(await engine.renderBand(), 'improve')
    const band = await engine.renderBand()
    await engine.type(OTHER)
    const fills = engine.fills.length

    await press(band, 'use-improvement')

    expect(engine.fills).toHaveLength(fills)
    expect(engine.box.text).toBe(OTHER)
  })

  it('follows the box when it folds a rewrite into a placeholder', async () => {
    await engine.type(DRAFT)
    await press(await engine.renderBand(), 'improve')
    engine.takeFill = () => '[Pasted text #1 +2 lines]'

    await press(await engine.renderBand(), 'use-improvement')

    expect(engine.session).toMatchObject({ draft: '[Pasted text #1 +2 lines]', review: null, improvement: null })
  })

  it('keeps the newer rewrite when an older one finishes after it', async () => {
    const older = deferredReply('<improved_prompt>The older rewrite.</improved_prompt>')
    const newer = deferredReply('<improved_prompt>The newer rewrite.</improved_prompt>')
    const replies = [older.promise, newer.promise]
    engine.answerModel = () => replies.shift() ?? older.promise
    await engine.type(DRAFT)
    await press(await engine.renderBand(), 'improve')
    await engine.type(OTHER)
    await press(await engine.renderBand(), 'improve')

    newer.release()
    await settle()
    older.release()
    await settle()

    expect(engine.session?.improvement).toMatchObject({ status: 'ready', draft: OTHER, improved: 'The newer rewrite.' })
  })

  it('shows only the newer of two rewrites asked for at once', async () => {
    await engine.type(DRAFT)
    const band = await engine.renderBand()

    pressNow(band, 'improve')
    engine.box = { text: OTHER, cursor: OTHER.length }
    pressNow(band, 'improve')
    await settle()

    expect(engine.session?.improvement).toMatchObject({ status: 'ready', draft: OTHER })
  })

  it('reports a rewrite the engine refused to send', async () => {
    engine.answerModel = () => {
      throw new Error(BLOCKED)
    }
    await engine.type(DRAFT)

    await press(await engine.renderBand(), 'improve')

    expect(engine.session?.improvement).toMatchObject({ status: 'failed', message: BLOCKED })
  })

  it.each([
    [{ isAnswered: true, text: `<improved_prompt>${DRAFT}</improved_prompt>` }, 'already reads well for Opus 5.5'],
    [{ isAnswered: false, reason: 'aborted' }, 'Could not rewrite it: aborted'],
  ] as const)('reports a rewrite that changed nothing or failed', async (reply, message) => {
    engine.answerModel = () => reply
    await engine.type(DRAFT)

    await press(await engine.renderBand(), 'improve')

    expect(textOf(await engine.renderBand())).toContain(message)
  })

  it('reports a draft too short to rewrite', async () => {
    await engine.type(DRAFT)
    const band = await engine.renderBand()
    engine.box = { text: 'hi', cursor: 2 }

    await press(band, 'improve')

    expect(engine.session?.improvement).toMatchObject({
      status: 'failed',
      message: 'the draft is too short to rewrite',
    })
  })

  it('keeps a hotkey on each of the first nine chips', async () => {
    const draft = Array.from({ length: 11 }, (_, i) => `wrd${i} ok`).join(' ')
    engine.answerModel = () => ({ isAnswered: true, text: `<corrected>${draft.replaceAll('wrd', 'WRD')}</corrected>` })
    await typeAndPause(draft)

    const band = await engine.renderBand()

    expect(buttonOf(band, 'fix-0-4').props.hotkey).toBe('1')
    const chips = elementsOf(band).filter(
      element => String(element.props.key).startsWith('fix-') && element.props.key !== 'fix-all',
    )
    expect(chips).toHaveLength(11)
    expect(chips.at(-1)?.props.hotkey).toBeUndefined()
  })
})
