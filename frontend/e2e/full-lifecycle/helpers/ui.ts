import { type Locator, type Page } from '@playwright/test';

// Dev-mode React hydration lags first paint; clicking/typing too early triggers
// a native form submit instead of the SPA handler. Wait for the app to settle.
export async function settle(page: Page, ms = 1200): Promise<void> {
  await page.waitForLoadState('load').catch(() => undefined);
  await page.waitForTimeout(ms);
}

// The shared `Modal` component renders its panel as a div whose Tailwind
// arbitrary class literally contains `radius-modal`. Scoping field lookups to
// the open panel avoids colliding with same-named labels behind the backdrop.
export function modalPanel(page: Page): Locator {
  return page.locator('[class*="radius-modal"]').last();
}

// Find the control that belongs to a <label>, by scoping to the label's PARENT
// wrapper and grabbing the control inside it. This is robust whether the control
// is a bare element (the registry modals: <label/><input/>) or wrapped (the
// athlete form's Input primitive wraps <input> in a <motion.div>). The labels
// are not associated via htmlFor, so getByLabel can't be used. `label` matches
// as a substring.
function controlFor(scope: Locator | Page, label: string | RegExp, control: string): Locator {
  return (scope as Locator | Page)
    .locator('label', { hasText: label })
    .locator('xpath=..')
    .locator(control)
    .first();
}

// Fill a labelled text/date input.
export async function fillFieldByLabel(
  scope: Locator | Page,
  label: string | RegExp,
  value: string,
): Promise<void> {
  await controlFor(scope, label, 'input').fill(value);
}

// Choose an option in a native <select> by its visible label.
export async function selectNativeByLabel(
  scope: Locator | Page,
  label: string | RegExp,
  optionLabel: string,
): Promise<void> {
  await controlFor(scope, label, 'select').selectOption({ label: optionLabel });
}

// Drive a Radix Select that belongs to a <label> (the athlete + weigh-in forms
// use Radix, not native <select>). Radix renders the trigger as a <button> and
// the options as portalled [role=option] elements.
export async function selectRadixByLabel(
  page: Page,
  scope: Locator | Page,
  label: string | RegExp,
  optionLabel: string | RegExp,
): Promise<void> {
  await controlFor(scope, label, 'button').click();
  // Exact match for string options — otherwise "Male" would also match "Female".
  await page
    .getByRole('option', {
      name: optionLabel,
      exact: typeof optionLabel === 'string',
    })
    .first()
    .click();
}

