/* Visual + interaction check for /admin/auctions (runs against localhost:3020). */
import { chromium } from '/home/sim/www/rajahinta-fi/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.mjs'

const BASE = 'http://localhost:3020'
const OUT = '/home/sim/www/erametsad/.opencode/.tmp/visual'
const results = []
const ok = (name, pass, note = '') => {
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${note ? ' — ' + note : ''}`)
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text().slice(0, 300))
})
page.on('pageerror', (err) => console.log('PAGE ERROR:', String(err).slice(0, 300)))
page.on('response', (res) => {
  if (res.status() >= 400) console.log('HTTP', String(res.status()), res.url().slice(0, 160))
})

// 1. Login
await page.goto(BASE + '/login')
await page.locator('form input[type="text"]').fill('admin@erametsad.ee')
await page.locator('form input[type="password"]').fill('demo1234')
await page.locator('form button[type="submit"]').click()
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 }).catch(() => {})
ok('login redirects away from /login', !page.url().includes('/login'), page.url())

// 2. Auctions list
await page.goto(BASE + '/admin/auctions')
await page.waitForSelector('table tbody tr')
ok('table renders rows', (await page.locator('table tbody tr').count()) > 0)

// 3. Row selection -> bulk bar
const firstCheck = page.locator('table tbody input[type="checkbox"]').first()
await firstCheck.click()
await page.waitForTimeout(300)
const checkedCount = await page.locator('input[type="checkbox"]:checked').count()
ok('checkbox stays checked after click', checkedCount === 1, `count=${String(checkedCount)}`)
const bulkVisible = await page.locator('[role="status"]').isVisible().catch(() => false)
ok('bulk bar visible on selection', bulkVisible)
const bulkText = bulkVisible ? await page.locator('[role="status"]').innerText() : ''
ok('bulk bar shows Valitud 1', /Valitud\s*1/.test(bulkText), JSON.stringify(bulkText.slice(0, 60)))

// 4. Selected-row highlight + cancel
const rowClass = await page.locator('table tbody tr').first().getAttribute('class')
ok('selected row highlighted', (rowClass ?? '').includes('bg-primaryLight'), rowClass ?? '')
await page.locator('[role="status"] button', { hasText: 'Tühista' }).click()
await page.waitForTimeout(200)
ok('bulk bar hides after cancel', !(await page.locator('[role="status"]').isVisible().catch(() => false)))

// 5. Hover reveals row actions
const actions = page.locator('table tbody tr').first().locator('.row-actions')
const opacityBefore = await actions.evaluate((el) => getComputedStyle(el).opacity)
await page.locator('table tbody tr').first().hover()
await page.waitForTimeout(250)
const opacityAfter = await actions.evaluate((el) => getComputedStyle(el).opacity)
ok('row actions revealed on hover', opacityBefore === '0' && opacityAfter === '1', `before=${opacityBefore} after=${opacityAfter}`)

// 6. Sort toggle preserves filters
await page.goto(BASE + '/admin/auctions?status=archived')
await page.waitForSelector('table thead')
await page.locator('table thead a', { hasText: 'Alghind' }).click()
await page.waitForURL((u) => u.searchParams.get('sort') !== null, { timeout: 15000 })
const url = page.url()
ok('sort link applies sort param', url.includes('sort='), url)
ok('sort preserves status filter', url.includes('status='), url)

// 7. End-manual modal on an active auction (no submit — do not mutate data)
await page.goto(BASE + '/admin/auctions?status=active')
await page.waitForSelector('table tbody tr')
const endButtons = page.locator('table tbody button', { hasText: 'Lõpeta' })
const endCount = await endButtons.count()
if (endCount > 0) {
  await page.locator('table tbody tr').first().hover()
  await endButtons.first().click()
  await page.waitForTimeout(300)
  const dialogOpen = await page.locator('dialog[open]').isVisible().catch(() => false)
  ok('end modal opens', dialogOpen)
  if (dialogOpen) {
    const dialogText = await page.locator('dialog[open]').innerText()
    ok('modal warns irreversible', /pöördumatu/.test(dialogText))
    ok('modal has outcome radios', (await page.locator('dialog[open] input[name="outcome"]').count()) === 2)
    ok('modal reason has minLength 5', (await page.locator('dialog[open] input[name="reason"]').getAttribute('minLength')) === '5')
    // short reason blocked by native validation
    await page.locator('dialog[open] input[name="reason"]').fill('abc')
    await page.locator('dialog[open] button[type="submit"]').click()
    await page.waitForTimeout(300)
    const validationMsg = await page.locator('dialog[open] input[name="reason"]').evaluate((el) => el.validationMessage)
    ok('short reason blocked by validation', validationMsg !== '', validationMsg.slice(0, 60))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    ok('modal closes on Escape', !(await page.locator('dialog[open]').isVisible().catch(() => false)))
  }
} else {
  ok('end modal', false, 'no Lõpeta button found on page')
}

// 8. Screenshots: auctions desktop full page
await page.goto(BASE + '/admin/auctions')
await page.waitForSelector('table tbody tr')
await page.screenshot({ path: OUT + '/final-auctions-full.png', fullPage: true })

// 9. DataTable consumers regression spot-check
for (const [name, path] of [['users', '/admin/users'], ['bids', '/admin/bids']]) {
  await page.goto(BASE + path)
  await page.waitForSelector('table, main')
  const hasTable = (await page.locator('table').count()) > 0
  ok(`spot-check ${name} renders`, hasTable)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/final-${name}.png`, fullPage: false })
}

await browser.close()
console.log('\n=== RESULTS ===')
for (const line of results) console.log(line)
