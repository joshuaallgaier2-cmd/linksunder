import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const appURL = `http://127.0.0.1:${process.env.LINKSUNDER_E2E_PORT || '4317'}`;
test('demo, reports, real history and responsive themes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Build for the unexpected.' })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Run Demo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Fixed · draft preservation' })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByRole('link', { name: 'Download HTML Report' })).toBeVisible({
    timeout: 20000,
  });
  const report = await page.request.get(
    (await page.getByRole('link', { name: 'Download HTML Report' }).getAttribute('href')) || '',
  );
  expect(await report.text()).toContain('PASS');
  await page.screenshot({ path: 'docs/screenshots/report.png', fullPage: true });
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Broken · draft preservation' })).toBeVisible();
  await expect(page.locator('tbody .fail')).toHaveCount(1);
  await expect(page.locator('tbody .pass')).toHaveCount(1);
  await page.screenshot({ path: 'docs/screenshots/dashboard.png', fullPage: true });
  await page.getByRole('button', { name: 'Light appearance' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: 'docs/screenshots/light.png', fullPage: true });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/screenshots/mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'New test', exact: true }).click();
  await page.getByRole('button', { name: 'Add step' }).click();
  await expect(page.getByLabel('Step 1 action')).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A lab that stays local.' })).toBeVisible();
});
test('API validates input and rejects cross-origin mutations', async ({ request }) => {
  const bad = await request.post('/api/runs', {
    headers: { 'X-LinkSunder': 'local' },
    data: { name: '' },
  });
  expect(bad.status()).toBe(400);
  const csrf = await request.post('/api/cancel', { data: {} });
  expect(csrf.status()).toBe(403);
  const cross = await request.post('/api/cancel', {
    headers: { 'X-LinkSunder': 'local', Origin: 'https://evil.example' },
    data: {},
  });
  expect(cross.status()).toBe(403);
  expect((await request.get('/api/runs/not-a-run')).status()).toBe(404);
  expect((await request.get('/api/reports/../../secret/json')).status()).not.toBe(200);
});
test('builds and runs an assertion through the no-code UI', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New test', exact: true }).click();
  await page.getByLabel('Scenario name').fill('My own UI assertion');
  await page.getByRole('button', { name: 'Add step' }).click();
  await page.getByLabel('Step 1 selector').fill('#note');
  await page.getByRole('button', { name: 'Save scenario', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Scenario saved');
  await page.reload();
  await page.getByRole('button', { name: 'New test', exact: true }).click();
  await page.getByLabel('Saved scenarios').selectOption('My own UI assertion');
  await expect(page.getByLabel('Step 1 selector')).toHaveValue('#note');
  await page.getByRole('button', { name: 'Run Test', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Download JSON Report' })).toBeVisible();
  await expect(page.locator('.heading .badge')).toHaveText('pass');
});
test('duplicates a scenario step, keeps focus predictable, and edits independently at 390px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'New test', exact: true }).click();
  await page.getByRole('button', { name: 'Add step' }).click();
  await page.getByLabel('Step 1 action').selectOption('fill');
  await page.getByLabel('Step 1 selector').fill('#note');
  await page.getByLabel('Step 1 value').fill('original value');
  await page.getByRole('button', { name: 'Add step' }).click();
  await page.getByLabel('Step 2 selector').fill('#status');
  await page.getByRole('button', { name: 'Duplicate step' }).first().click();
  await expect(page.getByLabel('Step 2 selector')).toHaveValue('#note');
  await expect(page.getByLabel('Step 2 value')).toHaveValue('original value');
  await expect(page.getByLabel('Step 3 selector')).toHaveValue('#status');
  await expect(page.getByRole('button', { name: 'Duplicate step' }).first()).toBeFocused();
  await page.getByLabel('Step 2 selector').fill('#copy');
  await page.getByLabel('Step 2 value').fill('edited copy');
  await expect(page.getByLabel('Step 1 selector')).toHaveValue('#note');
  await expect(page.getByLabel('Step 1 value')).toHaveValue('original value');
  await expect(page.getByLabel('Step 3 selector')).toHaveValue('#status');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('does not allow adding or duplicating more than the scenario step limit', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New test', exact: true }).click();
  const addStep = page.getByRole('button', { name: 'Add step' });
  for (let count = 0; count < 50; count += 1) {
    await addStep.click();
  }
  await expect(page.locator('.stepedit')).toHaveCount(50);
  await expect(addStep).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Duplicate step' }).first()).toBeDisabled();
  await expect(page.getByText(/50 of 50 steps\. Remove a step/)).toBeVisible();
});
test('serializes runs and cancels a pending browser', async ({ request }) => {
  const headers = { 'X-LinkSunder': 'local' };
  const result = await request.post('/api/runs', {
    headers,
    data: {
      name: 'Cancel pending check',
      url: `${appURL}/demo/fixed`,
      steps: [{ action: 'check', selector: '#never' }],
    },
  });
  expect(result.status()).toBe(200);
  const run = await result.json();
  const second = await request.post('/api/runs', {
    headers,
    data: { name: 'Busy', url: `${appURL}/demo/fixed` },
  });
  expect(second.status()).toBe(409);
  await request.post('/api/cancel', { headers, data: {} });
  await expect
    .poll(async () => {
      const r = await request.get('/api/runs/' + run.id);
      return (await r.json()).status;
    })
    .toBe('cancelled');
});
