import { test, expect } from '@playwright/test'

test('loads CompTactic home', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Select Map/i })).toBeVisible()
  await expect(page.getByText('CompTactic')).toBeVisible()
})

test('map picker opens', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Select Map/i }).click()
  await expect(page.getByPlaceholder('Search layers…')).toBeVisible()
})
