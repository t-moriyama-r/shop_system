import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[],
    updateTables: [] as unknown[],
    updateSets: [] as unknown[],
    insertTables: [] as unknown[],
    insertValues: [] as unknown[],
    returningQueue: [] as unknown[],
  }
  const makeChain = (resolver: () => unknown) => {
    const chain: Record<string, unknown> = {}
    for (const m of ['from', 'innerJoin', 'where', 'orderBy', 'limit', 'offset']) {
      chain[m] = () => chain
    }
    chain.set = (value: unknown) => {
      state.updateSets.push(value)
      return chain
    }
    chain.values = (value: unknown) => {
      state.insertValues.push(value)
      return chain
    }
    chain.returning = () => chain
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(resolver()).then(resolve, reject)
    return chain
  }
  const makeDb = () => ({
    select: () => makeChain(() => state.selectQueue.shift() ?? []),
    update: (table: unknown) => {
      state.updateTables.push(table)
      return makeChain(() => undefined)
    },
    insert: (table: unknown) => {
      state.insertTables.push(table)
      return makeChain(() => state.returningQueue.shift() ?? [])
    },
  })
  return { state, makeChain, makeDb }
})

vi.mock('./client', () => {
  const db = { ...h.makeDb(), transaction: (fn: (tx: unknown) => unknown) => fn(db) }
  return { db }
})

const {
  listShopAccounts,
  findShopAccountById,
  findShopAccountByEmail,
  createShopAccount,
  listEmailLogsByShopAccount,
  listEmailNotificationLogsPage,
  createResendEmailNotificationLog,
  recordEmailNotificationResult,
  updateShopAccountStatus,
  isShopAccountStatus,
  SHOP_ACCOUNT_STATUSES,
  EMAIL_NOTIFICATION_MAX_RETRY_COUNT,
  emailNotificationRetryBackoffMs,
  findEmailNotificationRetryCandidates,
  markEmailNotificationForRetry,
} = await import('./shop-accounts')
const { shopAccounts, emailNotificationLogs } = await import('./schema')

beforeEach(() => {
  h.state.selectQueue = []
  h.state.updateTables = []
  h.state.updateSets = []
  h.state.insertTables = []
  h.state.insertValues = []
  h.state.returningQueue = []
})

describe('SHOP_ACCOUNT_STATUSES / isShopAccountStatus', () => {
  it('既知のステータスを受け入れ、未知のステータスを拒否する', () => {
    expect(SHOP_ACCOUNT_STATUSES).toEqual(['active', 'pending', 'suspended'])
    expect(isShopAccountStatus('active')).toBe(true)
    expect(isShopAccountStatus('deleted')).toBe(false)
  })
})

describe('listShopAccounts', () => {
  it('2つのクエリから行データと合計件数を返す', async () => {
    const rows = [{ shopAccountId: 's1', shopName: 'Shop', email: 'a@example.com' }]
    h.state.selectQueue = [rows, [{ value: 7 }]]
    const result = await listShopAccounts({ page: 1, limit: 20 })
    expect(result.rows).toEqual(rows)
    expect(result.total).toBe(7)
  })
})

describe('findShopAccountById', () => {
  it('最初にマッチした行を返す', async () => {
    h.state.selectQueue = [[{ shopAccountId: 's1', email: 'a@example.com' }]]
    expect(await findShopAccountById('s1')).toMatchObject({ shopAccountId: 's1' })
  })

  it('マッチするものがない場合はundefinedを返す', async () => {
    h.state.selectQueue = [[]]
    expect(await findShopAccountById('missing')).toBeUndefined()
  })
})

describe('findShopAccountByEmail', () => {
  it('マッチする行を返す（論理削除済みも含む）', async () => {
    h.state.selectQueue = [[{ shopAccountId: 's1' }]]
    expect(await findShopAccountByEmail('a@example.com')).toMatchObject({ shopAccountId: 's1' })
  })

  it('メールアドレスが未登録の場合はundefinedを返す', async () => {
    h.state.selectQueue = [[]]
    expect(await findShopAccountByEmail('none@example.com')).toBeUndefined()
  })
})

