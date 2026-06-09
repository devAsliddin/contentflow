import { Page, Locator, expect } from '@playwright/test'

/** Page Object for the login screen. */
export class LoginPage {
  readonly page: Page
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator

  constructor(page: Page) {
    this.page = page
    this.emailInput = page.locator('input[type="email"]')
    this.passwordInput = page.locator('input[type="password"]')
    this.submitButton = page.locator('button[type="submit"]')
  }

  async goto(): Promise<void> {
    await this.page.goto('/login')
    await expect(this.emailInput).toBeVisible({ timeout: 15000 })
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
    // Successful login lands on the dashboard.
    await this.page.waitForURL('**/dashboard', { timeout: 20000 })
  }
}
