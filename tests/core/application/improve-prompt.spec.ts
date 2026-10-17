import { describe, expect, it } from 'vitest'
import { ImprovePrompt } from '../../../src/core/application/improve-prompt'
import { defaultPromptingGuides } from '../../../src/core/domain/prompting-guides'
import { TargetModel } from '../../../src/core/domain/target-model'
import { ScriptedModel } from '../../support/scripted-model'

const DRAFT = 'make the login page faster'
const OPUS = TargetModel.parse('claude-opus-5-5')

function request(draft = DRAFT, target = OPUS) {
  return { draft, target, tool: 'Claude Code' }
}

describe('ImprovePrompt', () => {
  it('returns the rewrite and its notes', async () => {
    const model = ScriptedModel.replying(
      [
        '<improved_prompt>',
        'Speed up the login page. Profile it first, then fix the slowest step.',
        '</improved_prompt>',
        '<notes>',
        '- States the goal',
        '- Adds a check',
        '- Names the order',
        '- One too many',
        '</notes>',
      ].join('\n'),
    )

    const outcome = await new ImprovePrompt(model, defaultPromptingGuides()).execute(request())

    expect(outcome.status).toBe('improved')
    if (outcome.status !== 'improved') return
    expect(outcome.improvement.improved).toBe('Speed up the login page. Profile it first, then fix the slowest step.')
    expect(outcome.improvement.notes).toEqual(['States the goal', 'Adds a check', 'Names the order'])
    expect(outcome.improvement.target).toBe(OPUS)
  })

  it("puts the target model's guidance in the instructions", async () => {
    const model = ScriptedModel.replying('<improved_prompt>Better.</improved_prompt>')

    await new ImprovePrompt(model, defaultPromptingGuides()).execute(request())

    const system = model.requests[0]?.system ?? ''
    expect(system).toContain('Claude Opus 5.5 in Claude Code')
    expect(system).toContain('<general_guidance source="Prompting best practices">')
    expect(system).toContain('<model_guidance source="Prompting Claude Opus 5.5">')
    expect(model.requests[0]?.prompt).toContain(DRAFT)
  })

  it('uses the general guidance alone for a model it does not know', async () => {
    const model = ScriptedModel.replying('<improved_prompt>Better.</improved_prompt>')

    await new ImprovePrompt(model, defaultPromptingGuides()).execute(request(DRAFT, TargetModel.parse('other')))

    expect(model.requests[0]?.system).not.toContain('<model_guidance')
  })

  it('says so when the draft already reads well', async () => {
    const model = ScriptedModel.replying(`<improved_prompt>\n${DRAFT}\n</improved_prompt>`)

    const outcome = await new ImprovePrompt(model, defaultPromptingGuides()).execute(request())

    expect(outcome).toEqual({ status: 'unchanged' })
  })

  it('skips a draft that is not prose', async () => {
    const model = ScriptedModel.replying('unused')

    const outcome = await new ImprovePrompt(model, defaultPromptingGuides()).execute(request('!ls'))

    expect(outcome).toEqual({ status: 'skipped', reason: 'shell' })
    expect(model.requests).toHaveLength(0)
  })

  it('reports a model that did not answer', async () => {
    const outcome = await new ImprovePrompt(ScriptedModel.failing('aborted'), defaultPromptingGuides()).execute(
      request(),
    )

    expect(outcome).toEqual({ status: 'failed', reason: 'aborted' })
  })

  it('reports a model call that rejects', async () => {
    const model = new ScriptedModel(() => {
      throw new Error('model blocked')
    })

    const outcome = await new ImprovePrompt(model, defaultPromptingGuides()).execute(request())

    expect(outcome).toEqual({ status: 'failed', reason: 'model blocked' })
  })

  it('answers in tags the draft does not hold', async () => {
    const draft = 'Add a <notes></notes> block to the <improved_prompt> template'
    const improved = 'Add an empty <notes></notes> block to the <improved_prompt> template, after the title.'
    const model = ScriptedModel.replying(
      `<improved_prompt_2>\n${improved}\n</improved_prompt_2>\n<notes_2>\n- Says where\n</notes_2>`,
    )

    const outcome = await new ImprovePrompt(model, defaultPromptingGuides()).execute(request(draft))

    expect(model.requests[0]?.system).toContain('<notes_2>')
    expect(outcome.status).toBe('improved')
    if (outcome.status !== 'improved') return
    expect(outcome.improvement.improved).toBe(improved)
    expect(outcome.improvement.notes).toEqual(['Says where'])
  })

  it.each(['No tags at all.', '<improved_prompt>  </improved_prompt>'])(
    'reports a reply without a rewrite: %j',
    async reply => {
      const outcome = await new ImprovePrompt(ScriptedModel.replying(reply), defaultPromptingGuides()).execute(
        request(),
      )

      expect(outcome.status).toBe('failed')
    },
  )
})
