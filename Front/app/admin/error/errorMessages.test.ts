import { describe, it, expect } from 'vitest'
import { resolveError } from './errorMessages'

describe('resolveError', () => {
  it('returns the definition matching a known code', () => {
    const result = resolveError('404')
    expect(result.code).toBe('404')
    expect(result.title).toBe('ページが見つかりません')
    expect(result.message).not.toBe('')
  })

  it('resolves each defined code to its own code', () => {
    for (const code of ['400', '403', '404', '500', '503']) {
      expect(resolveError(code).code).toBe(code)
    }
  })

  it('trims surrounding whitespace before matching', () => {
    expect(resolveError('  403  ').code).toBe('403')
  })

  it('falls back to 500 for an unknown code', () => {
    expect(resolveError('999').code).toBe('500')
  })

  it('falls back to 500 when the code is undefined or null', () => {
    expect(resolveError(undefined).code).toBe('500')
    expect(resolveError(null).code).toBe('500')
  })

  it('falls back to 500 for an empty string', () => {
    expect(resolveError('').code).toBe('500')
    expect(resolveError('   ').code).toBe('500')
  })
})
