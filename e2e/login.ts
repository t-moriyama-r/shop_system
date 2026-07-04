import { chromium, type Browser, type Page } from 'playwright-core'

/**
 * SE管理画面に「ログイン済みの状態」を作るためのスクリプト。
 *
 * すでに起動している Chrome に CDP 経由で接続し、ログイン
 * （初回ログイン時は初回パスワード設定も）を自動で行う。
 * 実行後はブラウザにセッションが残るため、以降は computer use 等で
 * 手動操作を続けられる（ログイン操作でトークンを消費しない）。
 *
 * 環境変数で上書き可能:
 *   CDP_URL  接続先 Chrome の CDP エンドポイント (default: http://localhost:29229)
 *   BASE_URL Front のベース URL             (default: http://localhost:3000)
 *   EMAIL    ログインするメールアドレス       (default: admin@example.com)
 *   PASSWORD ログイン / 初回設定するパスワード (default: Admin1234)
 */
const CDP_URL = process.env.CDP_URL ?? 'http://localhost:29229'
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const EMAIL = process.env.EMAIL ?? 'admin@example.com'
const PASSWORD = process.env.PASSWORD ?? 'Admin1234'

const LOGIN_PATH = '/admin/login'
const PASSWORD_SETUP_PATH = '/admin/password/setup'
const DASHBOARD_PATH = '/admin/dashboard'

async function getPage(browser: Browser): Promise<Page> {
  const context = browser.contexts()[0] ?? (await browser.newContext())
  return context.pages()[0] ?? (await context.newPage())
}

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL)
  try {
    const page = await getPage(browser)

    await page.goto(`${BASE_URL}${LOGIN_PATH}`, { waitUntil: 'networkidle' })

    await page.getByLabel('メールアドレス').fill(EMAIL)
    await page.getByLabel('パスワード').fill(PASSWORD)
    await page.getByRole('button', { name: 'ログイン' }).click()

    // ログイン成功時は /admin/password/setup か /admin/dashboard に遷移する。
    // 失敗時は画面上にエラーメッセージが表示される。
    await Promise.race([
      page.waitForURL(`**${PASSWORD_SETUP_PATH}`, { timeout: 10000 }),
      page.waitForURL(`**${DASHBOARD_PATH}`, { timeout: 10000 }),
    ]).catch(() => undefined)

    if (page.url().includes(PASSWORD_SETUP_PATH)) {
      // 初回ログイン: パスワード未設定なので設定する
      await page.getByLabel('新しいパスワード').fill(PASSWORD)
      await page.getByLabel('パスワード確認').fill(PASSWORD)
      await page.getByRole('button', { name: 'パスワードを設定する' }).click()
      await page.waitForURL(`**${DASHBOARD_PATH}`, { timeout: 10000 })
    }

    if (!page.url().includes(DASHBOARD_PATH)) {
      const message = await page
        .locator('.bg-red-50')
        .first()
        .textContent()
        .catch(() => null)
      throw new Error(
        `ログインに失敗しました (現在の URL: ${page.url()})` +
          (message ? ` / 画面のエラー: ${message.trim()}` : ''),
      )
    }

    console.log(`ログイン成功: ${EMAIL} → ${page.url()}`)
  } finally {
    // ブラウザは開いたままにする（セッションを残す）。接続だけ切る。
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
