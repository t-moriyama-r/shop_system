import { describe, it, expect } from 'vitest'
import { buildPagination, parsePositiveInt } from './pagination'

describe('parsePositiveInt', () => {
  it('parses a valid positive integer string', () => {
    expect(parsePositiveInt('25', 10)).toBe(25)
  })

  it('falls back when the value is undefined', () => {
    expect(parsePositiveInt(undefined, 10)).toBe(10)
  })

  it('falls back when the value is not a number', () => {
    expect(parsePositiveInt('abc', 10)).toBe(10)
  })

  it('falls back when the value is zero or negative', () => {
    expect(parsePositiveInt('0', 10)).toBe(10)
    expect(parsePositiveInt('-5', 10)).toBe(10)
  })

  it('caps the value at max when provided', () => {
    expect(parsePositiveInt('999', 10, 100)).toBe(100)
  })

  it('does not cap the value when max is omitted', () => {
    expect(parsePositiveInt('999', 10)).toBe(999)
  })
})

describe('buildPagination', () => {
  it('builds pagination metadata with computed totalPages', () => {
    expect(buildPagination(1, 20, 45)).toEqual({ page: 1, limit: 20, total: 45, totalPages: 3 })
  })

  it('rounds totalPages up for a partial last page', () => {
    expect(buildPagination(2, 50, 120)).toEqual({ page: 2, limit: 50, total: 120, totalPages: 3 })
  })

  it('returns 0 totalPages when there is no data', () => {
    expect(buildPagination(1, 20, 0)).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 })
  })
})