describe('createShopAccount', () => {
  it('1つのトランザクションでアカウントとPENDINGのメールログを挿入する', async () => {
    h.state.returningQueue = [
      [{ shopAccountId: 's1', email: 'a@example.com' }],
      [{ emailNotificationLogId: 'log-1' }],
    ]

    const result = await createShopAccount({
      shopName: 'Shop',
      contactName: 'Taro',
      email: 'a@example.com',
      initialPasswordHash: 'hashed',
      issuedBySeAdminUserId: 'op-1',
    })

    expect(result).toMatchObject({
      account: { shopAccountId: 's1' },
      emailNotificationLogId: 'log-1',
    })
    expect(h.state.insertTables).toEqual([shopAccounts, emailNotificationLogs])

    const accountValues = h.state.insertValues[0] as Record<string, unknown>
    expect(accountValues).toMatchObject({
      shopName: 'Shop',
      email: 'a@example.com',
      initialPasswordHash: 'hashed',
      mustChangePassword: true,
      accountStatus: 'pending',
      issuedBySeAdminUserId: 'op-1',
    })

    const logValues = h.state.insertValues[1] as Record<string, unknown>
    expect(logValues).toMatchObject({
      shopAccountId: 's1',
      toEmail: 'a@example.com',
      notificationType: 'SHOP_ACCOUNT_ISSUED',
      sendStatus: 'PENDING',
    })
  })
})

describe('listEmailLogsByShopAccount', () => {
  it('メール通知ログの行を返す', async () => {
    const logs = [{ emailNotificationLogId: 'e1', sendStatus: 'SENT' }]
    h.state.selectQueue = [logs]
    expect(await listEmailLogsByShopAccount('s1')).toEqual(logs)
  })
})

describe('listEmailNotificationLogsPage', () => {
  it('2つのクエリから行データと合計件数を返す', async () => {
    const rows = [{ emailNotificationLogId: 'e1', sendStatus: 'PENDING' }]
    h.state.selectQueue = [rows, [{ value: 3 }]]
    const result = await listEmailNotificationLogsPage({ shopAccountId: 's1', page: 1, limit: 20 })
    expect(result.rows).toEqual(rows)
    expect(result.total).toBe(3)
  })
})

describe('createResendEmailNotificationLog', () => {
  it('パスワードハッシュを再発行し、新しいPENDINGのメール通知ログを挿入する', async () => {
    h.state.returningQueue = [[{ emailNotificationLogId: 'e2', sendStatus: 'PENDING' }]]

    const result = await createResendEmailNotificationLog({
      shopAccountId: 's1',
      toEmail: 'a@example.com',
      notificationType: 'SHOP_ACCOUNT_ISSUED',
      initialPasswordHash: 'new-hashed',
    })

    expect(result).toMatchObject({ emailNotificationLogId: 'e2' })
    expect(h.state.updateTables).toEqual([shopAccounts])
    // 再送 = 初期パスワード再発行なので変更強制フラグも立て直される
    expect(h.state.updateSets[0]).toMatchObject({
      initialPasswordHash: 'new-hashed',
      mustChangePassword: true,
    })
    expect(h.state.insertTables).toEqual([emailNotificationLogs])
    expect(h.state.insertValues[0]).toMatchObject({
      shopAccountId: 's1',
      toEmail: 'a@example.com',
      notificationType: 'SHOP_ACCOUNT_ISSUED',
      sendStatus: 'PENDING',
    })
  })
})

describe('updateShopAccountStatus', () => {
  it('アカウントのステータスとupdatedAtを更新する', async () => {
    await updateShopAccountStatus('s1', 'suspended')
    expect(h.state.updateTables).toEqual([shopAccounts])
    expect(h.state.updateSets[0]).toMatchObject({ accountStatus: 'suspended' })
    expect(h.state.updateSets[0]).toHaveProperty('updatedAt')
  })
})

