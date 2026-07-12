import { describe, it, expect } from 'vitest'
import { buildPagination, parsePositiveInt } from './pagination'

describe('parsePositiveInt', () => {
  it('有効な正の整数文字列をパースする', () => {
    expect(parsePositiveInt('25', 10)).toBe(25)
  })

  it('値がundefinedの場合はデフォルト値にフォールバックする', () => {
    expect(parsePositiveInt(undefined, 10)).toBe(10)
  })

  it('値が数値でない場合はデフォルト値にフォールバックする', () => {
    expect(parsePositiveInt('abc', 10)).toBe(10)
  })

  it('値が0以下の場合はデフォルト値にフォールバックする', () => {
    expect(parsePositiveInt('0', 10)).toBe(10)
    expect(parsePositiveInt('-5', 10)).toBe(10)
  })

  it('maxが指定されている場合はその値で上限を設ける', () => {
    expect(parsePositiveInt('999', 10, 100)).toBe(100)
  })

  it('maxが省略された場合は値を上限なしで返す', () => {
    expect(parsePositiveInt('999', 10)).toBe(999)
  })
})

describe('buildPagination', () => {
  it('totalPagesを計算してページネーション情報を組み立てる', () => {
    expect(buildPagination(1, 20, 45)).toEqual({ page: 1, limit: 20, total: 45, totalPages: 3 })
  })

  it('最終ページが端数の場合はtotalPagesを切り上げる', () => {
    expect(buildPagination(2, 50, 120)).toEqual({ page: 2, limit: 50, total: 120, totalPages: 3 })
  })

  it('データが0件の場合はtotalPagesを0にする', () => {
    expect(buildPagination(1, 20, 0)).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 })
  })
})
