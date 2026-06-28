import { expect, type Page } from '@playwright/test';

// Canonical forward order (mirrors EVENT_LIFECYCLE_ORDER on the backend).
export const LIFECYCLE_ORDER = [
  'REG_OPEN',
  'LOCKED',
  'WEIGHIN',
  'WEIGH_IN_COMPLETED',
  'DRAWN',
  'PUBLISHED',
  'LIVE',
  'COMPLETED',
] as const;

// Full lifecycle labels as rendered by the StatusChip on the event detail page
// (admin.events.lifecycle.*). These are what we assert against in the UI.
export const STAGE_LABEL: Record<string, string> = {
  REG_OPEN: 'Registration open',
  LOCKED: 'Registration locked',
  WEIGHIN: 'Weigh-in',
  WEIGH_IN_COMPLETED: 'Weigh-in completed',
  DRAWN: 'Draw executed',
  PUBLISHED: 'Published',
  LIVE: 'Competition live',
  COMPLETED: 'Completed',
};

export function eventUrl(eventId: string, locale = 'en'): string {
  return `/${locale}/admin/events/${eventId}`;
}

export async function gotoEvent(page: Page, eventId: string, locale = 'en'): Promise<void> {
  await page.goto(eventUrl(eventId, locale), { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load').catch(() => undefined);
}

// The lifecycle StatusChip in the page header — the chip row is the sibling
// right after the event-name <h1>. Scoping here is essential: the lifecycle
// *stepper* lower on the page renders SHORT labels, two of which ("Weigh-in",
// "Published") collide with full labels and would fool a page-wide getByText.
function headerChip(page: Page) {
  return page.locator('h1').first().locator('xpath=following-sibling::div[1]');
}

// Assert the event detail HEADER shows the given lifecycle stage.
export async function assertStageBadge(page: Page, stage: string): Promise<void> {
  await expect(
    headerChip(page).getByText(STAGE_LABEL[stage], { exact: true }).first(),
  ).toBeVisible({ timeout: 20_000 });
}

// Drive the real "Advance stage" → confirm flow on the event detail page and
// assert the badge advanced to `toStage`. The page advances exactly one step
// (to `next`), so the caller must ensure preconditions for that step are met.
export async function advanceStageUI(
  page: Page,
  eventId: string,
  toStage: string,
  opts: { override?: boolean; reason?: string } = {},
): Promise<void> {
  await gotoEvent(page, eventId);

  // If the event already auto-advanced to (or past) the target, just assert it.
  const already = headerChip(page).getByText(STAGE_LABEL[toStage], { exact: true }).first();
  if (await already.isVisible().catch(() => false)) {
    await assertStageBadge(page, toStage);
    return;
  }

  await page.getByRole('button', { name: 'Advance stage' }).click();

  if (opts.override) {
    // Radix Checkbox labelled by common.override ("Override").
    await page.getByRole('checkbox').first().click();
  }
  if (opts.reason) {
    await page.locator('#event-advance-reason').fill(opts.reason);
  }

  await page.getByRole('button', { name: 'Confirm advance' }).click();
  await assertStageBadge(page, toStage);
}
