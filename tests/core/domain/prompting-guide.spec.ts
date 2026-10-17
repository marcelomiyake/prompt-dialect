import { describe, expect, it } from 'vitest'
import { PromptingGuideCatalog, type PromptingGuide } from '../../../src/core/domain/prompting-guide'
import { GENERAL_GUIDE, MODEL_GUIDES, defaultPromptingGuides } from '../../../src/core/domain/prompting-guides'
import { TargetModel } from '../../../src/core/domain/target-model'

function guide(id: string, version: string): PromptingGuide {
  return { id, title: id, source: 'https://example.test', families: ['opus'], version, guidelines: [id] }
}

describe('PromptingGuideCatalog', () => {
  const catalog = new PromptingGuideCatalog(GENERAL_GUIDE, [guide('opus-4-8', '4.8'), guide('opus-5-5', '5.5')])

  function specificFor(raw: string): string | undefined {
    return catalog.guidanceFor(TargetModel.parse(raw)).specific?.id
  }

  it('always includes the general guide', () => {
    expect(catalog.guidanceFor(TargetModel.parse('opus')).general).toBe(GENERAL_GUIDE)
  })

  it('picks the guide written for the release', () => {
    expect(specificFor('claude-opus-4-8')).toBe('opus-4-8')
    expect(specificFor('claude-opus-5-5')).toBe('opus-5-5')
  })

  it('picks the newest guide for an alias', () => {
    expect(specificFor('opus')).toBe('opus-5-5')
  })

  it('picks the newest guide written before a release it does not know', () => {
    expect(specificFor('claude-opus-5')).toBe('opus-4-8')
    expect(specificFor('claude-opus-6')).toBe('opus-5-5')
  })

  it('picks the oldest guide for a release older than every guide', () => {
    expect(specificFor('claude-opus-4-1')).toBe('opus-4-8')
  })

  it('has no specific guide for a family it does not cover or an unknown model', () => {
    expect(specificFor('claude-haiku-5-5')).toBeUndefined()
    expect(specificFor('some-other-model')).toBeUndefined()
  })
})

describe('defaultPromptingGuides', () => {
  it.each([
    ['claude-opus-5-5', 'opus-5-5'],
    ['claude-opus-5', 'opus-5'],
    ['claude-opus-4-8', 'opus-4-8'],
    ['claude-opus-4-6', 'opus-4-8'],
    ['claude-sonnet-5-5', 'sonnet-5-5'],
    ['claude-sonnet-5', 'sonnet-5'],
    ['claude-sonnet-4-6', 'sonnet-5'],
    ['claude-haiku-5-5', 'haiku-5-5'],
    ['claude-fable-5-1', 'fable-5-1'],
    ['claude-mythos-5-1', 'fable-5-1'],
    ['claude-fable-5', 'fable-5'],
    ['claude-mythos-5', 'fable-5'],
  ])('covers %s', (raw, id) => {
    expect(defaultPromptingGuides().guidanceFor(TargetModel.parse(raw)).specific?.id).toBe(id)
  })

  it('cites a source and has guidelines for every guide', () => {
    for (const entry of [GENERAL_GUIDE, ...MODEL_GUIDES]) {
      expect(entry.source).toMatch(/^https:\/\/platform\.claude\.com\/docs\//)
      expect(entry.guidelines.length).toBeGreaterThan(0)
    }
  })
})
