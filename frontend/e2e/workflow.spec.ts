import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const screenshots = '../docs/screenshots';
async function prepareScreenshot(page: Page) {
  const dismiss = page.getByRole('button', { name: 'Dismiss notification' });
  if (await dismiss.isVisible()) await dismiss.click();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
}

test('desktop: generate, edit, export and restore a persisted report', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('Demo mode is on')).toBeVisible();
  await mkdir(screenshots, { recursive: true });
  await prepareScreenshot(page);
  await page.screenshot({ path: `${screenshots}/workspace-desktop.png`, fullPage: true });
  await page.getByRole('button', { name: 'Load Example' }).click();
  await page.getByLabel('Build / Version', { exact: true }).fill('1.4.2');
  await page.getByRole('button', { name: 'Generate Bug Report' }).click();
  await expect(page.getByLabel('Summary', { exact: true })).toHaveValue(/Game sometimes freezes/);
  await expect(page.getByRole('meter')).toHaveAttribute('aria-valuenow', '60');
  await page.getByLabel('Summary', { exact: true }).fill('Reviewed vehicle map freeze');
  await page.getByLabel('Severity', { exact: true }).selectOption('Critical');
  await expect(page.getByLabel('Priority', { exact: true })).toHaveValue('Medium');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON' }).click();
  expect((await download).suggestedFilename()).toBe('qa-bug-report.json');
  await page.reload();
  await page.getByRole('button', { name: /Recent Reports/ }).click();
  await page.getByRole('button', { name: /Reviewed vehicle map freeze.*Demo/ }).click();
  await expect(page.getByLabel('Summary', { exact: true })).toHaveValue(
    'Reviewed vehicle map freeze',
  );
  await expect(page.getByLabel('Severity', { exact: true })).toHaveValue('Critical');
  await prepareScreenshot(page);
  await page.screenshot({ path: `${screenshots}/report-desktop.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('mobile: no horizontal overflow, all examples generate, dark mode', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const name of [
    'Crash Unexpected exits',
    'UI Interface issues',
    'Performance Frame rate & stability',
    'Save System Progress & persistence',
    'Audio Sound & dialogue',
  ]) {
    await page.getByRole('button', { name }).click();
    await page.getByRole('button', { name: 'Generate Bug Report' }).click();
    await expect(page.getByText('Draft ready')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await prepareScreenshot(page);
  await page.screenshot({ path: `${screenshots}/report-mobile.png`, fullPage: true });
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.setViewportSize({ width: 1280, height: 960 });
  await prepareScreenshot(page);
  await page.screenshot({ path: `${screenshots}/report-dark.png`, fullPage: true });
  await page.setViewportSize({ width: 320, height: 760 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('clipboard uses edited text, keyboard modal closes with Escape', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.getByRole('button', { name: 'Load Example' }).click();
  await page.getByRole('button', { name: 'Generate Bug Report' }).click();
  await page.getByLabel('Summary', { exact: true }).fill('Clipboard test title');
  await page.getByRole('button', { name: 'Copy Jira Format' }).click();
  await expect(page.getByRole('status')).toContainText('Copied to clipboard');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    'h2. Summary\nClipboard test title',
  );
  await page.getByRole('button', { name: /Recent Reports/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Recent Reports/ })).toBeFocused();
});

test('automated accessibility checks for empty and generated views in both themes', async ({
  page,
}) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  await page.goto('/');
  const analyze = async () => {
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      result.violations.map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          summary: node.failureSummary,
        })),
      })),
    ).toEqual([]);
  };
  await analyze();
  await page.getByRole('button', { name: 'Load Example' }).click();
  await page.getByRole('button', { name: 'Generate Bug Report' }).click();
  await expect(page.getByText('Draft ready')).toBeVisible();
  await analyze();
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await analyze();
});

test('answer questions and refine the same editable report without inventing missing facts', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page
    .getByLabel('Describe the issue', { exact: false })
    .fill('Po wejściu do samochodu i otwarciu mapy gra czasami się zawiesza.');
  await expect(page.getByLabel('Report detail', { exact: true })).toHaveValue('standard');
  await page.getByRole('button', { name: 'Generate Bug Report' }).click();
  await expect(page.getByRole('heading', { name: 'Improve this report' })).toBeVisible();
  await page.getByLabel('Summary', { exact: true }).fill('Reviewed freeze after opening map');
  await page.getByLabel('Priority', { exact: true }).selectOption('High');
  await expect(page.getByRole('button', { name: 'Update report', exact: true })).toBeDisabled();
  await page.getByLabel('Which build was tested?', { exact: true }).fill('Build 0.8.24');
  await page
    .getByLabel('How often does the issue reproduce across repeated attempts?', { exact: true })
    .fill('Happens around 3 out of 5 attempts.');
  const request = page.waitForRequest((request) => request.url().endsWith('/api/reports/refine'));
  await page.getByRole('button', { name: 'Update report', exact: true }).click();
  const sent = (await request).postDataJSON();
  expect(sent.answers).toHaveLength(2);
  expect(sent.report.summary).toBe('Reviewed freeze after opening map');
  await expect(
    page
      .getByRole('region', { name: 'Your Jira ticket' })
      .getByLabel('Environment', { exact: true }),
  ).toHaveValue('Build: 0.8.24');
  const ticket = page.getByRole('region', { name: 'Your Jira ticket' });
  await expect(ticket.getByLabel('Reproduction Rate', { exact: true })).toHaveValue('3/5');
  await expect(page.getByLabel('Summary', { exact: true })).toHaveValue(
    'Reviewed freeze after opening map',
  );
  await expect(page.getByLabel('Priority', { exact: true })).toHaveValue('High');
  await expect(page.getByLabel('Regression', { exact: true })).toHaveValue('Unknown');
  await expect(page.getByLabel('Which build was tested?', { exact: true })).toHaveCount(0);
  await expect(
    page.getByLabel('How often does the issue reproduce across repeated attempts?', {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.getByLabel('Missing Information', { exact: false })).not.toHaveValue(
    /Build \/ version|Reproduction frequency/,
  );
  await expect(page.getByRole('button', { name: /Recent Reports/ })).toContainText('1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: /Recent Reports/ }).click();
  await page.getByRole('button', { name: /Reviewed freeze after opening map.*Demo/ }).click();
  await expect(ticket.getByLabel('Reproduction Rate', { exact: true })).toHaveValue('3/5');
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    accessibility.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
});
