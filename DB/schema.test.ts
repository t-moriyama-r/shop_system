import { describe, it, expect } from 'vitest'
import { getTableColumns, getTableName } from 'drizzle-orm'
import { menuItems } from './schema'

describe('menuItemsテーブル', () => {
  it('正しいテーブル名を持つ', () => {
    expect(getTableName(menuItems)).toBe('menu_items')
  })

  it('期待されるカラムを持つ', () => {
    const columns = getTableColumns(menuItems)
    const columnNames = Object.keys(columns)

    expect(columnNames).toContain('menuItemId')
    expect(columnNames).toContain('name')
    expect(columnNames).toContain('price')
    expect(columnNames).toContain('createdAt')
    expect(columnNames).toContain('updatedAt')
  })

  it('ちょうど5個のカラムを持つ', () => {
    const columns = getTableColumns(menuItems)
    expect(Object.keys(columns)).toHaveLength(5)
  })

  it('menuItemIdの主キーとしてuuidを使用する', () => {
    const columns = getTableColumns(menuItems)
    const menuItemId = columns.menuItemId

    expect(menuItemId.columnType).toBe('PgUUID')
    expect(menuItemId.primary).toBe(true)
    expect(menuItemId.hasDefault).toBe(true)
  })

  it('nameカラムはvarchar(255)でNULLを許容しない', () => {
    const columns = getTableColumns(menuItems)
    const name = columns.name

    expect(name.columnType).toBe('PgVarchar')
    expect(name.notNull).toBe(true)
  })

  it('priceカラムはNULLを許容しない整数型である', () => {
    const columns = getTableColumns(menuItems)
    const price = columns.price

    expect(price.columnType).toBe('PgInteger')
    expect(price.notNull).toBe(true)
  })

  it('タイムスタンプカラムはタイムゾーン付きでデフォルト値を持つ', () => {
    const columns = getTableColumns(menuItems)

    expect(columns.createdAt.columnType).toBe('PgTimestamp')
    expect(columns.createdAt.notNull).toBe(true)
    expect(columns.createdAt.hasDefault).toBe(true)

    expect(columns.updatedAt.columnType).toBe('PgTimestamp')
    expect(columns.updatedAt.notNull).toBe(true)
    expect(columns.updatedAt.hasDefault).toBe(true)
  })
})
