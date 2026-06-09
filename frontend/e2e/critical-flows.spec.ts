/**
 * QA — Critical user-flow E2E coverage.
 *
 * Focus: the navigation regression (sidebar links that lost the /dashboard
 * prefix dumped the user back to the public landing page), plus the New Post
 * Story/format controls and AI chat persistence.
 *
 * Prereqs: frontend on :5173, backend on :8001, user test@contentflow.dev / Testpass123!
 */
import { test, expect, Page } from '@playwright/test'
import { LoginPage } from './pages/login.page'

const EMAIL = process.env.TEST_EMAIL || 'test@contentflow.dev'
const PASSWORD = process.env.TEST_PASSWORD || 'Testpass123!'

async function gotoViaSidebar(page: Page, label: string) {
  await page.getByRole('link', { name: label, exact: false }).first().click()
}

test.describe('ContentFlow — critical flows', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login(EMAIL, PASSWORD)
  })

  test('login lands on the dashboard @smoke', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading').first()).toBeVisible()
  })

  // Regression: every sidebar destination must stay inside /dashboard and never
  // bounce to the public landing page (the old /calendar, /new-post bug).
  const destinations: { label: string; url: RegExp }[] = [
    { label: 'New Post', url: /\/dashboard\/new-post/ },
    { label: 'Calendar', url: /\/dashboard\/calendar/ },
    { label: 'Accounts', url: /\/dashboard\/accounts/ },
    { label: 'AI Menejer', url: /\/dashboard\/ai-chat/ },
    { label: 'Analytics', url: /\/dashboard\/analytics/ },
  ]

  for (const { label, url } of destinations) {
    test(`sidebar → ${label} stays in the app`, async ({ page }) => {
      await gotoViaSidebar(page, label)
      await expect(page).toHaveURL(url)
      // Must NOT have fallen back to the public landing hero.
      await expect(page.getByRole('link', { name: 'AI Menejer' })).toBeVisible()
    })
  }

  test('Calendar reachable from the AI chat page (no bounce to home)', async ({ page }) => {
    await gotoViaSidebar(page, 'AI Menejer')
    await expect(page).toHaveURL(/\/dashboard\/ai-chat/)
    await gotoViaSidebar(page, 'Calendar')
    await expect(page).toHaveURL(/\/dashboard\/calendar/)
  })

  test('New Post Live Preview has the Story content-type switcher', async ({ page }) => {
    await gotoViaSidebar(page, 'New Post')
    await expect(page).toHaveURL(/\/dashboard\/new-post/)
    // The Live Preview switcher (Post / Story / Reel) is always available — the
    // button label renders lowercase (capitalized via CSS only).
    await expect(page.getByRole('button', { name: 'story', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'post', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'reel', exact: true })).toBeVisible()
  })

  test('AI chat history persists across navigation', async ({ page }) => {
    await gotoViaSidebar(page, 'AI Menejer')
    await expect(page).toHaveURL(/\/dashboard\/ai-chat/)
    // Seed a history entry directly in storage, then re-enter the page.
    await page.evaluate(() => {
      localStorage.setItem(
        'cf_ai_chat_history',
        JSON.stringify([{ id: 'x1', role: 'user', content: 'QA persistence probe' }]),
      )
    })
    await gotoViaSidebar(page, 'Calendar')
    await gotoViaSidebar(page, 'AI Menejer')
    await expect(page.getByText('QA persistence probe')).toBeVisible()
  })
})
