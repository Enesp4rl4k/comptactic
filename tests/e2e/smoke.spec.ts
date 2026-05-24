import { test, expect } from '@playwright/test'

test('loads CompTactic landing', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('CompTactic')).toBeVisible()
  await expect(page.getByRole('button', { name: /Open tactic room/i })).toBeVisible()
})

test('opens workspace and map picker', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Open tactic room/i }).click()
  await expect(page.getByRole('button', { name: /Select Map/i })).toBeVisible()
  await page.getByRole('button', { name: /Select Map/i }).click()
  await expect(page.getByPlaceholder('Search layers…')).toBeVisible()
})
