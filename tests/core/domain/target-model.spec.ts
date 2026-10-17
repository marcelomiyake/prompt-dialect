import { describe, expect, it } from 'vitest'
import { TargetModel, compareVersions } from '../../../src/core/domain/target-model'

describe('TargetModel', () => {
  it.each([
    ['claude-opus-5-5', 'opus', '5.5', 'Opus 5.5'],
    ['claude-opus-5-5[1m]', 'opus', '5.5', 'Opus 5.5'],
    ['Claude Sonnet 5.5', 'sonnet', '5.5', 'Sonnet 5.5'],
    ['claude-haiku-4-5-20251001', 'haiku', '4.5', 'Haiku 4.5'],
    ['claude-fable-5-1', 'fable', '5.1', 'Fable 5.1'],
    ['claude-mythos-5', 'mythos', '5', 'Mythos 5'],
    ['opus', 'opus', undefined, 'Opus'],
    ['opus[1m]', 'opus', undefined, 'Opus'],
    ['claude-3-5-sonnet-20241022', 'sonnet', undefined, 'Sonnet'],
  ])('reads %s', (raw, family, version, label) => {
    const target = TargetModel.parse(raw)

    expect(target.family).toBe(family)
    expect(target.version).toBe(version)
    expect(target.label).toBe(label)
    expect(target.isKnown).toBe(true)
  })

  it('keeps an unknown model by its raw name', () => {
    const target = TargetModel.parse(' gpt-x ')

    expect(target.isKnown).toBe(false)
    expect(target.family).toBeUndefined()
    expect(target.label).toBe('gpt-x')
  })

  it('names an empty model Claude', () => {
    expect(TargetModel.parse('').label).toBe('Claude')
  })
})

describe('compareVersions', () => {
  it('orders versions numerically', () => {
    expect(compareVersions('5.10', '5.9')).toBeGreaterThan(0)
    expect(compareVersions('5', '5.0')).toBe(0)
    expect(compareVersions('4.5', '5')).toBeLessThan(0)
  })
})