describe('recordEmailNotificationResult', () => {
  it('ログをSUCCESSにし、アカウントのnotificationSentAtを記録する', async () => {
    const now = new Date('2026-01-01T00:00:00Z')
    await recordEmailNotificationResult({
      emailNotificationLogId: 'log-1',
      shopAccountId: 's1',
      status: 'SUCCESS',
      now,
    })

    expect(h.state.updateTables).toEqual([emailNotificationLogs, shopAccounts])
    expect(h.state.updateSets[0]).toMatchObject({
      sendStatus: 'SUCCESS',
      sentAt: now,
      errorMessage: null,
    })
    expect(h.state.updateSets[1]).toMatchObject({ notificationSentAt: now })
  })

  it('ログをFAILUREにし、エラーを記録し、retryCountをインクリメントする', async () => {
    const now = new Date('2026-01-01T00:00:00Z')
    await recordEmailNotificationResult({
      emailNotificationLogId: 'log-1',
      shopAccountId: 's1',
      status: 'FAILURE',
      errorMessage: 'SES timeout',
      now,
    })

    expect(h.state.updateTables).toEqual([emailNotificationLogs])
    expect(h.state.updateSets[0]).toMatchObject({
      sendStatus: 'FAILURE',
      errorMessage: 'SES timeout',
    })
    expect(h.state.updateSets[0]).toHaveProperty('retryCount')
  })
})

describe('emailNotificationRetryBackoffMs', () => {
  it('リトライごとにバックオフを倍にし、24時間で頭打ちにする', () => {
    expect(emailNotificationRetryBackoffMs(0)).toBe(5 * 60 * 1000)
    expect(emailNotificationRetryBackoffMs(1)).toBe(10 * 60 * 1000)
    expect(emailNotificationRetryBackoffMs(2)).toBe(20 * 60 * 1000)
    expect(emailNotificationRetryBackoffMs(10)).toBe(24 * 60 * 60 * 1000)
  })
})

describe('findEmailNotificationRetryCandidates', () => {
  it('バックオフ期間内の行を除外する', async () => {
    const now = new Date('2026-01-01T00:00:00Z')
    h.state.selectQueue = [
      [
        {
          emailNotificationLogId: 'e1',
          shopAccountId: 's1',
          toEmail: 'a@example.com',
          notificationType: 'SHOP_ACCOUNT_ISSUED',
          retryCount: 0,
          updatedAt: new Date(now.getTime() - 1 * 60 * 1000),
          shopName: 'Shop',
          contactName: 'Taro',
        },
      ],
    ]

    expect(await findEmailNotificationRetryCandidates(now)).toEqual([])
  })

  it('バックオフ期間を過ぎた行をupdatedAtフィールドなしで返す', async () => {
    const now = new Date('2026-01-01T00:00:00Z')
    h.state.selectQueue = [
      [
        {
          emailNotificationLogId: 'e1',
          shopAccountId: 's1',
          toEmail: 'a@example.com',
          notificationType: 'SHOP_ACCOUNT_ISSUED',
          retryCount: 0,
          updatedAt: new Date(now.getTime() - 10 * 60 * 1000),
          shopName: 'Shop',
          contactName: 'Taro',
        },
      ],
    ]

    const result = await findEmailNotificationRetryCandidates(now)
    expect(result).toEqual([
      {
        emailNotificationLogId: 'e1',
        shopAccountId: 's1',
        toEmail: 'a@example.com',
        notificationType: 'SHOP_ACCOUNT_ISSUED',
        retryCount: 0,
        shopName: 'Shop',
        contactName: 'Taro',
      },
    ])
  })
})

describe('EMAIL_NOTIFICATION_MAX_RETRY_COUNT', () => {
  it('リトライ上限として使われる正の数である', () => {
    expect(EMAIL_NOTIFICATION_MAX_RETRY_COUNT).toBeGreaterThan(0)
  })
})

describe('markEmailNotificationForRetry', () => {
  it('パスワードハッシュを再発行し、ログをPENDINGにリセットする', async () => {
    const now = new Date('2026-01-01T00:00:00Z')
    await markEmailNotificationForRetry({
      emailNotificationLogId: 'e1',
      shopAccountId: 's1',
      initialPasswordHash: 'new-hashed',
      now,
    })

    expect(h.state.updateTables).toEqual([shopAccounts, emailNotificationLogs])
    expect(h.state.updateSets[0]).toMatchObject({ initialPasswordHash: 'new-hashed', updatedAt: now })
    expect(h.state.updateSets[1]).toMatchObject({ sendStatus: 'PENDING', updatedAt: now })
  })
})
