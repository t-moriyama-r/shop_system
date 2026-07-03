import { describe, it, expect } from 'vitest'
import { getTableColumns, getTableName } from 'drizzle-orm'
import { menuItems } from './schema'

describe('menuItems table', () => {
  it('has the correct table name', () => {
    expect(getTableName(menuItems)).toBe('menu_items')
  })

  it('has the expected columns', () => {
    const columns = getTableColumns(menuItems)
    const columnNames = Object.keys(columns)

    expect(columnNames).toContain('menuItemId')
    expect(columnNames).toContain('name')
    expect(columnNames).toContain('price')
    expect(columnNames).toContain('createdAt')
    expect(columnNames).toContain('updatedAt')
  })

  it('has exactly 5 columns', () => {
    const columns = getTableColumns(menuItems)
    expect(Object.keys(columns)).toHaveLength(5)
  })

  it('uses uuid as the primary key for menuItemId', () => {
    const columns = getTableColumns(menuItems)
    const menuItemId = columns.menuItemId

    expect(menuItemId.columnType).toBe('PgUUID')
    expect(menuItemId.primary).toBe(true)
    expect(menuItemId.hasDefault).toBe(true)
  })

  it('has a non-nullable name column with varchar(255)', () => {
    const columns = getTableColumns(menuItems)
    const name = columns.name

    expect(name.columnType).toBe('PgVarchar')
    expect(name.notNull).toBe(true)
  })

  it('has a non-nullable integer price column', () => {
    const columns = getTableColumns(menuItems)
    const price = columns.price

    expect(price.columnType).toBe('PgInteger')
    expect(price.notNull).toBe(true)
  })

  it('has timestamp columns with timezone and defaults', () => {
    const columns = getTableColumns(menuItems)

    expect(columns.createdAt.columnType).toBe('PgTimestamp')
    expect(columns.createdAt.notNull).toBe(true)
    expect(columns.createdAt.hasDefault).toBe(true)

    expect(columns.updatedAt.columnType).toBe('PgTimestamp')
    expect(columns.updatedAt.notNull).toBe(true)
    expect(columns.updatedAt.hasDefault).toBe(true)
  })
})
