/**
 * Locale-aware name helpers.
 * When locale is 'ka' and a Georgian translation exists, return it.
 * Otherwise fall back to the English value.
 */

export function localizedName(
  en: string,
  ka: string | null | undefined,
  locale: string,
): string {
  return locale === 'ka' && ka ? ka : en;
}

export function localizedFullName(
  firstName: string,
  lastName: string,
  firstNameKa: string | null | undefined,
  lastNameKa: string | null | undefined,
  locale: string,
): string {
  if (locale === 'ka' && firstNameKa && lastNameKa) {
    return `${firstNameKa} ${lastNameKa}`;
  }
  return `${firstName} ${lastName}`;
}
